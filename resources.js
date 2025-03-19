// DOCUMENTATION
// https://github.com/aave/protocol-subgraphs



// CHAINS && MISC
export const BASE_CHAIN_ID = "8453";
export const ARBITRUM_CHAIN_ID = "42161";
export const BASE_RPC_URL =
  "https://winter-cool-panorama.base-mainnet.quiknode.pro/95ec67b9fac3ae2356d2e81041d7dc339ebcf16d/";
export const ARBITRUM_RPC_URL = "https://arb1.arbitrum.io/rpc";

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

// TOKENS
export const USDC_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const USDC_ADDRESS_ARBITRUM =
  "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

export const IBT_SPECTRA = "0x74E6AFeF5705BEb126C6d3Bf46f8fad8F3e07825";
export const PT_TOKEN_SPECTRA = "0xe40b0eddf2344a41f6a7af9d8a2433826630ed82";

// ACCROSS
export const ACROSS_SPOKEPOOL_ADDRESS_BASE =
  "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64";
export const ACROSS_SPOKEPOOL_ADDRESS_ARBITRUM =
  "0xe35e9842fceaca96570b734083f4a58e8f7c5f2a";
export const MULTICALL_HANDLER_ADDRESS =
  "0x924a9f036260DdD5808007E1AA95f08eD08aA569";
export const DEPOSIT_V3_SELECTOR = "0x7b939232";
export const UNIQUE_IDENTIFIER = "f001";
export const DELIMITER = "1dc0de";

// VAULTS AND POOLS
export const MORPHO_VAULT_ADDRESS_BASE =
  "0xc1256Ae5FF1cf2719D4937adb3bbCCab2E00A2Ca";
export const AAVE_POOL_ADDRESS_ARBITRUM =
  "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
export const AAVE_POOL_ADDRESS_BASE =
  "0xa238dd80c259a72e81d7e4664a9801593f98d1c5";
export const CURVE_POOL_ADDRESS = "0x8f48e040e3130efd4f44e0026d62d79eb97a40f2";
