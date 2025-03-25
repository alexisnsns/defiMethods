import { constructSimpleSDK } from "@paraswap/sdk";
import axios from "axios";
import { ethers } from "ethers";

import BigNumber from "bignumber.js";
import { OptimalRate, SwapSide, ParaSwapVersion } from "@paraswap/core";
import {
  ARBITRUM_RPC_URL,
  USDC_ADDRESS_ARBITRUM,
  WETH_ADDRESS_ARBITRUM,
  USER_ADDRESS,
  PARASWAP_SPENDER_ADDRESS,
  ARBITRUM_CHAIN_ID,
} from "./resources.js";
import dotenv from "dotenv";
dotenv.config();

const PARTNER = "chucknorrisv6";
const SLIPPAGE = 1;
const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);

interface MinTokenData {
  decimals: number;
  symbol: string;
  address: string;
}

const tokens: Record<number, MinTokenData[]> = {
  [ARBITRUM_CHAIN_ID]: [
    {
      decimals: 18,
      symbol: "WETH",
      address: WETH_ADDRESS_ARBITRUM,
    },
    {
      decimals: 6,
      symbol: "USDC",
      address: USDC_ADDRESS_ARBITRUM,
    },
  ],
};

function getToken(symbol: Symbol, networkID = ARBITRUM_CHAIN_ID): MinTokenData {
  const token = tokens[networkID]?.find((t) => t.symbol === symbol);

  if (!token)
    throw new Error(`Token ${symbol} not available on network ${networkID}`);
  return token;
}

/**
 * @type ethereum address
 */
type Address = string;
/**
 * @type Token symbol
 */
type Symbol = string;
/**
 * @type number as string
 */
type NumberAsString = string;

interface TransactionParams {
  to: Address;
  from: Address;
  value: NumberAsString;
  data: string;
  gasPrice: NumberAsString;
  gas?: NumberAsString;
  chainId: number;
}

interface Swapper {
  getRate(params: {
    srcToken: Pick<MinTokenData, "address" | "decimals">;
    destToken: Pick<MinTokenData, "address" | "decimals">;
    srcAmount: NumberAsString;
    userAddress: Address;
    partner?: string;
  }): Promise<OptimalRate>;
  buildSwap(params: {
    srcToken: Pick<MinTokenData, "address" | "decimals">;
    destToken: Pick<MinTokenData, "address" | "decimals">;
    srcAmount: NumberAsString;
    minAmount: NumberAsString;
    priceRoute: OptimalRate;
    userAddress: Address;
    receiver?: Address;
    partner?: string;
  }): Promise<TransactionParams>;
}

function createSwapper(networkID: number, apiURL?: string): Swapper {
  const paraswap = constructSimpleSDK(
    {
      chainId: networkID,
      apiURL,
      axios,
      version: ParaSwapVersion.V6,
    },
    {
      // Signer when itneted to sign tx, provider for read calls only
      ethersProviderOrSigner: provider,
      EthersContract: ethers.Contract,
      account: USER_ADDRESS,
    }
  );

  const getRate: Swapper["getRate"] = async ({
    srcToken,
    destToken,
    srcAmount,
    userAddress,
    partner = PARTNER,
  }) => {
    const priceRoute = await paraswap.swap.getRate({
      srcToken: srcToken.address,
      destToken: destToken.address,
      srcDecimals: srcToken.decimals,
      destDecimals: destToken.decimals,
      amount: srcAmount,
      side: SwapSide.SELL,
      options: { partner },
    });

    return priceRoute;
  };

  const buildSwap: Swapper["buildSwap"] = async ({
    srcToken,
    destToken,
    srcAmount,
    minAmount,
    priceRoute,
    userAddress,
    receiver,
    partner,
  }) => {
    const transactionRequest = await paraswap.swap.buildTx({
      srcToken: srcToken.address,
      destToken: destToken.address,
      srcAmount,
      userAddress,
      partner,
      receiver,
      priceRoute,
      slippage: SLIPPAGE,
    });

    return transactionRequest;
  };

  return { getRate, buildSwap };
}

