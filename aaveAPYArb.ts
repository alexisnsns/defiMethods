import { ethers } from "ethers";

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

const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);

const aavePoolAbi = [
  "function getReserveData(address asset) external view returns (uint256, uint128, uint128, uint128, uint128, uint128, uint40, uint16)",
];

async function getLendingAPY() {
  const contract = new ethers.Contract(
    AAVE_POOL_ADDRESS_ARBITRUM,
    aavePoolAbi,
    provider
  );
  const reserveData = await contract.getReserveData(
    "0x912ce59144191c1204e64559fe8253a0e49e6548"
  );

  const liquidityRate = reserveData[2]; // liquidityRate is the 3rd returned value
  console.log(liquidityRate);
  const lendingAPY = (Number(liquidityRate) / 1e27) * 100;

  // const lendingAPY = (liquidityRate / 1e27) * 100;

  console.log(`ARB token Lending APY on Arbitrum: ${lendingAPY.toFixed(2)}%`);
}

getLendingAPY();
