import axios from "axios";
// https://github.com/aave/protocol-subgraphs

const BASE_URL = "QmXZ53Kzz3L2LvvbGve2ebtLKWMhjjB1a3U2jnUj2YwGCW";
const ARBITRUM_URL = "Qmdn5hAZZj3wmWVuksXHtua3E6aWftCDeTFcW8YQ8Lu6pB";
const POL_URL = "QmceoHP3ekxJ6JYqAXhqrVgv8rb9WXumrGe1ZhVZah8Ar5";
const OP_URL = "QmScPH3aFxzFgrie8MMDU4QtFu3CE7nTfsRfSQXiccxBPh";

const SUBGRAPH_URL = `https://api.thegraph.com/subgraphs/id/${ARBITRUM_URL}`;

const fetchAPYData = async () => {
  try {
    console.log("Fetching data...");

    const query = `
    {
      reserves(where: { symbol: "USDC" }) {
        liquidityRate
        reserveFactor
      }
    }`;

    const response = await axios.post(SUBGRAPH_URL, { query });

    const reserves = response.data.data.reserves;

    if (reserves.length === 0) {
      console.log("No data found for USDC pool.");
      return;
    }

    const pool = reserves[0];
    console.log("Fetched data for pool:", pool);

    // Convert liquidityRate from 1e27 scale to a decimal rate
    const liquidityRate = parseFloat(pool.liquidityRate) / 1e27;

    const reserveFactorBps = parseFloat(pool.reserveFactor); 
    const reserveFactor = reserveFactorBps / 10000; 

    const adjustedLiquidityRate = liquidityRate * (1 - reserveFactor);
    const apy = (Math.pow(1 + adjustedLiquidityRate / 365, 365) - 1) * 100; 

    console.log(`Liquidity Rate: ${liquidityRate}`);
    console.log(`Reserve Factor: ${reserveFactor}`);
    console.log(`Adjusted Liquidity Rate: ${adjustedLiquidityRate}`);
    console.log(`Estimated APY: ${apy.toFixed(2)}%`);
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

// Run the function
fetchAPYData();