interface GetSwapTxInput {
  srcToken: Symbol;
  destToken: Symbol;
  srcAmount: NumberAsString; // in srcToken denomination
  networkID: number;
  slippage?: number;
  partner?: string;
  userAddress: Address;
  receiver?: Address;
}

export async function getSwapTransaction({
  srcToken: srcTokenSymbol,
  destToken: destTokenSymbol,
  srcAmount: _srcAmount,
  networkID,
  slippage = SLIPPAGE,
  userAddress,
  ...rest
}: GetSwapTxInput): Promise<TransactionParams> {
  try {
    const srcToken = getToken(srcTokenSymbol, networkID);
    const destToken = getToken(destTokenSymbol, networkID);

    // console.log(srcToken, destToken);
    const srcAmount = new BigNumber(_srcAmount)
      .times(10 ** srcToken.decimals)
      .toFixed(0);

    const ps = createSwapper(networkID);

    const priceRoute = await ps.getRate({
      srcToken,
      destToken,
      srcAmount,
      userAddress,
    });

    const minAmount = new BigNumber(priceRoute.destAmount)
      .times(1 - slippage / 100)
      .toFixed(0);

    const transactionRequest = await ps.buildSwap({
      srcToken,
      destToken,
      srcAmount,
      minAmount,
      priceRoute,
      userAddress,
      ...rest,
    });

    return transactionRequest;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
export const getExampleSwapTransaction = async () => {
  await ensureUSDCApproval();
  const callData = await getSwapTransaction({
    srcAmount: "0.5",
    srcToken: "USDC",
    destToken: "WETH",
    networkID: ARBITRUM_CHAIN_ID,
    userAddress: USER_ADDRESS,
  });

  console.log("🚀 Swap Call Data:", callData);

  const feeData = await provider.getFeeData();

  const tx = {
    to: PARASWAP_SPENDER_ADDRESS, // Updated to the ParaSwap router address
    data: callData.data,
    gasLimit: ethers.toBigInt(2000000),
    value: ethers.toBigInt(0), // Explicitly set to 0 (no ETH involved)
    chainId: parseInt(ARBITRUM_CHAIN_ID),
    maxFeePerGas: feeData.maxFeePerGas
      ? ethers.toBigInt(Math.floor(Number(feeData.maxFeePerGas) * 1.3))
      : ethers.parseUnits("5", "gwei"),
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
      ? ethers.toBigInt(Math.floor(Number(feeData.maxPriorityFeePerGas) * 1.3))
      : ethers.parseUnits("1.5", "gwei"),
    type: 2, // EIP-1559 transaction
  };

  if (tx.maxPriorityFeePerGas > tx.maxFeePerGas) {
    tx.maxPriorityFeePerGas = tx.maxFeePerGas;
  }
  console.log("Transaction data:", {
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
};

/**
 * Ensures USDC approval for ParaSwap
 */

// ERC20 ABI for approve + allowance
const ERC20_ABI = [
  "function approve(address spender, uint256 value) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

const { MNEMONIC } = process.env;
const wallet = new ethers.Wallet(MNEMONIC, provider);

const ensureUSDCApproval = async () => {
  // Swap amount (0.5 USDC)
  const SWAP_AMOUNT_USDC = "0.5";
  const SWAP_AMOUNT_WEI = ethers.parseUnits(SWAP_AMOUNT_USDC, 6);
  const usdcContract = new ethers.Contract(
    USDC_ADDRESS_ARBITRUM,
    ERC20_ABI,
    wallet
  );

  // Check allowance first
  const currentAllowance = await usdcContract.allowance(
    USER_ADDRESS,
    PARASWAP_SPENDER_ADDRESS
  );
  if (BigNumber(currentAllowance.toString()).gte(SWAP_AMOUNT_WEI.toString())) {
    console.log("✅ USDC already approved. Skipping approval.");
    return;
  }

  console.log("🔄 Approving USDC for ParaSwap...");
  const approveTx = await usdcContract.approve(
    PARASWAP_SPENDER_ADDRESS,
    SWAP_AMOUNT_WEI
  );
  await approveTx.wait();
  console.log("✅ USDC approval confirmed:", approveTx.hash);
};

getExampleSwapTransaction();
