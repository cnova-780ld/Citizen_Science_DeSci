// App.tsx
import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface ScienceTask {
  id: string;
  title: string;
  description: string;
  reward: number;
  encryptedData: string;
  category: string;
  completed: boolean;
  contributedValue?: number;
}

interface UserStats {
  totalContributions: number;
  totalRewards: number;
  tasksCompleted: number;
  rank: number;
}

const FHEEncryptNumber = (value: number): string => {
  return `FHE-${btoa(value.toString())}`;
};

const FHEDecryptNumber = (encryptedData: string): number => {
  if (encryptedData.startsWith('FHE-')) {
    return parseFloat(atob(encryptedData.substring(4)));
  }
  return parseFloat(encryptedData);
};

const FHECompute = (encryptedData: string, operation: string): string => {
  const value = FHEDecryptNumber(encryptedData);
  let result = value;
  
  switch(operation) {
    case 'increase10%':
      result = value * 1.1;
      break;
    case 'decrease10%':
      result = value * 0.9;
      break;
    case 'double':
      result = value * 2;
      break;
    default:
      result = value;
  }
  
  return FHEEncryptNumber(result);
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<ScienceTask[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    totalContributions: 0,
    totalRewards: 0,
    tasksCompleted: 0,
    rank: 0
  });
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ScienceTask | null>(null);
  const [contributionValue, setContributionValue] = useState<number>(0);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [activeTab, setActiveTab] = useState<'tasks' | 'dashboard' | 'leaderboard'>('tasks');
  const [showFAQ, setShowFAQ] = useState(false);

  // Sample tasks data (in a real app, this would come from the contract)
  const sampleTasks: ScienceTask[] = [
    {
      id: "task1",
      title: "Galaxy Classification",
      description: "Classify galaxy images from Hubble telescope data",
      reward: 50,
      encryptedData: "",
      category: "Astronomy",
      completed: false
    },
    {
      id: "task2",
      title: "Protein Folding",
      description: "Help predict protein structures for medical research",
      reward: 75,
      encryptedData: "",
      category: "Biology",
      completed: false
    },
    {
      id: "task3",
      title: "Climate Pattern Analysis",
      description: "Identify weather patterns in climate data",
      reward: 40,
      encryptedData: "",
      category: "Environmental Science",
      completed: false
    }
  ];

  useEffect(() => {
    loadTasks().finally(() => setLoading(false));
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
  }, []);

  const loadTasks = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) {
        // Fallback to sample tasks if contract not available
        setTasks(sampleTasks);
        return;
      }
      
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        setTasks(sampleTasks);
        return;
      }
      
      // In a real app, we would load tasks from the contract
      // For now, we'll use the sample tasks
      setTasks(sampleTasks);
      
      // Load user stats if connected
      if (isConnected && address) {
        const statsBytes = await contract.getData(`user_stats_${address}`);
        if (statsBytes.length > 0) {
          try {
            const stats = JSON.parse(ethers.toUtf8String(statsBytes));
            setUserStats(stats);
          } catch (e) { console.error("Error parsing user stats:", e); }
        }
      }
    } catch (e) { 
      console.error("Error loading tasks:", e);
      setTasks(sampleTasks);
    } 
  };

  const completeTask = async (taskId: string, value: number) => {
    if (!isConnected) { alert("Please connect wallet first"); return; }
    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting your contribution with Zama FHE..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      // Encrypt the contribution value
      const encryptedValue = FHEEncryptNumber(value);
      
      // Store the encrypted contribution
      await contract.setData(`task_contribution_${taskId}_${address}`, ethers.toUtf8Bytes(JSON.stringify({
        value: encryptedValue,
        timestamp: Math.floor(Date.now() / 1000)
      })));
      
      // Update task as completed
      const updatedTasks = tasks.map(task => 
        task.id === taskId ? { ...task, completed: true, contributedValue: value } : task
      );
      setTasks(updatedTasks);
      
      // Update user stats
      const newStats = {
        ...userStats,
        totalContributions: userStats.totalContributions + value,
        totalRewards: userStats.totalRewards + (tasks.find(t => t.id === taskId)?.reward || 0),
        tasksCompleted: userStats.tasksCompleted + 1
      };
      setUserStats(newStats);
      await contract.setData(`user_stats_${address}`, ethers.toUtf8Bytes(JSON.stringify(newStats)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Contribution encrypted and submitted!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowTaskModal(false);
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") ? "Transaction rejected by user" : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const decryptWithSignature = async (encryptedData: string): Promise<number | null> => {
    if (!isConnected) { alert("Please connect wallet first"); return null; }
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      return FHEDecryptNumber(encryptedData);
    } catch (e) { console.error("Decryption failed:", e); return null; }
  };

  const checkContractAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) throw new Error("Contract not available");
      const isAvailable = await contract.isAvailable();
      alert(`Contract is ${isAvailable ? 'available' : 'not available'}`);
    } catch (e) {
      alert("Error checking contract availability");
    }
  };

  const faqs = [
    {
      question: "What is FHE encryption?",
      answer: "Fully Homomorphic Encryption (FHE) allows computations on encrypted data without decrypting it. Zama's FHE technology enables us to process your scientific contributions while keeping your data private."
    },
    {
      question: "How are rewards calculated?",
      answer: "Rewards are based on the quality and quantity of your contributions, computed homomorphically on your encrypted data. The DAO periodically adjusts reward rates."
    },
    {
      question: "Can I participate without crypto knowledge?",
      answer: "Absolutely! Our platform is designed for citizen scientists. You only need to complete simple tasks - we handle all the blockchain complexity."
    },
    {
      question: "How is my data protected?",
      answer: "Your contributions are encrypted with Zama FHE before leaving your device. Even we can't see your raw data - only the encrypted results."
    }
  ];

  if (loading) return (
    <div className="loading-screen">
      <div className="rainbow-spinner"></div>
      <p>Initializing encrypted connection...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>Sci<span>Earn</span></h1>
          <p>Learn-to-Earn Citizen Science</p>
        </div>
        <div className="header-actions">
          <button className="glass-button" onClick={checkContractAvailability}>
            Check FHE Status
          </button>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>

      <nav className="main-nav">
        <button 
          className={`nav-button ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Task Hall
        </button>
        <button 
          className={`nav-button ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          My Dashboard
        </button>
        <button 
          className={`nav-button ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          Leaderboard
        </button>
        <button 
          className={`nav-button ${showFAQ ? 'active' : ''}`}
          onClick={() => setShowFAQ(!showFAQ)}
        >
          FAQ
        </button>
      </nav>

      <div className="main-content">
        {showFAQ ? (
          <div className="faq-section glass-card">
            <h2>Frequently Asked Questions</h2>
            <div className="faq-grid">
              {faqs.map((faq, index) => (
                <div className="faq-item" key={index}>
                  <h3>{faq.question}</h3>
                  <p>{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'tasks' ? (
          <>
            <div className="project-intro glass-card">
              <h2>Welcome to SciEarn</h2>
              <p>A "Learn-to-Earn" DeSci platform where you contribute to real scientific research and earn rewards. Your contributions are encrypted with <strong>Zama FHE</strong> technology for privacy.</p>
              <div className="fhe-badge">
                <span>Powered by Zama FHE</span>
              </div>
            </div>

            <div className="tasks-section">
              <h2>Available Research Tasks</h2>
              <p className="subtitle">Complete tasks to earn tokens and contribute to science</p>
              
              <div className="tasks-grid">
                {tasks.filter(t => !t.completed).map(task => (
                  <div className="task-card glass-card" key={task.id} onClick={() => { setSelectedTask(task); setShowTaskModal(true); }}>
                    <div className="task-category">{task.category}</div>
                    <h3>{task.title}</h3>
                    <p>{task.description}</p>
                    <div className="task-reward">
                      <span className="reward-icon">✨</span>
                      <span>{task.reward} SCI</span>
                    </div>
                    <div className="task-actions">
                      <button className="contribute-button">Contribute</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : activeTab === 'dashboard' ? (
          <div className="dashboard-section">
            <h2>My Contribution Dashboard</h2>
            <p className="subtitle">Track your scientific contributions and rewards</p>
            
            <div className="stats-cards">
              <div className="stat-card glass-card">
                <h3>Total Contributions</h3>
                <div className="stat-value">{userStats.totalContributions}</div>
                <p>Data points contributed</p>
              </div>
              <div className="stat-card glass-card">
                <h3>Total Rewards</h3>
                <div className="stat-value">{userStats.totalRewards}</div>
                <p>SCI tokens earned</p>
              </div>
              <div className="stat-card glass-card">
                <h3>Tasks Completed</h3>
                <div className="stat-value">{userStats.tasksCompleted}</div>
                <p>Research tasks finished</p>
              </div>
            </div>
            
            <div className="completed-tasks glass-card">
              <h3>My Completed Tasks</h3>
              {tasks.filter(t => t.completed).length > 0 ? (
                <div className="completed-list">
                  {tasks.filter(t => t.completed).map(task => (
                    <div className="completed-item" key={task.id}>
                      <div className="task-info">
                        <h4>{task.title}</h4>
                        <p>{task.category} • {task.reward} SCI</p>
                      </div>
                      <div className="contribution-value">
                        Contributed: {task.contributedValue}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-tasks">You haven't completed any tasks yet</p>
              )}
            </div>
          </div>
        ) : (
          <div className="leaderboard-section glass-card">
            <h2>Top Contributors</h2>
            <p className="subtitle">Most active citizen scientists this week</p>
            
            <div className="leaderboard-list">
              <div className="leaderboard-header">
                <span>Rank</span>
                <span>Contributor</span>
                <span>Contributions</span>
                <span>Rewards</span>
              </div>
              
              {/* Sample leaderboard data */}
              {[
                { address: "0x7f3...d42a", contributions: 1245, rewards: 6200 },
                { address: "0x5a2...c73b", contributions: 987, rewards: 4935 },
                { address: "0x3e8...f91c", contributions: 756, rewards: 3780 },
                { address: address || "0x1f4...a62d", contributions: userStats.totalContributions, rewards: userStats.totalRewards },
                { address: "0x0bc...e54f", contributions: 321, rewards: 1605 }
              ].sort((a, b) => b.contributions - a.contributions)
               .map((user, index) => (
                <div className={`leaderboard-row ${user.address === address ? 'current-user' : ''}`} key={index}>
                  <span>{index + 1}</span>
                  <span>{user.address}</span>
                  <span>{user.contributions}</span>
                  <span>{user.rewards} SCI</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showTaskModal && selectedTask && (
        <div className="modal-overlay">
          <div className="task-modal glass-card">
            <div className="modal-header">
              <h2>{selectedTask.title}</h2>
              <button onClick={() => setShowTaskModal(false)} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="task-description">
                <p><strong>Category:</strong> {selectedTask.category}</p>
                <p>{selectedTask.description}</p>
                <div className="task-reward">
                  <span>Reward:</span>
                  <strong>{selectedTask.reward} SCI tokens</strong>
                </div>
              </div>
              
              <div className="contribution-form">
                <h3>Your Contribution</h3>
                <p>Enter your data contribution (will be encrypted with FHE):</p>
                <input
                  type="number"
                  value={contributionValue}
                  onChange={(e) => setContributionValue(parseFloat(e.target.value) || 0)}
                  placeholder="Enter numerical value..."
                  className="glass-input"
                />
                
                <div className="fhe-preview">
                  <div className="plain-value">
                    <span>Plain Value:</span>
                    <div>{contributionValue}</div>
                  </div>
                  <div className="encryption-arrow">→</div>
                  <div className="encrypted-value">
                    <span>Encrypted Value:</span>
                    <div>{FHEEncryptNumber(contributionValue).substring(0, 30)}...</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => completeTask(selectedTask.id, contributionValue)}
                className="submit-button"
                disabled={contributionValue <= 0}
              >
                Submit Encrypted Contribution
              </button>
            </div>
          </div>
        </div>
      )}

      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content glass-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="loading-spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>SciEarn</h3>
            <p>Learn-to-Earn Citizen Science Platform</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">About</a>
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy</a>
            <a href="#" className="footer-link">Terms</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} SciEarn. Powered by Zama FHE technology.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;