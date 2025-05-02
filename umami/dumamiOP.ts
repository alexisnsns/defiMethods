// DOES A DEPOSIT FROM OP USDC TO ARBITRUM UMAMI USDC VAULT
import { ethers } from "ethers";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();
import FACTORY_ABI from "./abis/factory.json" assert { type: "json" };
import QUOTER_ABI from "./abis/quoter.json" assert { type: "json" };
import SWAP_ROUTER_ABI from "./abis/swaprouter.json" assert { type: "json" };
import POOL_ABI from "./abis/pool.json" assert { type: "json" };
import TOKEN_IN_ABI from "./abis/weth.json" assert { type: "json" };
import {
  USDC_ADDRESS_ARBITRUM,
  ARBITRUM_CHAIN_ID,
  OPTIMISM_CHAIN_ID,
  OPTIMISM_RPC_URL,
  ARBITRUM_RPC_URL,
  USDC_ADDRESS_OPTIMISM,
  ERC20_ABI,
  DEPOSIT_V3_SELECTOR,
  UNIQUE_IDENTIFIER,
  DELIMITER,
  ACROSS_SPOKEPOOL_ADDRESS_OPTIMISM,
  MULTICALL_HANDLER_ADDRESS,
  UMAMI_WETH_VAULT_ADDRESS_ARB,
  WETH_ADDRESS_ARBITRUM,
  USER_ADDRESS,
} from "../resources.js";

const optimismProvider = new ethers.JsonRpcProvider(OPTIMISM_RPC_URL);
const arbProvider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);

const decimals = 6; // USDC decimals
const depositAmount = ethers.parseUnits("3", decimals);
// the eth fee is around 1 usd eth (0.0005 eth)
const swapAmount = ethers.parseUnits("1", decimals);

// UNISWAP V3 FACTORY
const POOL_FACTORY_CONTRACT_ADDRESS =
  "0x1F98431c8aD98523631AE4a59f267346ea31F984";
// QUOTER V2
const QUOTER_CONTRACT_ADDRESS = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
// swap router 02
const SWAP_ROUTER_CONTRACT_ADDRESS =
  "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";

const factoryContract = new ethers.Contract(
  POOL_FACTORY_CONTRACT_ADDRESS,
  FACTORY_ABI,
  arbProvider
);
const quoterContract = new ethers.Contract(
  QUOTER_CONTRACT_ADDRESS,
  QUOTER_ABI,
  arbProvider
);

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

