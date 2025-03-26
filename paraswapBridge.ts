// bridge base usdc to arbitrum
// approve paraswap spend
// swap usdc to weth on paraswap

// unwrap weth to eth
// approve umami spend
// deposit to umami (edited)

import { constructSimpleSDK } from "@paraswap/sdk";
import axios from "axios";
import { ethers } from "ethers";

import BigNumber from "bignumber.js";
import { OptimalRate, SwapSide, ParaSwapVersion } from "@paraswap/core";
import {
  ARBITRUM_RPC_URL,
  USDC_ADDRESS_ARBITRUM,
  WETH_ADDRESS_ARBITRUM,
  USDT_ADDRESS_ARBITRUM,
  USER_ADDRESS,
  PARASWAP_SPENDER_ADDRESS,
  ARBITRUM_CHAIN_ID,
  BASE_CHAIN_ID,
  BASE_RPC_URL,
  USDC_ADDRESS_BASE,
  ERC20_ABI,
  DEPOSIT_V3_SELECTOR,
  UNIQUE_IDENTIFIER,
  DELIMITER,
  ACROSS_SPOKEPOOL_ADDRESS_BASE,
  MULTICALL_HANDLER_ADDRESS,
  // UMAMI_WETH_VAULT_ADDRESS_ARB,
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

// const wethContract = new ethers.Contract(
//   WETH_ADDRESS_ARBITRUM,
//   ERC20_ABI,
//   arbWallet
// );

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
  }): Promise<OptimalRate>;
  buildSwap(params: {
    srcToken: Pick<MinTokenData, "address" | "decimals">;
    destToken: Pick<MinTokenData, "address" | "decimals">;
    srcAmount: NumberAsString;
    minAmount: NumberAsString;
    priceRoute: OptimalRate;
    userAddress: Address;
    receiver?: Address;
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
  }) => {
    const priceRoute = await paraswap.swap.getRate({
      srcToken: srcToken.address,
      destToken: destToken.address,
      srcDecimals: srcToken.decimals,
      destDecimals: destToken.decimals,
      amount: srcAmount,
      userAddress: userAddress,
      side: SwapSide.SELL,
    });

    console.log("PRICE ROUTE IS", priceRoute);

    return priceRoute;
  };

  const buildSwap: Swapper["buildSwap"] = async ({
    srcToken,
    destToken,
    srcAmount,
    userAddress,
    priceRoute,
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
        ignoreChecks: true,
      };

      const response = await axios.post(url, requestData, {
        headers: {
          "Content-Type": "application/json",
        },
      });

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
  srcAmount,
  networkID,
  slippage = SLIPPAGE,
  userAddress,
  ...rest
}: GetSwapTxInput): Promise<TransactionParams> {
  
  try {
    const srcToken = getToken(srcTokenSymbol, networkID);
    const destToken = getToken(destTokenSymbol, networkID);

    const amount = srcAmount.toString();
    const ps = createSwapper(networkID);

    const priceRoute = await ps.getRate({
      srcToken,
      destToken,
      srcAmount: amount,
      userAddress: USER_ADDRESS,
    });

    const minAmount = new BigNumber(priceRoute.destAmount)
      .times(1 - slippage / 100)
      .toFixed(0);

    const transactionRequest = await ps.buildSwap({
      srcToken,
      destToken,
      srcAmount: amount,
      minAmount,
      priceRoute,
      userAddress: USER_ADDRESS,
      ...rest,
    });

    console.log("Paraswap CALLDATA", transactionRequest);
    return transactionRequest;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// export const swapUSDCtoETH = async () => {
//   // await ensureUSDCApproval();
//   const callData = await getSwapTransaction({
//     srcAmount: "0.5",
//     srcToken: "USDC",
//     destToken: "WETH",
//     networkID: ARBITRUM_CHAIN_ID,
//     userAddress: USER_ADDRESS,
//   });

//   const feeData = await provider.getFeeData();

//   const tx = {
//     to: PARASWAP_SPENDER_ADDRESS,
//     data: callData.data,
//     gasLimit: ethers.toBigInt(2000000),
//     value: ethers.toBigInt(0),
//     chainId: parseInt(ARBITRUM_CHAIN_ID),
//     maxFeePerGas: feeData.maxFeePerGas
//       ? ethers.toBigInt(Math.floor(Number(feeData.maxFeePerGas) * 1.3))
//       : ethers.parseUnits("5", "gwei"),
//     maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
//       ? ethers.toBigInt(Math.floor(Number(feeData.maxPriorityFeePerGas) * 1.3))
//       : ethers.parseUnits("1.5", "gwei"),
//     type: 2,
//   };

//   if (tx.maxPriorityFeePerGas > tx.maxFeePerGas) {
//     tx.maxPriorityFeePerGas = tx.maxFeePerGas;
//   }
//   console.log("Transaction data:", {
//     to: tx.to,
//     value: tx.value.toString(),
//     gasLimit: tx.gasLimit.toString(),
//     maxFeePerGas: tx.maxFeePerGas.toString(),
//     maxPriorityFeePerGas: tx.maxPriorityFeePerGas.toString(),
//     dataLength: tx.data.length,
//   });

//   console.log("Sending transaction...");

//   const depositTx = await wallet.sendTransaction(tx);
//   console.log("Transaction hash:", depositTx.hash);

//   // wait for confirmation
//   await depositTx.wait();
//   console.log("✅ Swap completed! Now unwrapping WETH...");

//   await unwrapWETH();
// };

// BELOW ORIGIN CODE

// Generate message for Multicall Handler

async function generateMessageForMulticallHandler(
  userAddress,
  paraswapAddress,
  depositAmount,
  depositCurrency
) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  // ABI
  const approveFunction = "function approve(address spender, uint256 value)";
  // const approveFunction =
  //   "function approve(address spender, uint256 value) external returns (bool)";

  // const depositFunction =
  //   "function deposit(uint256 assets, uint256 minOutAfterFees, address receiver) external returns (uint256 shares)";

  const erc20Interface = new ethers.Interface([approveFunction]);
  // const defiInterface = new ethers.Interface([depositFunction]);

  const approveCalldata = erc20Interface.encodeFunctionData("approve", [
    paraswapAddress,
    depositAmount,
  ]);

  // const feeRate = BigInt(20); // 0.15% as basis points (15 / 10000)
  // const feeDenominator = BigInt(10000); // 100% = 10000 BPS

  // const minOutAfterFees =
  //   depositAmount - (depositAmount * feeRate) / feeDenominator;

  // console.log("Deposit Amount:", depositAmount.toString());
  // console.log("Min Out After Fees:", minOutAfterFees.toString());

  // const ethAmount = ethers.parseEther("0.0005");

  const swapCallData = await getSwapTransaction({
    srcToken: "USDC",
    destToken: "USDT",
    srcAmount: "100000",
    networkID: ARBITRUM_CHAIN_ID,
    slippage: SLIPPAGE,
    userAddress: USER_ADDRESS,
  });


  // const depositCalldata = defiInterface.encodeFunctionData("deposit", [
  //   depositAmount,
  //   minOutAfterFees,
  //   userAddress,
  // ]);

  //instructions
  const instructions = [
    // Approve paraswap arb USDC spending
    {
      target: depositCurrency,
      callData: approveCalldata,
      value: 0,
    },
    // swap arb USDC to WETH on paraswap
    {
      target: PARASWAP_SPENDER_ADDRESS,
      callData: swapCallData.data,
      value: 0,
    },
    // deposit on UMAMI
    // {
    //   target: defiVaultAddress,
    //   callData: depositCalldata,
    //   value: ethAmount,
    // },
  ];

  return abiCoder.encode(
    [
      "tuple(tuple(address target, bytes callData, uint256 value)[] calls, address fallbackRecipient)",
    ],
    [
      {
        calls: instructions,
        fallbackRecipient: userAddress,
      },
    ]
  );
}

async function getSuggestedFees(
  inputToken,
  outputToken,
  inputAmount,
  originChainId,
  destinationChainId,
  recipient,
  message
) {
  const url = new URL("https://app.across.to/api/suggested-fees");

  url.searchParams.append("inputToken", inputToken);
  url.searchParams.append("outputToken", outputToken);
  url.searchParams.append("originChainId", originChainId.toString());
  url.searchParams.append("destinationChainId", destinationChainId.toString());
  url.searchParams.append("amount", inputAmount.toString());
  url.searchParams.append("recipient", recipient);

  if (message) {
    const messageHex = message.startsWith("0x")
      ? message
      : `0x${Buffer.from(message).toString("hex")}`;
    url.searchParams.append("message", messageHex);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Response:", errorText);
      throw new Error(
        `API request failed with status ${response.status}: ${errorText}`
      );
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching suggested fees:", error);
    throw error;
  }
}

async function depositUSDCToUmamiOnArb() {
  try {
    // const userAddress = await baseWallet.getAddress();
    // console.log(`Connected with wallet address: ${userAddress}`);

    const depositAmountHuman = "1";
    const depositAmount = ethers.parseUnits(depositAmountHuman, 6);
    const usdcContractBase = new ethers.Contract(
      USDC_ADDRESS_BASE,
      ERC20_ABI,
      baseWallet
    );

    // Generate initial message for fee estimation
    const initialMessage = await generateMessageForMulticallHandler(
      USER_ADDRESS,
      PARASWAP_SPENDER_ADDRESS,
      depositAmount,
      USDC_ADDRESS_ARBITRUM // Use the deposit usdc address
    );

    // console.log("Generated message for fee estimation:", initialMessage);

    // // Get suggested fees
    console.log("Getting suggested fees from Across API...");

    let suggestedFees = null;
    try {
      suggestedFees = await getSuggestedFees(
        USDC_ADDRESS_BASE, // Input token
        USDC_ADDRESS_ARBITRUM, // Output token
        depositAmount,
        parseInt(BASE_CHAIN_ID),
        parseInt(ARBITRUM_CHAIN_ID),
        MULTICALL_HANDLER_ADDRESS,
        initialMessage
      );
    } catch (error) {
      console.log("error in suggested fees", error);
    }

    console.log(
      "Suggested fees received:",
      JSON.stringify(suggestedFees, null, 2)
    );
    const outputAmount =
      depositAmount - ethers.toBigInt(suggestedFees.relayFeeTotal);

    console.log("output amount is", outputAmount);

    // Generate the final message with the output amount
    const finalMessage = await generateMessageForMulticallHandler(
      USER_ADDRESS,
      PARASWAP_SPENDER_ADDRESS,
      outputAmount, // Use output amount
      USDC_ADDRESS_ARBITRUM // Use base USDC address for the deposit on morpho
    );

    console.log("Final message for deposit:", finalMessage);

    // Approve USDC spending
    console.log("Approving USDC for Across Bridge...");
    try {
      const approveTx = await usdcContractBase.approve(
        ACROSS_SPOKEPOOL_ADDRESS_BASE,
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
      throw new Error("Failed to approve USDC for Across Bridge");
    }

    // Current timestamp
    const currentTime = Math.floor(Date.now() / 1000);

    // Use ethers.AbiCoder directly for precise control over encoding
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    const encodedParams = abiCoder.encode(
      [
        "address",
        "address",
        "address",
        "address",
        "uint256",
        "uint256",
        "uint256",
        "address",
        "uint32",
        "uint32",
        "uint32",
        "bytes",
      ],
      [
        USER_ADDRESS, // depositor (user address)
        MULTICALL_HANDLER_ADDRESS, // recipient (multicall handler)
        USDC_ADDRESS_BASE, // inputToken
        USDC_ADDRESS_ARBITRUM, // outputToken
        depositAmount, // inputAmount
        outputAmount, // outputAmount
        ethers.getBigInt(ARBITRUM_CHAIN_ID), // destinationChainId
        ethers.ZeroAddress, // exclusiveRelayer (none)
        currentTime, // quoteTimestamp
        currentTime + 7200, // fillDeadline (2 hours from now)
        0, // exclusivityDeadline (none)
        finalMessage, // message
      ]
    );

    // Manually construct the data with the correct function selector
    let manualData = DEPOSIT_V3_SELECTOR + encodedParams.substring(2); // Remove '0x' from params

    // Append the unique identifier to the calldata (required by Across)
    const finalData =
      "0x" + manualData.substring(2) + DELIMITER + UNIQUE_IDENTIFIER;

    console.log(
      "Manually constructed data with selector:",
      finalData.substring(0, 10)
    );
    console.log("Expected selector:", DEPOSIT_V3_SELECTOR);
    console.log(
      "Data includes unique identifier:",
      DELIMITER + UNIQUE_IDENTIFIER
    );
    const feeData = await baseProvider.getFeeData();

    // Create transaction with the final data
    const tx = {
      to: ACROSS_SPOKEPOOL_ADDRESS_BASE,
      data: finalData,
      gasLimit: ethers.toBigInt(2000000),
      value: ethers.toBigInt(0), // Explicitly set to 0
      chainId: parseInt(BASE_CHAIN_ID), // origin chain id
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

    const depositTx = await baseWallet.sendTransaction(tx);
    console.log("Transaction hash:", depositTx.hash);
  } catch (error) {
    console.error("Error in deposit process:", error);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
  }
}

depositUSDCToUmamiOnArb();
