import { ethers } from "ethers";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

export function generateWithdrawCallData(
  userAddress: string,
  aaveAddress: string,
  withdrawAmount,
  depositCurrency: string
) {
  console.log("CALLDATA PAYLOAD", {
    userAddress: userAddress,
    aaveAddress: aaveAddress,
    withdrawAmount: withdrawAmount,
    depositCurrency: depositCurrency,
  });

  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const withdrawFunction =
    "function withdraw(address asset, uint256 amount, address to)";

  const aaveInterface = new ethers.Interface([withdrawFunction]);

  const withdrawCalldata = aaveInterface.encodeFunctionData("withdraw", [
    depositCurrency,
    withdrawAmount,
    userAddress,
  ]);

  //instructions
  const instructions = [
    {
      target: userAddress,
      callData: withdrawCalldata,
      value: 0,
    },
  ];

  // return abiCoder.encode(
  //   ["tuple(address target, bytes callData, uint256 value)[]", "address"],
  //   [instructions, userAddress]
  // );
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

async function withdrawUSDCFromAaveOnArbitrum() {
  try {
    const {
      MNEMONIC,
      USDC_ADDRESS_ARBITRUM,
      AAVE_POOL_ADDRESS_ARBITRUM,
      ARBITRUM_CHAIN_ID,
      ARBITRUM_RPC_URL,
    } = process.env;

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
    const withdrawAmountHuman = "0.5";
    const withdrawAmount = ethers.parseUnits(withdrawAmountHuman, decimals);

    // Generate initial message for fee estimation
    const callData = generateWithdrawCallData(
      userAddress,
      AAVE_POOL_ADDRESS_ARBITRUM,
      withdrawAmount,
      USDC_ADDRESS_ARBITRUM // Use Arbitrum USDC address for the deposit on Aave
    );

    const feeData = await provider.getFeeData();

    // Create transaction with the final data
    const tx = {
      to: AAVE_POOL_ADDRESS_ARBITRUM,
      data: callData,
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

    // Ensure maxPriorityFeePerGas <= maxFeePerGas
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

withdrawUSDCFromAaveOnArbitrum();
