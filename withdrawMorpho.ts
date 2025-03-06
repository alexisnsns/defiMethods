// WITHDRAW MORPHO USDC BASE POOL TOKENS
import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

import {
  USDC_ADDRESS_ARBITRUM,
  ARBITRUM_CHAIN_ID,
  BASE_CHAIN_ID,
  BASE_RPC_URL,
  USDC_ADDRESS_BASE,
  ARBITRUM_RPC_URL,
  CURVE_POOL_ADDRESS,
  IBT_SPECTRA,
  MORPHO_VAULT_ADDRESS_BASE,
} from "./resources.js";

export function generateWithdrawCallData(
  userAddress: string,
  withdrawAmount,
  depositCurrency: string
) {
  const withdrawMorphoABI = [
    "function withdraw(uint256 assets, address receiver, address owner) public override returns (uint256 shares)",
  ];

  const defiInterface = new ethers.Interface(withdrawMorphoABI);

  withdrawAmount = ethers.toBigInt(withdrawAmount);

  const withdrawCalldata = defiInterface.encodeFunctionData("withdraw", [
    withdrawAmount,
    userAddress,
    userAddress,
  ]);

  return withdrawCalldata;
}

async function withdrawUSDCFromAaveOnArbitrum() {
  try {
    const { MNEMONIC } = process.env;

    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const network = await provider.getNetwork();
    console.log("Connected to network:", {
      chainId: network.chainId,
      name: network.name,
    });

    const wallet = new ethers.Wallet(MNEMONIC, provider);
    const userAddress = await wallet.getAddress();

    console.log(`Connected with wallet address: ${userAddress}`);

    const decimals = 6; // USDC decimals
    const withdrawAmountHuman = "1";
    const withdrawAmount = ethers.parseUnits(withdrawAmountHuman, decimals);

    // Generate initial message for fee estimation
    const callData = generateWithdrawCallData(
      userAddress,
      withdrawAmount,
      USDC_ADDRESS_BASE // Use Base USDC address for the withdraw on morpho
    );

    console.log("Generated CallData:", callData);

    const feeData = await provider.getFeeData();

    // Create transaction with the final data
    const tx = {
      to: MORPHO_VAULT_ADDRESS_BASE,
      from: wallet.address,
      data: callData,
      gasLimit: ethers.toBigInt(2000000),
      value: ethers.toBigInt(0), // Explicitly set to 0
      chainId: Number(BASE_CHAIN_ID),
      maxFeePerGas: feeData.maxFeePerGas
        ? ethers.toBigInt(Math.floor(Number(feeData.maxFeePerGas) * 1.3))
        : ethers.parseUnits("5", "gwei"),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
        ? ethers.toBigInt(
            Math.floor(Number(feeData.maxPriorityFeePerGas) * 1.3)
          )
        : ethers.parseUnits("1.5", "gwei"),
      type: 2, // EIP-1559 transaction
    };

    // Ensure maxPriorityFeePerGas <= maxFeePerGas
    if (tx.maxPriorityFeePerGas > tx.maxFeePerGas) {
      tx.maxPriorityFeePerGas = tx.maxFeePerGas;
    }

    console.log("Transaction data:", {
      from: tx.from,
      to: tx.to,
      value: tx.value.toString(),
      gasLimit: tx.gasLimit.toString(),
      maxFeePerGas: tx.maxFeePerGas.toString(),
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas.toString(),
      dataLength: tx.data.length,
    });

    console.log("Sending transaction...");

    const depositTx = await wallet.sendTransaction(tx);
    console.log("Transaction hash:", depositTx.hash);
  } catch (error) {
    console.error("Error in deposit process:", error);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
  }
}

withdrawUSDCFromAaveOnArbitrum();
