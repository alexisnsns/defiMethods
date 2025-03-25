import { ethers } from "ethers";
import dotenv from "dotenv";
import axios from "axios";
import BigNumber from "bignumber.js";
import {
  ARBITRUM_RPC_URL,
  USDC_ADDRESS_ARBITRUM,
  WETH_ADDRESS_ARBITRUM,
  USER_ADDRESS,
  PARASWAP_SPENDER_ADDRESS,
  ARBITRUM_CHAIN_ID,
} from "./resources.js";

dotenv.config();

const API_URL = "https://api.paraswap.io";
const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
const wallet = new ethers.Wallet(process.env.MNEMONIC, provider);

// Swap amount (0.5 USDC)
const SWAP_AMOUNT_USDC = "0.5";
const SWAP_AMOUNT_WEI = ethers.parseUnits(SWAP_AMOUNT_USDC, 6);

// ERC20 ABI for approve + allowance
const ERC20_ABI = [
  "function approve(address spender, uint256 value) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

/**
 * Get ParaSwap quote for USDC -> WETH swap
 */
const getQuote = async () => {
  const query = {
    srcToken: USDC_ADDRESS_ARBITRUM,
    srcDecimals: 6,
    destToken: WETH_ADDRESS_ARBITRUM,
    destDecimals: 18,
    amount: SWAP_AMOUNT_WEI.toString(),
    side: "SELL",
    network: ARBITRUM_CHAIN_ID, // Arbitrum
    userAddress: USER_ADDRESS,
    slippage: 1, // 1% slippage
  };

  const { data } = await axios.get(`${API_URL}/prices`, { params: query });
  return data.priceRoute;
};

/**
 * Ensures USDC approval for ParaSwap
 */
const ensureUSDCApproval = async () => {
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


// Augustus ParaSwap Router address
const PARASWAP_ROUTER_ADDRESS = "0x6A000F20005980200259B80c5102003040001068"; // Your given address

// Update the ABI to include swapExactAmountIn
const AugustusParaSwap_ABI = [
  "function swapExactAmountIn(address[] path, uint256 amountIn, uint256 minAmountOut, address beneficiary, uint256 deadline) external payable returns (uint256 amountOut)",
];

// Adjust the executeSwap function to use swapExactAmountIn
const executeSwap = async () => {
  const priceRoute = await getQuote();

  // Ensure approval before proceeding
  await ensureUSDCApproval();

  // Get transaction data from ParaSwap API
  const { data } = await axios.post(`${API_URL}/transactions/42161`, {
    srcToken: USDC_ADDRESS_ARBITRUM,
    destToken: WETH_ADDRESS_ARBITRUM,
    srcAmount: priceRoute.srcAmount,
    slippage: 1,
    userAddress: USER_ADDRESS,
    txOrigin: USER_ADDRESS,
    priceRoute,
  });

  // Create the path for the swap (from USDC to WETH)
  const path = [USDC_ADDRESS_ARBITRUM, WETH_ADDRESS_ARBITRUM];

  // Parse the amount of output tokens we're willing to accept (minAmountOut)
  const minAmountOut = BigNumber(priceRoute.destAmount)
    .times(1 - 0.01) // Slippage tolerance (1%)
    .toFixed(0);

  // Set the deadline for the transaction (e.g., 20 minutes from now)
  const deadline = Math.floor(Date.now() / 1000) + 1200; // 1200 seconds = 20 minutes

  // Encode the swapExactAmountIn function call
  const routerInterface = new ethers.Interface(AugustusParaSwap_ABI);
  const swapCallData = routerInterface.encodeFunctionData("swapExactAmountIn", [
    path,             // Token path (from USDC to WETH)
    SWAP_AMOUNT_WEI,  // Amount of USDC to swap
    minAmountOut,     // Minimum amount of WETH to receive
    USER_ADDRESS,     // Recipient address
    deadline,         // Deadline timestamp
  ]);

  console.log("🚀 Swap Call Data:", swapCallData);

  const feeData = await provider.getFeeData();

  // Create the transaction data
  const tx = {
    to: PARASWAP_ROUTER_ADDRESS, // Updated to the ParaSwap router address
    data: swapCallData,
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


// Run
executeSwap().catch(console.error);
