// DOCUMENTATION
// https://github.com/aave/protocol-subgraphs

export const USER_ADDRESS = "0xe19c88086C8d551C81ff8a3e2c5DF87a88110a51";
// CHAINS && MISC
export const BASE_CHAIN_ID = "8453";
export const ARBITRUM_CHAIN_ID = "42161";
export const OPTIMISM_CHAIN_ID = "10";

export const BASE_RPC_URL =
  "https://winter-cool-panorama.base-mainnet.quiknode.pro/95ec67b9fac3ae2356d2e81041d7dc339ebcf16d/";
export const ARBITRUM_RPC_URL = "https://arb1.arbitrum.io/rpc";
export const OPTIMISM_RPC_URL = "https://mainnet.optimism.io/";

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",

  // Authenticated Functions
  "function transfer(address to, uint amount) returns (bool)",
  "function approve(address _spender, uint256 _value) returns (bool)",

  // Events
  "event Transfer(address indexed from, address indexed to, uint amount)",
];

// TOKENS

// USDC
export const USDC_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const USDC_ADDRESS_ARBITRUM =
  "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
export const USDC_ADDRESS_POLYGON =
  "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
export const USDC_ADDRESS_OPTIMISM =
  "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85";

// OTHER
export const USDT_ADDRESS_ARBITRUM =
  "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";
export const WETH_ADDRESS_ARBITRUM =
  "0x82af49447d8a07e3bd95bd0d56f35241523fbab1";

export const IBT_SPECTRA = "0x74E6AFeF5705BEb126C6d3Bf46f8fad8F3e07825";
export const PT_TOKEN_SPECTRA = "0xe40b0eddf2344a41f6a7af9d8a2433826630ed82";

// ACCROSS
export const ACROSS_SPOKEPOOL_ADDRESS_BASE =
  "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64";
export const ACROSS_SPOKEPOOL_ADDRESS_ARBITRUM =
  "0xe35e9842fceaca96570b734083f4a58e8f7c5f2a";
export const ACROSS_SPOKEPOOL_ADDRESS_OPTIMISM =
  "0x6f26Bf09B1C792e3228e5467807a900A503c0281";
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
export const UMAMI_WETH_VAULT_ADDRESS_ARB =
  "0x959f3807f0Aa7921E18c78B00B2819ba91E52FeF";
export const CURVE_USDC_POOL_ADDRESS =
  "0x4f37A9d177470499A2dD084621020b023fcffc1F";

export const UNISWAP_V3_USDC_WETH_POOL_ADDRESS =
  "0xC6962004f452bE9203591991D15f6b388e09E8D0";
export const UNISWAP_V3_UNIVERSAL_ROUTER =
  "0xa51afafe0263b40edaef0df8781ea9aa03e381a3";

export const PARASWAP_SPENDER_ADDRESS =
  "0x6a000f20005980200259b80c5102003040001068";

export const LLAMA_AAVE_OP_USDC_ID = "0758c3b8-4ffb-4176-b0a9-f446e367db46";
export const LLAMA_AAVE_ARB_USDC_ID = "d9fa8e14-0447-4207-9ae8-7810199dfa1f";
export const LLAMA_AAVE_BASE_USDC_ID = "7e0661bf-8cf3-45e6-9424-31916d4c7b84";
export const LLAMA_AAVE_POL_USDC_ID = "1b8b4cdb-0728-42a8-bf13-2c8fea7427ee";
export const LLAMA_UMAMI_ARB_USDC_ID = "ac6e0cca-a9cb-42b9-b77c-d0e1b3b4a2f6";


// query {
//   vaultByAddress(
//     address: "0xc1256Ae5FF1cf2719D4937adb3bbCCab2E00A2Ca"
//     chainId: 8453  # You need to specify the chainId, such as 1 for Ethereum
//   ) {
    
//     state {
    
//       apy
//       netApy
//       totalAssets
//     }
//   }
// }