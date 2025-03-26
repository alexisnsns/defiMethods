// bridge base usdc to arbitrum
// approve paraswap spend
// swap usdc to weth on paraswap

// unwrap weth to eth
// approve umami spend
// deposit to umami (edited)

import { API_URL, constructSimpleSDK } from "@paraswap/sdk";
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
  BASE_CHAIN_ID,
  BASE_RPC_URL,
  USDC_ADDRESS_BASE,
  USDT_ADDRESS_ARBITRUM,
  ERC20_ABI,
  DEPOSIT_V3_SELECTOR,
  UNIQUE_IDENTIFIER,
  DELIMITER,
  ACROSS_SPOKEPOOL_ADDRESS_BASE,
  MULTICALL_HANDLER_ADDRESS,
  UMAMI_WETH_VAULT_ADDRESS_ARB,
} from "./resources.js";

import dotenv from "dotenv";
dotenv.config();

const SLIPPAGE = 1;
const arbProvider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
const baseProvider = new ethers.JsonRpcProvider(BASE_RPC_URL);

// ERC20 ABI for approve + allowance
const ERC20_ABI = [
  "function approve(address spender, uint256 value) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function withdraw(uint256 amount) public",
  "function balanceOf(address owner) view returns (uint256)",
];

const { MNEMONIC } = process.env;
const arbWallet = new ethers.Wallet(MNEMONIC, arbProvider);
const baseWallet = new ethers.Wallet(MNEMONIC, baseProvider);

const wethContract = new ethers.Contract(
  WETH_ADDRESS_ARBITRUM,
  ERC20_ABI,
  arbWallet
);

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
      symbol: "USDT",
      address: USDT_ADDRESS_ARBITRUM,
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
  console.log("URL URL", apiURL);
  const paraswap = constructSimpleSDK(
    {
      chainId: networkID,
      apiURL,
      axios,
      version: ParaSwapVersion.V6,
    },
    {
      // Signer when itneted to sign tx, provider for read calls only
      ethersProviderOrSigner: arbProvider,
      EthersContract: ethers.Contract,
      account: USER_ADDRESS,
    }
  );

  const getRate: Swapper["getRate"] = async ({
    srcToken,
    destToken,
    srcAmount,
    userAddress,
    partner = "SBF",
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
    userAddress,
    priceRoute,
    partner = "SBF",
  }) => {
    try {
      const url = `https://api.paraswap.io/transactions/${networkID}/`;

      const requestData = {
        srcToken: srcToken.address,
        destToken: destToken.address,
        srcAmount,
        userAddress,
        priceRoute,
        slippage: SLIPPAGE,
        partner,
        ignoreChecks: true,
      };

      console.log("Sending buildSwap request to Paraswap:", url, requestData);

      const response = await axios.post(url, requestData, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("Response from Paraswap buildSwap:", response.data);
      return response.data;
    } catch (error) {
      console.error(
        "Error in buildSwap:",
        error.response?.data || error.message
      );
      throw error;
    }
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

/**
 * Ensures USDC approval for ParaSwap
 */
// const ensureUSDCApproval = async () => {
//   // Swap amount (0.5 USDC)
//   const SWAP_AMOUNT_USDC = "0.5";
//   const SWAP_AMOUNT_WEI = ethers.parseUnits(SWAP_AMOUNT_USDC, 6);
//   const usdcContract = new ethers.Contract(
//     USDC_ADDRESS_ARBITRUM,
//     ERC20_ABI,
//     wallet
//   );

//   // Check allowance first
//   const currentAllowance = await usdcContract.allowance(
//     USER_ADDRESS,
//     PARASWAP_SPENDER_ADDRESS
//   );
//   if (BigNumber(currentAllowance.toString()).gte(SWAP_AMOUNT_WEI.toString())) {
//     console.log("✅ USDC already approved. Skipping approval.");
//     return;
//   }

//   console.log("🔄 Approving USDC for ParaSwap...");
//   const approveTx = await usdcContract.approve(
//     PARASWAP_SPENDER_ADDRESS,
//     SWAP_AMOUNT_WEI
//   );
//   await approveTx.wait();
//   console.log("✅ USDC approval confirmed:", approveTx.hash);
// };

// async function unwrapWETH() {
//   try {
//     // Get current WETH balance
//     const wethBalance = await wethContract.balanceOf(USER_ADDRESS);

//     if (wethBalance === 0n) {
//       console.log("No WETH to unwrap.");
//       return;
//     }

//     console.log(`Unwrapping ${ethers.formatEther(wethBalance)} WETH to ETH...`);

//     const tx = await wethContract.withdraw(wethBalance);
//     console.log("Transaction hash:", tx.hash);

//     await tx.wait(); // Wait for confirmation
//     console.log("WETH successfully unwrapped to ETH!");
//   } catch (error) {
//     console.error("Error unwrapping WETH:", error);
//   }
// }

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

    console.log("tx request", transactionRequest);
    return transactionRequest;
  } catch (error) {
    console.error(error);
  }
}

export const swapUSDCtoETH = async () => {
  // await ensureUSDCApproval();
  const callData = await getSwapTransaction({
    srcAmount: "0.5",
    srcToken: "USDC",
    destToken: "USDT",
    networkID: ARBITRUM_CHAIN_ID,
    userAddress: USER_ADDRESS,
  });

  console.log("call data", callData);
};

swapUSDCtoETH();
