import { ethers } from "ethers";
import fetch from "node-fetch";
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
  ERC20_ABI,
  DEPOSIT_V3_SELECTOR,
  UNIQUE_IDENTIFIER,
  DELIMITER,
  ACROSS_SPOKEPOOL_ADDRESS_ARBITRUM,
  ACROSS_SPOKEPOOL_ADDRESS_BASE,
  MORPHO_VAULT_ADDRESS_BASE,
  MULTICALL_HANDLER_ADDRESS,
  AAVE_POOL_ADDRESS_ARBITRUM,
  PT_TOKEN_SPECTRA,
} from "./resources.js";

export function generateWithdrawCallData(
  userAddress: string,
  aaveAddress: string,
  withdrawAmount,
  depositCurrency: string
) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const ABI = [
    "function withdraw(address asset, uint256 amount, address to) external returns (uint256)",
  ];

  const aaveInterface = new ethers.Interface(ABI);

  withdrawAmount = ethers.toBigInt(withdrawAmount);

  const withdrawCalldata = aaveInterface.encodeFunctionData("withdraw", [
    depositCurrency,
    withdrawAmount,
    userAddress,
  ]);

  return withdrawCalldata;
}

async function withdrawUSDCFromAaveOnArbitrum() {
  try {
    const { MNEMONIC } = process.env;

    const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
    const network = await provider.getNetwork();
    console.log("Connected to network:", {
      chainId: network.chainId,
      name: network.name,
    });

    const wallet = new ethers.Wallet(MNEMONIC, provider);
    const userAddress = await wallet.getAddress();

    console.log(`Connected with wallet address: ${userAddress}`);

    const decimals = 6; // USDC decimals
    const withdrawAmountHuman = "0.5";
    const withdrawAmount = ethers.parseUnits(withdrawAmountHuman, decimals);

    // Generate initial message for fee estimation
    const callData = generateWithdrawCallData(
      userAddress,
      AAVE_POOL_ADDRESS_ARBITRUM,
      withdrawAmount,
      USDC_ADDRESS_ARBITRUM // Use Arbitrum USDC address for the deposit on Aave
    );

    console.log("Generated CallData:", callData);

    // TEST
    // const ABI = [
    //   "function withdraw(address asset, uint256 amount, address to) external returns (uint256)",
    // ];
    // const lendingPool = new ethers.Contract(AAVE_POOL_ADDRESS_ARBITRUM, ABI, wallet);
    // const testCallData = lendingPool.interface.encodeFunctionData("withdraw", [
    //   USDC_ADDRESS_ARBITRUM,
    //   withdrawAmount,
    //   userAddress,
    // ]);
    // console.log("Correct CallData:", testCallData);
    // END TEST

    const feeData = await provider.getFeeData();

    // Create transaction with the final data
    const tx = {
      to: AAVE_POOL_ADDRESS_ARBITRUM,
      from: wallet.address,
      data: callData,
      gasLimit: ethers.toBigInt(2000000),
      value: ethers.toBigInt(0), // Explicitly set to 0
      chainId: Number(ARBITRUM_CHAIN_ID),
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
