import { ethers } from "ethers";
import { Token } from "@uniswap/sdk-core";
import { Pool, Route, FeeAmount, Trade } from "@uniswap/v3-sdk";
import {
  ARBITRUM_CHAIN_ID,
  ARBITRUM_RPC_URL,
  USDC_ADDRESS_ARBITRUM,
  WETH_ADDRESS_ARBITRUM,
  UNISWAP_V3_UNIVERSAL_ROUTER,
  ERC20_ABI,
  UNISWAP_V3_USDC_WETH_POOL_ADDRESS,
  POOL_ABI,
  USER_ADDRESS,
} from "./resources.js";
import { CurrencyAmount, TradeType } from "@uniswap/sdk-core";
import { SwapRouter } from "@uniswap/v3-sdk";
import { SwapOptions } from "@uniswap/v3-sdk";
import { Percent } from "@uniswap/sdk-core";
import dotenv from "dotenv";
dotenv.config();
import { TickMath } from "@uniswap/v3-sdk";

const { MNEMONIC } = process.env;
const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
const wallet = new ethers.Wallet(MNEMONIC, provider);

const poolContract = new ethers.Contract(
  UNISWAP_V3_USDC_WETH_POOL_ADDRESS,
  POOL_ABI,
  provider
);

async function getPoolInfo() {
  const [fee, liquidity, slot0] = await Promise.all([
    poolContract.fee(),
    poolContract.liquidity(),
    poolContract.slot0(),
  ]);

  return {
    fee,
    liquidity,
    sqrtPriceX96: slot0[0],
    tick: slot0[1],
  };
}

const poolInfo = await getPoolInfo();

console.log("sqrtPriceX96:", poolInfo.sqrtPriceX96.toString());
console.log("tick:", poolInfo.tick.toString());

const USDC = new Token(42161, USDC_ADDRESS_ARBITRUM, 6, "USDC", "USD Coin");

const WETH = new Token(
  42161,
  WETH_ADDRESS_ARBITRUM,
  18,
  "WETH",
  "Wrapped Ether"
);

const pool = new Pool(
  USDC,
  WETH,
  FeeAmount.LOW,
  poolInfo.sqrtPriceX96.toString(),
  poolInfo.liquidity.toString(),
  poolInfo.tick
);

const swapRoute = new Route([pool], USDC, WETH);

async function approveUSDCtoETHonUniswapV3() {
  try {
    const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
    const network = await provider.getNetwork();
    console.log("Connected to network:", {
      chainId: network.chainId,
      name: network.name,
    });

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
  } catch (error) {
    console.error("Error in swap process:", error);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
  }
}

approveUSDCtoETHonUniswapV3();

const options: SwapOptions = {
  slippageTolerance: new Percent(50, 10_000), // 50 bips, or 0.50%
  deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes from the current Unix time
  recipient: USER_ADDRESS,
};

const uncheckedTrade = Trade.createUncheckedTrade({
  route: swapRoute,
  inputAmount: CurrencyAmount.fromRawAmount(USDC, "0.1"),
  outputAmount: CurrencyAmount.fromRawAmount(WETH, "0"),
  tradeType: TradeType.EXACT_INPUT,
});

const methodParameters = SwapRouter.swapCallParameters(
  [uncheckedTrade],
  options
);

const feeData = await provider.getFeeData();

const tx = {
  data: methodParameters.calldata,
  to: UNISWAP_V3_UNIVERSAL_ROUTER,
  value: methodParameters.value,
  from: USER_ADDRESS,
  maxFeePerGas: feeData.maxFeePerGas
    ? ethers.toBigInt(Math.floor(Number(feeData.maxFeePerGas) * 1.3))
    : ethers.parseUnits("5", "gwei"),
  maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
    ? ethers.toBigInt(Math.floor(Number(feeData.maxPriorityFeePerGas) * 1.3))
    : ethers.parseUnits("1.5", "gwei"),
};

const res = await wallet.sendTransaction(tx);
