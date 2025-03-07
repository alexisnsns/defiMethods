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
  AAVE_POOL_ADDRESS_BASE,
} from "./resources.js";

const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);

const aavePoolAbi = [
  "function getReserveData(address asset) external view returns (uint256, uint128, uint128, uint128, uint128, uint128, uint40, uint16)",
];

async function getLendingAPY() {
  const contract = new ethers.Contract(
    AAVE_POOL_ADDRESS_BASE,
    aavePoolAbi,
    provider
  );
  const reserveData = await contract.getReserveData(USDC_ADDRESS_BASE);

  const liquidityRate = reserveData[2]; // liquidityRate is the 3rd returned value
  console.log(liquidityRate);
  const lendingAPY = (Number(liquidityRate) / 1e27) * 100;

  // const lendingAPY = (liquidityRate / 1e27) * 100;

  console.log(`USDC Lending APY on BASE: ${lendingAPY.toFixed(2)}%`);
}

getLendingAPY();
