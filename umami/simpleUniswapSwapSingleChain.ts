// DOCUMENTATION: https://www.quicknode.com/guides/defi/dexs/how-to-swap-tokens-on-uniswap-v3
import { ethers } from "ethers";
import FACTORY_ABI from "./abis/factory.json" assert { type: "json" };
import QUOTER_ABI from "./abis/quoter.json" assert { type: "json" };
import SWAP_ROUTER_ABI from "./abis/swaprouter.json" assert { type: "json" };
import POOL_ABI from "./abis/pool.json" assert { type: "json" };
import TOKEN_IN_ABI from "./abis/weth.json" assert { type: "json" };
import dotenv from "dotenv";
dotenv.config();

import {
  ARBITRUM_RPC_URL,
  USDC_ADDRESS_ARBITRUM,
  WETH_ADDRESS_ARBITRUM,
  ARBITRUM_CHAIN_ID,
  USER_ADDRESS,
} from "../resources.js";

// UNISWAP V3 FACTORY
const POOL_FACTORY_CONTRACT_ADDRESS =
  "0x1F98431c8aD98523631AE4a59f267346ea31F984";
// QUOTER V2
const QUOTER_CONTRACT_ADDRESS = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
// swap router 02
const SWAP_ROUTER_CONTRACT_ADDRESS =
  "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";

const { MNEMONIC } = process.env;

// Provider, Contract & wallet Instances
const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
const factoryContract = new ethers.Contract(
  POOL_FACTORY_CONTRACT_ADDRESS,
  FACTORY_ABI,
  provider
);
const quoterContract = new ethers.Contract(
  QUOTER_CONTRACT_ADDRESS,
  QUOTER_ABI,
  provider
);

const wallet = new ethers.Wallet(MNEMONIC, provider);

// Token Configuration
const WETH = {
  chainId: 42161,
  address: WETH_ADDRESS_ARBITRUM,
  decimals: 18,
  symbol: "WETH",
  name: "Wrapped Ether",
  isToken: true,
  isNative: true,
  wrapped: true,
};
const USDC = {
  chainId: 42161,
  address: USDC_ADDRESS_ARBITRUM,
  decimals: 6,
  symbol: "USDC",
  name: "USD//C",
  isToken: true,
  isNative: true,
  wrapped: false,
};

// LOGIC
async function approveToken(tokenAddress: string, tokenABI, amount, wallet) {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, tokenABI, wallet);

    const approveTransaction = await tokenContract.approve.populateTransaction(
      SWAP_ROUTER_CONTRACT_ADDRESS,
      ethers.parseEther(amount.toString())
    );

    const transactionResponse = await wallet.sendTransaction(
      approveTransaction
    );
    console.log(`-------------------------------`);
    console.log(`Sending Approval Transaction...`);
    console.log(`-------------------------------`);
    console.log(`Transaction Sent: ${transactionResponse.hash}`);
    console.log(`-------------------------------`);
    const receipt = await transactionResponse.wait();
    console.log(`Approval Transaction Confirmed! txHash: ${receipt.hash}`);
  } catch (error) {
    console.error("An error occurred during token approval:", error);
    throw new Error("Token approval failed");
  }
}

async function getPoolInfo(factoryContract, tokenIn, tokenOut) {
  const poolAddress = await factoryContract.getPool(
    tokenIn.address,
    tokenOut.address,
    // TODO: wat means 3000?
    3000
  );
  if (!poolAddress) {
    throw new Error("Failed to get pool address");
  }
  const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);
  const [token0, token1, fee] = await Promise.all([
    poolContract.token0(),
    poolContract.token1(),
    poolContract.fee(),
  ]);
  return { poolContract, token0, token1, fee };
}

async function quoteAndLogSwap(
  quoterContract,
  fee: bigint,
  wallet,
  amountIn: bigint
) {
  const quotedAmountOut = await quoterContract.quoteExactInputSingle.staticCall(
    {
      tokenIn: USDC.address,
      tokenOut: WETH.address,
      fee: fee,
      recipient: wallet.address,
      deadline: Math.floor(new Date().getTime() / 1000 + 60 * 10),
      amountIn: amountIn,
      sqrtPriceLimitX96: 0,
    }
  );
  console.log(`-------------------------------`);
  console.log(
    `Token Swap will result in: ${ethers.formatUnits(
      quotedAmountOut[0].toString(),
      WETH.decimals
    )} ${WETH.symbol} for ${ethers.formatUnits(
      amountIn.toString(),
      USDC.decimals
    )} ${USDC.symbol}`
  );
  const amountOut = ethers.formatUnits(quotedAmountOut[0], WETH.decimals);
  return amountOut;
}