// Generate message for Multicall Handler
function generateMessageForMulticallHandler(
  userAddress: string,
  uniswapAddress: string,
  inputAmount: bigint,
  depositCurrency,
  callDataSwap: Object,
  wethToUnwrap: bigint,
  umamiVaultAddress
) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  // ABI
  const approveFunction = "function approve(address spender, uint256 value)";
  const depositFunction =
    "function deposit(uint256 assets, uint256 minOutAfterFees, address receiver) external returns (uint256 shares)";

  const erc20Interface = new ethers.Interface([approveFunction]);
  const defiInterface = new ethers.Interface([depositFunction]);

  const MAX_UINT256 = ethers.MaxUint256;

  const approveCalldata = erc20Interface.encodeFunctionData("approve", [
    uniswapAddress,
    MAX_UINT256,
  ]);

  const approveUmamiCalldata = erc20Interface.encodeFunctionData("approve", [
    umamiVaultAddress,
    MAX_UINT256,
  ]);

  const wethWithdrawFunction = "function withdraw(uint256 amount)";
  const wethInterface = new ethers.Interface([wethWithdrawFunction]);

  const unwrapCalldata = wethInterface.encodeFunctionData("withdraw", [
    wethToUnwrap,
  ]);


  // deduce the amount that was swapped before doing the deposit
  const finalUSDCToDeposit =
  inputAmount - swapAmount

  const depositCallData = defiInterface.encodeFunctionData("deposit", [
    finalUSDCToDeposit,
    // TODO: min after fees should be calculated, even generously, to avoid max slippage
    0,
    userAddress,
  ]);

  //instructions
  const instructions = [
    // approve USDC ARB for swap
    {
      target: depositCurrency,
      callData: approveCalldata,
      value: 0,
    },
    // swap USDC <> WETH on arb from multicallAddress
    {
      target: uniswapAddress,
      callData: callDataSwap,
      value: 0,
    },
    // unwrap WETH<>ETH on multicallAddress
    {
      target: WETH_ADDRESS_ARBITRUM,
      callData: unwrapCalldata,
      value: 0,
    },
    // send ETH to user address (TO COMMENT)
    // {
    //   target: USER_ADDRESS,
    //   callData: "0x",
    //   value: wethToUnwrap,
    // },
    // approve Umami
    {
      target: depositCurrency,
      callData: approveUmamiCalldata,
      value: 0,
    },
    // deposit on Umami
    {
      target: umamiVaultAddress,
      callData: depositCallData,
      value: wethToUnwrap,
    },
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

  console.log("input amount is", inputAmount);
  if (message) {
    const messageHex = message.startsWith("0x")
      ? message
      : `0x${Buffer.from(message).toString("hex")}`;
    url.searchParams.append("message", messageHex);
  }

  // console.log("API URL:", url.toString());

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

// UNISWAP LOGIC
async function getPoolInfo(factoryContract, tokenIn, tokenOut) {
  const poolAddress = await factoryContract.getPool(
    tokenIn.address,
    tokenOut.address,
    3000
  );
  if (!poolAddress) {
    throw new Error("Failed to get pool address");
  }
  const poolContract = new ethers.Contract(poolAddress, POOL_ABI, arbProvider);
  const [token0, token1, fee] = await Promise.all([
    poolContract.token0(),
    poolContract.token1(),
    poolContract.fee(),
  ]);
  return { poolContract, token0, token1, fee };
}

// UNISWAP LOGIC
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
      // the recipient is accross, otherwise we can't unwrap the eth after the swap
      recipient: MULTICALL_HANDLER_ADDRESS,
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

// UNISWAP LOGIC
async function prepareSwapParams(poolContract, wallet, amountIn, amountOut) {
  return {
    tokenIn: USDC.address,
    tokenOut: WETH.address,
    fee: await poolContract.fee(),
    // the recipient is accross, otherwise we can't unwrap the eth after the swap
    recipient: MULTICALL_HANDLER_ADDRESS,
    amountIn: amountIn,
    amountOutMinimum: amountOut,
    sqrtPriceLimitX96: 0,
  };
}

// UNISWAP LOGIC
async function getSwapCallData(swapRouter, params) {
  const transaction = await swapRouter.exactInputSingle.populateTransaction(
    params
  );

  return transaction;
}

async function depositUSDCToUmamiOnArb() {
  console.log("start!");
  try {
    const { MNEMONIC } = process.env;

    const wallet = new ethers.Wallet(MNEMONIC, optimismProvider);
    const userAddress = await wallet.getAddress();
    console.log(`Connected with wallet address: ${userAddress}`);

    const usdcContract = new ethers.Contract(
      USDC_ADDRESS_OPTIMISM,
      ERC20_ABI,
      wallet
    );

    const { poolContract, token0, token1, fee } = await getPoolInfo(
      factoryContract,
      USDC,
      WETH
    );
    console.log(`-------------------------------`);
    console.log(`Fetching Quote for: ${USDC.symbol} to ${WETH.symbol}`);
    console.log(`-------------------------------`);
    console.log(`Swap Amount: ${ethers.formatEther(depositAmount)}`);

    const quotedAmountOut = await quoteAndLogSwap(
      quoterContract,
      fee,
      wallet,
      swapAmount
    );

    const params = await prepareSwapParams(
      poolContract,
      wallet,
      swapAmount,
      quotedAmountOut[0].toString()
    );

    const swapRouter = new ethers.Contract(
      SWAP_ROUTER_CONTRACT_ADDRESS,
      SWAP_ROUTER_ABI,
      wallet
    );

    const callDataSwap = await getSwapCallData(swapRouter, params);
    const amountToUnwrap = ethers.parseUnits(quotedAmountOut, 18);

    // Generate initial message for fee estimation
    const initialMessage = generateMessageForMulticallHandler(
      userAddress,
      SWAP_ROUTER_CONTRACT_ADDRESS,
      depositAmount,
      USDC_ADDRESS_ARBITRUM, // Use the deposit usdc address,
      callDataSwap.data,
      amountToUnwrap,
      UMAMI_WETH_VAULT_ADDRESS_ARB
    );

    // console.log("Generated message for fee estimation:", initialMessage);

    // Get suggested fees
    console.log("Getting suggested fees from Across API...");

    let suggestedFees = null;
    try {
      suggestedFees = await getSuggestedFees(
        USDC_ADDRESS_OPTIMISM, // Input token
        USDC_ADDRESS_ARBITRUM, // Output token
        depositAmount,
        parseInt(OPTIMISM_CHAIN_ID),
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
    const finalMessage = generateMessageForMulticallHandler(
      userAddress,
      SWAP_ROUTER_CONTRACT_ADDRESS,
      outputAmount, // Use output amount
      USDC_ADDRESS_ARBITRUM, // Use arb USDC address for the deposit on umami
      callDataSwap.data,
      amountToUnwrap,
      UMAMI_WETH_VAULT_ADDRESS_ARB
    );

    console.log("Final message for deposit:", finalMessage);

    // Approve USDC spending
    console.log("Approving USDC for Across Bridge...");
    try {
      // UNCOMMENT
      const approveTx = await usdcContract.approve(
        ACROSS_SPOKEPOOL_ADDRESS_OPTIMISM,
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
        userAddress, // depositor (user address)
        MULTICALL_HANDLER_ADDRESS, // recipient (multicall handler)
        USDC_ADDRESS_OPTIMISM, // inputToken
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
    const feeData = await optimismProvider.getFeeData();

    // Create transaction with the final data
    const tx = {
      to: ACROSS_SPOKEPOOL_ADDRESS_OPTIMISM,
      data: finalData,
      gasLimit: ethers.toBigInt(2000000),
      value: ethers.toBigInt(0), // Explicitly set to 0
      chainId: parseInt(OPTIMISM_CHAIN_ID), // origin chain id
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

    const depositTx = await wallet.sendTransaction(tx);
    console.log("Transaction hash:", depositTx.hash);
  } catch (error) {
    console.error("Error in deposit process:", error);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
  }
}

depositUSDCToUmamiOnArb();
