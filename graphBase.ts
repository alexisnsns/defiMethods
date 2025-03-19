import axios from "axios";

const AAVE_BASE_SUBGRAPH_URL =
  "https://api.thegraph.com/subgraphs/id/QmXZ53Kzz3L2LvvbGve2ebtLKWMhjjB1a3U2jnUj2YwGCW";

// Query to fetch the USDC pool
const query = `
query {
  reserves(where: { symbol: "USDC" }) {
    id
    name
    symbol
    liquidityRate
    stableBorrowRate
    variableBorrowRate
  }
}
`;

const SECONDS_IN_A_YEAR = 60 * 60 * 24 * 365; // 31,536,000

const fetchAPYData = async () => {
  try {
    console.log("Fetching data for USDC pool on Base...");

    const response = await axios.post(AAVE_BASE_SUBGRAPH_URL, { query });

    console.log("response", response.data);
    const reserves = response.data.data.reserves;

    if (reserves.length === 0) {
      console.log("No data found for USDC pool.");
      return;
    }

    const pool = reserves[0];
    console.log("Fetched data for pool:", pool);

    // Convert liquidityRate from 1e27 scale
    const liquidityRate = parseFloat(pool.liquidityRate) / 1e27

    console.log(`Liquidity Rate (scaled): ${liquidityRate}`);

    // Compute APY using correct per-second compounding
    const apy =
      (Math.pow(1 + liquidityRate / SECONDS_IN_A_YEAR, SECONDS_IN_A_YEAR) - 1) *
      100;

    console.log(`Estimated APY: ${apy.toFixed(2)}%`);
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

// Run the function
fetchAPYData();
