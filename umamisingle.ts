import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

// Resources and addresses
import {
  USDC_ADDRESS_ARBITRUM,
  ARBITRUM_RPC_URL,
  UMAMI_WETH_VAULT_ADDRESS_ARB,
} from "./resources.js";

async function depositUSDCToUmamiOnArb() {
  const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
  const { MNEMONIC } = process.env;

  const network = await provider.getNetwork();
  console.log("Connected to network:", {
    chainId: network.chainId,
    name: network.name,
  });

  try {
    // Set up the wallet
    const wallet = new ethers.Wallet(MNEMONIC, provider);
    const userAddress = await wallet.getAddress();
    console.log(`Connected with wallet address: ${userAddress}`);

    // Define the amount of USDC to deposit
    const depositAmountHuman = "0.5"; // Example: 1000 USDC
    const depositAmount = ethers.parseUnits(depositAmountHuman, 6); // USDC has 6 decimals

    // The minimum amount to receive after fees (for slippage protection)
    const minOutAfterFees = ethers.parseUnits("0.4", 6); // Set to 95% after fees, example

    // Contract ABIs
    const erc20Abi = [
      "function approve(address spender, uint256 value) external returns (bool)",
    ];
    const defiVaultAbi = [
      "function deposit(uint256 assets, uint256 minOutAfterFees, address receiver) external returns (uint256 shares)",
    ];

    // Interfaces for contracts
    const erc20Interface = new ethers.Interface(erc20Abi);
    const defiVaultInterface = new ethers.Interface(defiVaultAbi);

    const ethValue = ethers.parseUnits("0.0005", "ether"); // Convert 0.0005 ETH to wei

    // Approve USDC to the vault
    const usdcContract = new ethers.Contract(
      USDC_ADDRESS_ARBITRUM,
      erc20Interface,
      wallet
    );
    const approveTx = await usdcContract.approve(
      UMAMI_WETH_VAULT_ADDRESS_ARB,
      depositAmount
    );
    console.log("Approval transaction sent:", approveTx.hash);
    await approveTx.wait();
    console.log("Approval confirmed");

    // Deposit into the Umami Vault
    const vaultContract = new ethers.Contract(
      UMAMI_WETH_VAULT_ADDRESS_ARB,
      defiVaultInterface,
      wallet
    );
    const depositTx = await vaultContract.deposit(
      depositAmount,
      minOutAfterFees,
      userAddress,
      {
        value: ethValue, // Add the ETH value (0.0005 ETH) to the transaction
      }
    );
    console.log("Deposit transaction sent:", depositTx.hash);
    const depositReceipt = await depositTx.wait();
    console.log("Deposit confirmed:", depositReceipt);
  } catch (error) {
    console.error("Error in deposit process:", error);
  }
}

// Run the deposit function
depositUSDCToUmamiOnArb();
