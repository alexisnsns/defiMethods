// DOES A DEPOSIT FROM ARBITRUM USDC TO BASE MORPHO USDC VAULT
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
} from "./resources.js";

// Generate message for Multicall Handler
function generateMessageForMulticallHandler(
  userAddress,
  defiVaultAddress,
  depositAmount,
  depositCurrency
) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  // ABI
  const approveFunction = "function approve(address spender, uint256 value)";
  const depositFunction =
    "function deposit(uint256 assets, address receiver) public override returns (uint256 shares)";

  const erc20Interface = new ethers.Interface([approveFunction]);
  const defiInterface = new ethers.Interface([depositFunction]);

  const approveCalldata = erc20Interface.encodeFunctionData("approve", [
    defiVaultAddress,
    depositAmount,
  ]);
  const depositCalldata = defiInterface.encodeFunctionData("deposit", [
    // depositCurrency,
    depositAmount,
    userAddress,
  ]);

  //instructions
  const instructions = [
    {
      target: depositCurrency,
      callData: approveCalldata,
      value: 0,
    },
    {
      target: defiVaultAddress,
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

async function depositUSDCToMorphoOnBase() {
  console.log("jones");
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

    const decimals = 6; // USDC decimals
    console.log(`Using USDC with ${decimals} decimals`);

    const depositAmountHuman = "1";
    const depositAmount = ethers.parseUnits(depositAmountHuman, decimals);
    const usdcContract = new ethers.Contract(
      USDC_ADDRESS_ARBITRUM,
      ERC20_ABI,
      wallet
    );

    // // Generate initial message for fee estimation
    const initialMessage = generateMessageForMulticallHandler(
      userAddress,
      MORPHO_VAULT_ADDRESS_BASE,
      depositAmount,
      USDC_ADDRESS_BASE // Use base USDC address for the deposit on morpho
    );

    console.log("Generated message for fee estimation:", initialMessage);

    // // Get suggested fees
    console.log("Getting suggested fees from Across API...");

    let suggestedFees = null;
    try {
      suggestedFees = await getSuggestedFees(
        USDC_ADDRESS_ARBITRUM, // Input token on Arbitrum
        USDC_ADDRESS_BASE, // Output token on Base
        depositAmount,
        parseInt(ARBITRUM_CHAIN_ID),
        parseInt(BASE_CHAIN_ID),
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
      MORPHO_VAULT_ADDRESS_BASE,
      outputAmount, // Use output amount
      USDC_ADDRESS_BASE // Use base USDC address for the deposit on morpho
    );

    console.log("Final message for deposit:", finalMessage);

    // Approve USDC spending
    console.log("Approving USDC for Across Bridge...");
    try {
      const approveTx = await usdcContract.approve(
        ACROSS_SPOKEPOOL_ADDRESS_ARBITRUM,
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
        USDC_ADDRESS_ARBITRUM, // inputToken
        USDC_ADDRESS_BASE, // outputToken
        depositAmount, // inputAmount
        outputAmount, // outputAmount
        ethers.getBigInt(BASE_CHAIN_ID), // destinationChainId
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
      to: ACROSS_SPOKEPOOL_ADDRESS_ARBITRUM,
      data: finalData,
      gasLimit: ethers.toBigInt(2000000),
      value: ethers.toBigInt(0), // Explicitly set to 0
      chainId: parseInt(ARBITRUM_CHAIN_ID),
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

depositUSDCToMorphoOnBase();
