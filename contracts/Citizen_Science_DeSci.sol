pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract CitizenScienceDeSciFHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    error NotOwner();
    error NotProvider();
    error Paused();
    error CooldownActive();
    error BatchNotOpen();
    error BatchClosedOrFull();
    error InvalidInput();
    error ReplayAttempt();
    error StateMismatch();
    error InvalidProof();
    error AlreadyInitialized();

    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event Paused(address account);
    event Unpaused(address account);
    event CooldownSecondsSet(uint256 oldCooldown, uint256 newCooldown);
    event MaxSubmissionsPerBatchSet(uint256 oldMax, uint256 newMax);
    event BatchOpened(uint256 indexed batchId);
    event BatchClosed(uint256 indexed batchId);
    event ContributionSubmitted(address indexed contributor, uint256 indexed batchId, uint256 encryptedContributionValue);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed batchId);
    event DecryptionCompleted(uint256 indexed requestId, uint256 indexed batchId, uint256 totalValue);

    struct DecryptionContext {
        uint256 batchId;
        bytes32 stateHash;
        bool processed;
    }

    struct Batch {
        bool isOpen;
        uint256 totalEncryptedValue; // euint32
        uint256 submissionCount;
    }

    mapping(address => bool) public isProvider;
    mapping(uint256 => DecryptionContext) public decryptionContexts;
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastDecryptionRequestTime;
    mapping(uint256 => Batch) public batches;

    address public owner;
    bool public paused;
    uint256 public cooldownSeconds = 60; // Default 1 minute
    uint256 public maxSubmissionsPerBatch = 100;
    uint256 public currentBatchId = 0;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!isProvider[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier checkSubmissionCooldown() {
        if (block.timestamp < lastSubmissionTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        _;
    }

    modifier checkDecryptionCooldown() {
        if (block.timestamp < lastDecryptionRequestTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        _;
    }

    constructor() {
        owner = msg.sender;
        isProvider[owner] = true; // Owner is a provider by default
        emit ProviderAdded(owner);
    }

    function addProvider(address _provider) external onlyOwner {
        if (!isProvider[_provider]) {
            isProvider[_provider] = true;
            emit ProviderAdded(_provider);
        }
    }

    function removeProvider(address _provider) external onlyOwner {
        if (isProvider[_provider] && _provider != owner) { // Owner cannot be removed as provider
            isProvider[_provider] = false;
            emit ProviderRemoved(_provider);
        }
    }

    function setPause(bool _paused) external onlyOwner {
        paused = _paused;
        if (_paused) {
            emit Paused(msg.sender);
        } else {
            emit Unpaused(msg.sender);
        }
    }

    function setCooldownSeconds(uint256 _cooldownSeconds) external onlyOwner {
        uint256 oldCooldown = cooldownSeconds;
        cooldownSeconds = _cooldownSeconds;
        emit CooldownSecondsSet(oldCooldown, _cooldownSeconds);
    }

    function setMaxSubmissionsPerBatch(uint256 _max) external onlyOwner {
        uint256 oldMax = maxSubmissionsPerBatch;
        maxSubmissionsPerBatch = _max;
        emit MaxSubmissionsPerBatchSet(oldMax, _max);
    }

    function openBatch() external onlyOwner whenNotPaused {
        currentBatchId++;
        batches[currentBatchId] = Batch({isOpen: true, totalEncryptedValue: 0, submissionCount: 0});
        emit BatchOpened(currentBatchId);
    }

    function closeBatch(uint256 _batchId) external onlyOwner {
        if (_batchId == 0 || _batchId > currentBatchId || !batches[_batchId].isOpen) revert BatchNotOpen();
        batches[_batchId].isOpen = false;
        emit BatchClosed(_batchId);
    }

    function submitContribution(uint256 _batchId, euint32 _encryptedContributionValue) external onlyProvider whenNotPaused checkSubmissionCooldown {
        if (_batchId == 0 || _batchId > currentBatchId || !batches[_batchId].isOpen) revert BatchNotOpen();
        if (batches[_batchId].submissionCount >= maxSubmissionsPerBatch) revert BatchClosedOrFull();

        if (!FHE.isInitialized(_encryptedContributionValue)) revert InvalidInput();

        // Add to batch total
        batches[_batchId].totalEncryptedValue = FHE.add(
            euint32.wrap(batches[_batchId].totalEncryptedValue),
            _encryptedContributionValue
        ).unwrap();

        batches[_batchId].submissionCount++;
        lastSubmissionTime[msg.sender] = block.timestamp;
        emit ContributionSubmitted(msg.sender, _batchId, _encryptedContributionValue.unwrap());
    }

    function requestBatchTotalDecryption(uint256 _batchId) external onlyProvider whenNotPaused checkDecryptionCooldown {
        if (_batchId == 0 || _batchId > currentBatchId || batches[_batchId].isOpen) revert BatchNotOpen(); // Must be closed

        euint32 encryptedTotalValue = euint32.wrap(batches[_batchId].totalEncryptedValue);

        if (!FHE.isInitialized(encryptedTotalValue)) revert InvalidInput();

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(encryptedTotalValue);

        bytes32 stateHash = keccak256(abi.encode(cts, address(this)));

        uint256 requestId = FHE.requestDecryption(cts, this.myCallback.selector);
        decryptionContexts[requestId] = DecryptionContext({ batchId: _batchId, stateHash: stateHash, processed: false });
        lastDecryptionRequestTime[msg.sender] = block.timestamp;
        emit DecryptionRequested(requestId, _batchId);
    }

    function myCallback(uint256 requestId, bytes memory cleartexts, bytes memory proof) public {
        if (decryptionContexts[requestId].processed) revert ReplayAttempt();

        // Rebuild ciphertexts array in the exact same order as during requestDecryption
        uint256 batchId = decryptionContexts[requestId].batchId;
        euint32 encryptedTotalValue = euint32.wrap(batches[batchId].totalEncryptedValue);
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(encryptedTotalValue);

        // Re-calculate state hash
        bytes32 currentHash = keccak256(abi.encode(cts, address(this)));
        if (currentHash != decryptionContexts[requestId].stateHash) {
            revert StateMismatch(); // Ensures contract state relevant to decryption hasn't changed
        }

        // Verify proof
        if (!FHE.checkSignatures(requestId, cleartexts, proof)) {
            revert InvalidProof();
        }

        // Decode cleartexts
        uint256 totalValue = abi.decode(cleartexts, (uint256));

        decryptionContexts[requestId].processed = true;
        emit DecryptionCompleted(requestId, batchId, totalValue);
    }

    // Internal helper to ensure FHE library is initialized (if needed, though FHE.sol usually handles this)
    function _initIfNeeded() internal {
        // Example: FHE.init() if it were a public function and needed explicit init.
        // For current FHE.sol, this might not be strictly necessary as init is often implicit.
        // This function is a placeholder for any specific initialization logic if required by future FHE versions.
        // For now, we assume FHE.sol handles its own initialization.
    }

    // Internal helper to hash ciphertexts, used for state commitment
    function _hashCiphertexts(bytes32[] memory _cts) internal pure returns (bytes32) {
        return keccak256(abi.encode(_cts, address(this))); // address(this) ensures contract-specific hash
    }
}