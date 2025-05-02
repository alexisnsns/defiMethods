// WITHDRAW UMAMI USDC ARB POOL TOKENS
import { ethers } from "ethers";
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
  UMAMI_WETH_VAULT_ADDRESS_ARB,
  USER_ADDRESS,
} from "../resources.js";

const readABI = [
  "function totalAssets() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address _spender, uint256 _value) returns (bool)",
];

const { MNEMONIC } = process.env;
const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
const wallet = new ethers.Wallet(MNEMONIC, provider);

const vaultContract = new ethers.Contract(
  UMAMI_WETH_VAULT_ADDRESS_ARB,
  readABI,
  provider
);

const gmContract = new ethers.Contract(
  "0x959f3807f0Aa7921E18c78B00B2819ba91E52FeF",
  readABI,
  wallet
);

export function generateWithdrawCallData(
  userAddress: string,
  rawShares,
  minOutAfterFees
) {
  console.log("raw shares", rawShares);
  console.log("minOutAfterFees", minOutAfterFees);

  const withdrawUmamiABI = [
    "function redeem(uint256 shares, uint256 minOutAfterFees, address receiver, address owner) returns (uint256)",
  ];

  const defiInterface = new ethers.Interface(withdrawUmamiABI);

  const withdrawCalldata = defiInterface.encodeFunctionData("redeem", [
    rawShares,
    minOutAfterFees,
    userAddress,
    userAddress,
  ]);

  return withdrawCalldata;
}

async function approveGmToken() {
  try {
    const amountToApprove = ethers.MaxUint256;

    // Approve the GM token for the vault
    const approveTx = await gmContract.approve(
      UMAMI_WETH_VAULT_ADDRESS_ARB,
      amountToApprove,
      {
        gasLimit: 300000, // Set a higher gas limit for the approval
      }
    );

    // Wait for the transaction to be mined
    await approveTx.wait();
    console.log("Approval successful");

    return;
  } catch (error) {
    console.error("Error during approval:", error);
  }
}

async function withdrawUSDCFromUmamiOnArbitrum() {
  try {
    const [userBalance, minAfterFees] = await calculateMinOutAfterFees();

    const callData = generateWithdrawCallData(
      USER_ADDRESS,
      userBalance,
      minAfterFees
    );

    console.log("Generated CallData:", callData);

    await approveGmToken();

    const feeData = await provider.getFeeData();

    const ethAmount = 0.00048;
    // const ethAmount = 0.001;

    // Convert ETH to wei
    const valueInWei = ethers.parseUnits(ethAmount.toString(), "ether");

    // Create transaction
    const tx = {
      to: UMAMI_WETH_VAULT_ADDRESS_ARB,
      from: USER_ADDRESS,
      data: callData,
      // gasLimit: ethers.toBigInt(3000000),
      value: valueInWei,
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

    const estimatedGas = await provider.estimateGas(tx);

    console.log("estimated gas", estimatedGas);
    // Ensure maxPriorityFeePerGas <= maxFeePerGas
    if (tx.maxPriorityFeePerGas > tx.maxFeePerGas) {
      tx.maxPriorityFeePerGas = tx.maxFeePerGas;
    }

    const finalTx = {
      ...tx,
      gasLimit: estimatedGas, // Set the estimated gas as the gas limit
    };

    // console.log("Transaction data:", {
    //   from: tx.from,
    //   to: tx.to,
    //   value: tx.value.toString(),
    //   gasLimit: tx.gasLimit.toString(),
    //   maxFeePerGas: tx.maxFeePerGas.toString(),
    //   maxPriorityFeePerGas: tx.maxPriorityFeePerGas.toString(),
    //   dataLength: tx.data.length,
    // });

    console.log("Sending transaction...");

    const withdrawTransaction = await wallet.sendTransaction(finalTx);
    console.log("Transaction hash:", withdrawTransaction.hash);
  } catch (error) {
    console.error("Error in withdraw process:", error);
    if (error.stack) {
      console.error("Stack trace:", error.stack);
    }
  }
}

async function calculateMinOutAfterFees() {
  try {
    // get user raw amount of shares
    const userBalance: ethers.BigNumberish = await vaultContract.balanceOf(
      USER_ADDRESS
    );

    // read the contract to calculate share price
    const totalAssets = await vaultContract.totalAssets();
    const totalSupply = await vaultContract.totalSupply();

    const totalAssetsBN = ethers.toBigInt(totalAssets);
    const totalSupplyBN = ethers.toBigInt(totalSupply);

    const sharePrice = (totalAssetsBN * 10n ** 18n) / totalSupplyBN;
    // Calculate value before fees
    const rawAmount = (BigInt(userBalance) * BigInt(sharePrice)) / 10n ** 18n;
    // Apply 0.15% fee (multiply by 0.9985)
    const minOutAfterFees = (rawAmount * 9800n) / 10000n;

    console.log(`User Balance: ${userBalance} shares`);
    console.log(`Share Price: ${sharePrice}`);
    console.log(`Raw amount Before Fees: ${rawAmount}`);
    console.log(`Min Out After Fees: ${minOutAfterFees}`);

    return [userBalance, minOutAfterFees];
  } catch (error) {
    console.error("Error calculating minOutAfterFees:", error);
  }
}

withdrawUSDCFromUmamiOnArbitrum();

// approveGmToken();
// 6.44 de eth et 1.94 sur umami

// Check the allowance
// const allowance = await gmContract.allowance(
//   USER_ADDRESS,
//   UMAMI_WETH_VAULT_ADDRESS_ARB
// );
// console.log(`Current Allowance: ${ethers.formatUnits(allowance, 6)} tokens`);
