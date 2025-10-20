# Citizen Science DeSci: Empowering Research Through Play 🌍🔬

Citizen Science DeSci is an innovative platform that gamifies research tasks, allowing everyday users to contribute to scientific projects and earn token rewards. At the core of this platform lies **Zama's Fully Homomorphic Encryption technology**, which ensures that user contributions remain private and secure while being analyzed for quality.

## The Challenge: Bridging the Gap in Scientific Research 🤔

In today's fast-paced world, scientific research often lacks community involvement, making it difficult for everyday citizens to engage with and contribute to meaningful projects. Existing platforms may compromise user data security, deterring potential contributors from participating in essential research. This disconnect between researchers and non-experts not only limits data sources but also stifles innovation within the scientific community.

## The FHE Solution: Empowering Contributors with Security 🔒

Our platform addresses these challenges by harnessing **Zama's open-source libraries**, including the **zama-fhe SDK**. Using Fully Homomorphic Encryption (FHE), we ensure that user contributions—such as image annotation and data classification—are securely encrypted. This means that while researchers can analyze the contributions for quality and relevance, they never access the underlying data in cleartext. This dual benefit of privacy and usability fosters a healthy ecosystem that encourages participation and innovation.

## Core Features of Citizen Science DeSci 🚀

- **Gamified Research Tasks:** Users can engage in simple tasks like image labeling and data categorization, making scientific contribution accessible and enjoyable.
- **Encrypted Contributions:** User data is secured with FHE, ensuring that privacy is maintained throughout the research process.
- **DAO Governance:** The platform is governed by a Decentralized Autonomous Organization, allowing contributors to influence the direction of future research initiatives.
- **Token Rewards:** Participants are rewarded based on the quality of their contributions, measured through homomorphic computations, incentivizing high-quality submissions.
- **Personal Contribution Dashboard:** Users can track their contributions and rewards in a dedicated dashboard, enhancing engagement and transparency.

## Technology Stack 🛠️

- **Zama FHE SDK:** The primary tool for implementing confidential computing.
- **Node.js:** Server-side JavaScript environment for building the application.
- **Hardhat:** Ethereum development environment for compiling, deploying, and testing smart contracts.
- **Solidity:** Programming language for writing smart contracts.

## Directory Structure 📁

Here’s an overview of the project’s directory structure:
```
Citizen_Science_DeSci/
├── contracts/
│   └── Citizen_Science_DeSci.sol
├── scripts/
│   └── deploy.js
├── test/
│   └── CitizenScienceDeSci.test.js
├── package.json
└── README.md
```

## Installation Steps 🌟

To set up the Citizen Science DeSci platform on your local environment, ensure you follow these steps:

1. **Download the Project:** Ensure you have the project files in your local development environment.
2. **Install Dependencies:** 
   - Make sure you have **Node.js** installed.
   - Navigate to the project directory in your terminal.
   - Run the following command to install the required libraries, including Zama FHE libraries:
     ```bash
     npm install
     ```
   
**Note:** Do not use `git clone` or any URLs as part of your setup.

## Build & Run Instructions ⚙️

After successfully installing the dependencies, you can compile, test, and run the project with the following steps:

1. **Compile the Smart Contracts:**
   ```bash
   npx hardhat compile
   ```

2. **Run the Tests:**
   ```bash
   npx hardhat test
   ```

3. **Deploy the Smart Contracts:**
   ```bash
   npx hardhat run scripts/deploy.js --network yourNetwork
   ```

4. **Start the Application:**
   ```bash
   node app.js
   ```

### Example Code Snippet: Contribution Submission 💻

Here’s a simple snippet that demonstrates how to submit a contribution securely:

```javascript
async function submitContribution(contributionData) {
    const encryptedData = await encryptContribution(contributionData);
    const tx = await citizenScienceContract.submitContribution(encryptedData);
    await tx.wait();
    console.log('Contribution submitted successfully!');
}
```

Make sure you replace `encryptContribution` with the appropriate function from the Zama SDK to handle encryption.

## Acknowledgements 🙏

Powered by **Zama**, we extend our heartfelt gratitude to the Zama team for their pioneering work and open-source tools that empower us to create confidential blockchain applications. Their commitment to privacy and security inspires innovation and community-driven research.

Join us in transforming the scientific research landscape, one contribution at a time. Together, we can bridge the gap between science and society, all while ensuring that personal data remains secure and private. 

Ready to make a difference? Dive into the world of Citizen Science DeSci! 🌟
