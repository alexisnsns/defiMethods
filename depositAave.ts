// DOES A DEPOSIT FROM BASE USDC TO ARB AAVE USDC VAULT
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
} from "./resources.js";

// Generate message for Multicall Handler
function generateMessageForMulticallHandler(
  userAddress,
  aaveAddress,
  depositAmount,
  depositCurrency,
  aaveReferralCode = 0
) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  // ABI
  const approveFunction = "function approve(address spender, uint256 value)";
  const depositFunction =
    "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)";

  const erc20Interface = new ethers.Interface([approveFunction]);
  const aaveInterface = new ethers.Interface([depositFunction]);

  const approveCalldata = erc20Interface.encodeFunctionData("approve", [
    aaveAddress,
    depositAmount,
  ]);
  const depositCalldata = aaveInterface.encodeFunctionData("supply", [
    depositCurrency,
    depositAmount,
    userAddress,
    aaveReferralCode,
  ]);

  //instructions
  const instructions = [
    {
      target: depositCurrency,
      callData: approveCalldata,
      value: 0,
    },
    {
      target: aaveAddress,
      callData: depositCalldata,
      value: 0,
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
  destinationChainId,
  originChainId,
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

  console.log("API URL:", url.toString());

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

// Append unique identifier to calldata as requested by Across
function appendIdentifierToCalldata(calldata) {
  // Remove '0x' prefix, append delimiter + identifier, and add back the '0x' prefix
  return calldata + DELIMITER + UNIQUE_IDENTIFIER;
}

async function depositUSDCToAaveOnArbitrum() {
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

    const decimals = 6; // USDC decimals
    console.log(`Using USDC with ${decimals} decimals`);

    const depositAmountHuman = "1";
    const depositAmount = ethers.parseUnits(depositAmountHuman, decimals);
    const usdcContract = new ethers.Contract(
      USDC_ADDRESS_BASE,
      ERC20_ABI,
      wallet
    );

    // Generate initial message for fee estimation
    const initialMessage = generateMessageForMulticallHandler(
      userAddress,
      AAVE_POOL_ADDRESS_ARBITRUM,
      depositAmount,
      USDC_ADDRESS_ARBITRUM, // Use Arbitrum USDC address for the deposit on Aave
      0 // referral code
    );

    console.log("Generated message for fee estimation:", initialMessage);

    // Get suggested fees
    console.log("Getting suggested fees from Across API...");
    const suggestedFees = await getSuggestedFees(
      USDC_ADDRESS_BASE, // Input token on Base
      USDC_ADDRESS_ARBITRUM, // Output token on Arbitrum
      depositAmount,
      parseInt(ARBITRUM_CHAIN_ID),
      parseInt(BASE_CHAIN_ID),
      MULTICALL_HANDLER_ADDRESS,
      initialMessage
    );

    console.log(
      "Suggested fees received:",
      JSON.stringify(suggestedFees, null, 2)
    );
    const outputAmount =
      depositAmount - ethers.toBigInt(suggestedFees.relayFeeTotal);

    // Generate the final message with the output amount
    const finalMessage = generateMessageForMulticallHandler(
      userAddress,
      AAVE_POOL_ADDRESS_ARBITRUM,
      outputAmount, // Use output amount
      USDC_ADDRESS_ARBITRUM, // Use Arbitrum USDC address for the deposit on Aave
      0 // referral code
    );

    console.log("Final message for deposit:", finalMessage);

    // Approve USDC spending
    console.log("Approving USDC for Across Bridge...");
    try {
      const approveTx = await usdcContract.approve(
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
        userAddress, // depositor (user address)
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
    const feeData = await provider.getFeeData();

    // Create transaction with the final data
    const tx = {
      to: ACROSS_SPOKEPOOL_ADDRESS_BASE,
      data: finalData,
      gasLimit: ethers.toBigInt(2000000),
      value: ethers.toBigInt(0), // Explicitly set to 0
      chainId: parseInt(BASE_CHAIN_ID),
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

depositUSDCToAaveOnArbitrum();
