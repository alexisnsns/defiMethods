import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

// Example usage:
const amount = "0.1"; // Amount to withdraw in tokens
const recipient = "0xe19c88086C8d551C81ff8a3e2c5DF87a88110a51"; // Your wallet address

// ABI for the withdraw function
const ABI = [
  "function withdraw(address asset, uint256 amount, address to) external returns (uint256)",
];

// Withdraw function
async function withdrawFromAave() {
  try {
    const {
      MNEMONIC,
      USDC_ADDRESS_ARBITRUM,
      AAVE_POOL_ADDRESS_ARBITRUM,
      ARBITRUM_CHAIN_ID,
      ARBITRUM_RPC_URL,
    } = process.env;
    // Connect wallet

    const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
    const network = await provider.getNetwork();
    console.log("Connected to network:", {
      chainId: network.chainId,
      name: network.name,
    });

    const wallet = new ethers.Wallet(MNEMONIC, provider);
    const userAddress = await wallet.getAddress();

    console.log(`Connected with wallet address: ${userAddress}`);

    // Get contract instance
    const lendingPool = new ethers.Contract(
      AAVE_POOL_ADDRESS_ARBITRUM,
      ABI,
      wallet
    );

    // Convert amount to the correct decimals (assuming amount is in human-readable format)
    const parsedAmount = ethers.parseUnits(amount.toString(), 6); // Adjust decimals as needed

    // Execute the withdraw function
    const tx = await lendingPool.withdraw(
      USDC_ADDRESS_ARBITRUM,
      parsedAmount,
      recipient
    );

    console.log("Withdrawal initiated. Tx Hash:", tx.hash);

    // Wait for transaction to be mined
    const receipt = await tx.wait();
    console.log("Withdrawal successful:", receipt);
  } catch (error) {
    console.error("Withdrawal failed:", error);
  }
}
withdrawFromAave();
