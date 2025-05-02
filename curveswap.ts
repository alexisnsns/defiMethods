// SWAP USDC TO ETH on CURVE
import { ethers } from "ethers";
import dotenv from "dotenv";
import {
  BASE_CHAIN_ID,
  BASE_RPC_URL,
  USDC_ADDRESS_BASE,
  CURVE_USDC_POOL_ADDRESS,
  ERC20_ABI,
} from "./resources.js";
dotenv.config();

export function generateSwapCallData() {
  const decimals = 6; // USDC decimals
  const amount = "0.5";
  const tokenAmount = ethers.parseUnits(amount, decimals);

  const CURVE_POOL_ABI =
    "function exchange(uint256 i, uint256 j, uint256 dx, uint256 min_dy) external payable returns (uint256)";
  const curveInterface = new ethers.Interface([CURVE_POOL_ABI]);

  const swapUSDCtoETHcallData = curveInterface.encodeFunctionData("exchange", [
    0,
    1,
    tokenAmount,
    0,
  ]);
  return swapUSDCtoETHcallData;
}

async function swapUSDCtoETHonCrv() {
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

    const USDCaddress = new ethers.Contract(
      USDC_ADDRESS_BASE, // source token
      ERC20_ABI,
      wallet
    );

    try {
      const depositAmount = ethers.parseUnits("1", 6);

      const approveTx = await USDCaddress.approve(
        CURVE_USDC_POOL_ADDRESS,
        depositAmount,
        {
          gasLimit: 300000, // Set a higher gas limit for the approval
        }
      );
      console.log("Approval transaction submitted:", approveTx.hash);
      await approveTx.wait();
      console.log("Approval successful!");
    } catch (error) {
      console.error("Error approving USDC:", error);
      throw new Error("Failed to approve USDC for crv swap");
    }

    // Generate initial message for fee estimation
    const callData = generateSwapCallData();

    console.log("Generated CallData:", callData);

    const feeData = await provider.getFeeData();

    // Create transaction with the final data
    const tx = {
      to: CURVE_USDC_POOL_ADDRESS,
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

swapUSDCtoETHonCrv();
