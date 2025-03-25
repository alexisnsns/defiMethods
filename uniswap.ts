// SWAP USDC TO ETH on UNISWAP
import { ethers } from "ethers";
import dotenv from "dotenv";
import {
  ARBITRUM_CHAIN_ID,
  ARBITRUM_RPC_URL,
  USDC_ADDRESS_ARBITRUM,
  UNISWAP_V3_POOL_ADDRESS,
  WETH_ADDRESS_ARBITRUM,
  UNISWAP_V3_UNIVERSAL_ROUTER,
  ERC20_ABI,
} from "./resources.js";
dotenv.config();
import BigNumber from "bignumber.js";

export function generateSwapCallData() {
  const tokenAmount = new BigNumber("0.5").times(new BigNumber(10).pow(6)); // 0.5 USDC with 6 decimals

  const UNISWAP_V3_ROUTER_ABI = [
    "function execute(uint256,bytes[],bytes[]) external payable",
  ];

  const routerInterface = new ethers.Interface(UNISWAP_V3_ROUTER_ABI);

  // Path: USDC -> WETH
  const slippageTolerance = 0.01; // 1% slippage tolerance
  const amountOutMin = tokenAmount.times(new BigNumber(1 - slippageTolerance));

  const params = [
    USDC_ADDRESS_ARBITRUM, // tokenIn (USDC address)
    WETH_ADDRESS_ARBITRUM, // tokenOut (WETH address)
    500, // Fee tier (0.3%)
    "0xe19c88086C8d551C81ff8a3e2c5DF87a88110a51", // recipient address
    tokenAmount.toFixed(), // amountIn (USDC to swap)
    amountOutMin.toFixed(), // amountOutMinimum (slippage adjusted)
    0, // sqrtPriceLimitX96 (set to 0 for no price limit)
  ];

  // Encoding the exactInputSingle call data
  const swapCallData = routerInterface.encodeFunctionData(
    "exactInputSingle",
    params
  );

  // Preparing the execute parameters
  const commands = [swapCallData]; // Only one command in this case
  const inputs = []; // No additional inputs for now

  // You can set payableAmount to 0 if you are not sending Ether in the transaction
  const payableAmount = ethers.parseEther("0.0");

  // Encoding the execute function call
  const executeCallData = routerInterface.encodeFunctionData("execute", [
    payableAmount,
    commands,
    inputs,
  ]);

  return executeCallData;
}

async function swapUSDCtoETHonUniswapV3() {
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

    const USDCaddress = new ethers.Contract(
      USDC_ADDRESS_ARBITRUM, // USDC token address
      ERC20_ABI,
      wallet
    );

    try {
      const depositAmount = ethers.parseUnits("1", 6);

      const approveTx = await USDCaddress.approve(
        UNISWAP_V3_UNIVERSAL_ROUTER, // Uniswap V3 Router Address
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
      throw new Error("Failed to approve USDC for swap");
    }

    // Generate the call data for the swap
    const callData = generateSwapCallData();

    console.log("Generated CallData:", callData);

    const feeData = await provider.getFeeData();

    // Create the transaction object with the final data
    const tx = {
      to: UNISWAP_V3_UNIVERSAL_ROUTER, // Uniswap V3 Router address
      from: wallet.address,
      data: callData,
      gasLimit: ethers.toBigInt(2000000),
      value: ethers.toBigInt(0), // Explicitly set to 0 (no ETH needed for the swap)
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
    console.error("Error in swap process:", error);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
  }
}

swapUSDCtoETHonUniswapV3();