async function prepareSwapParams(poolContract, wallet, amountIn, amountOut) {
  return {
    tokenIn: USDC.address,
    tokenOut: WETH.address,
    fee: await poolContract.fee(),
    recipient: wallet.address,
    amountIn: amountIn,
    amountOutMinimum: amountOut,
    sqrtPriceLimitX96: 0,
  };
}

async function executeSwap(swapRouter, params, wallet) {
  const transaction = await swapRouter.exactInputSingle.populateTransaction(
    params
  );

  const feeData = await provider.getFeeData();

  // Create transaction with the final data
  const tx = {
    to: SWAP_ROUTER_CONTRACT_ADDRESS,
    data: transaction.data,
    gasLimit: ethers.toBigInt(2000000),
    value: ethers.toBigInt(0), // Explicitly set to 0
    chainId: parseInt(ARBITRUM_CHAIN_ID),
    maxFeePerGas: feeData.maxFeePerGas
      ? ethers.toBigInt(Math.floor(Number(feeData.maxFeePerGas) * 1.3))
      : ethers.parseUnits("5", "gwei"),
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
      ? ethers.toBigInt(Math.floor(Number(feeData.maxPriorityFeePerGas) * 1.3))
      : ethers.parseUnits("1.5", "gwei"),
    type: 2, // EIP-1559 transaction
  };

  // Ensure maxPriorityFeePerGas <= maxFeePerGas
  if (tx.maxPriorityFeePerGas > tx.maxFeePerGas) {
    tx.maxPriorityFeePerGas = tx.maxFeePerGas;
  }

  const receipt = await wallet.sendTransaction(tx);
  console.log(`-------------------------------`);
  console.log(`Tx hash execute swap--> ${receipt.hash}`);
  console.log(`-------------------------------`);
  // HERE: how to replicate in accross?
  await receipt.wait();
  return receipt;
}

async function unwrapWETH() {
  try {
    const wethContract = new ethers.Contract(
      WETH_ADDRESS_ARBITRUM,
      TOKEN_IN_ABI,
      wallet
    );
    // Get current WETH balance
    const wethBalance = await wethContract.balanceOf(USER_ADDRESS);

    if (wethBalance === 0n) {
      console.log("No WETH to unwrap.");
      return;
    }

    console.log(`Unwrapping ${ethers.formatEther(wethBalance)} WETH to ETH...`);

    const tx = await wethContract.withdraw(wethBalance);
    console.log("Transaction hash:", tx.hash);

    await tx.wait(); // Wait for confirmation
    console.log("WETH successfully unwrapped to ETH!");
  } catch (error) {
    console.error("Error unwrapping WETH:", error);
  }
}

async function main(swapAmount) {
  const inputAmount = swapAmount;
  const amountIn = ethers.parseUnits(inputAmount.toString(), USDC.decimals);

  try {
    await approveToken(USDC.address, TOKEN_IN_ABI, amountIn, wallet);
    const { poolContract, token0, token1, fee } = await getPoolInfo(
      factoryContract,
      USDC,
      WETH
    );
    console.log(`-------------------------------`);
    console.log(`Fetching Quote for: ${USDC.symbol} to ${WETH.symbol}`);
    console.log(`-------------------------------`);
    console.log(`Swap Amount: ${ethers.formatEther(amountIn)}`);

    const quotedAmountOut = await quoteAndLogSwap(
      quoterContract,
      fee,
      wallet,
      amountIn
    );

    const params = await prepareSwapParams(
      poolContract,
      wallet,
      amountIn,
      quotedAmountOut[0].toString()
    );
    const swapRouter = new ethers.Contract(
      SWAP_ROUTER_CONTRACT_ADDRESS,
      SWAP_ROUTER_ABI,
      wallet
    );
    const receipt = await executeSwap(swapRouter, params, wallet);
    await unwrapWETH();
  } catch (error) {
    console.error("An error occurred:", error.message);
  }
}

main(0.01);
