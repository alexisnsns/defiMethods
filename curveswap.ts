// SWAP IBT TO PT ON CURVE
import { ethers } from "ethers";
import dotenv from "dotenv";
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
} from "./resources.js";
dotenv.config();

export function generateSwapCallData(
  userAddress: string,
  withdrawAmount,
  depositCurrency: string
) {
  const CURVE_POOL_ABI =
    "function exchange(uint256 i, uint256 j, uint256 dx, uint256 min_dy) external payable returns (uint256)";
  const curveInterface = new ethers.Interface([CURVE_POOL_ABI]);

  const swapIBTtoPTcallData = curveInterface.encodeFunctionData("exchange", [
    0,
    1,
    "500000",
    0,
  ]);
  return swapIBTtoPTcallData;
}

async function swapIBTtoPTonCurve() {
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

    const IBTaddress = new ethers.Contract(
      IBT_SPECTRA, // source token
      ERC20_ABI,
      wallet
    );

    try {
      const depositAmount = ethers.parseUnits("1", 6);

      const approveTx = await IBTaddress.approve(
        CURVE_POOL_ADDRESS,
        depositAmount,
        {
          gasLimit: 300000, // Set a higher gas limit for the approval
        }
      );
      console.log("Approval transaction submitted:", approveTx.hash);
      await approveTx.wait();
      console.log("Approval successful!");
    } catch (error) {
      console.error("Error approving IBT:", error);
      throw new Error("Failed to approve IBT for Across Bridge");
    }

    const decimals = 6; // USDC decimals
    const withdrawAmountHuman = "0.485";
    const withdrawAmount = ethers.parseUnits(withdrawAmountHuman, decimals);

    // Generate initial message for fee estimation
    const callData = generateSwapCallData(
      userAddress,
      withdrawAmount,
      IBT_SPECTRA
    );

    console.log("Generated CallData:", callData);

    const feeData = await provider.getFeeData();

    // Create transaction with the final data
    const tx = {
      to: CURVE_POOL_ADDRESS,
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

swapIBTtoPTonCurve();
