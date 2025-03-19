import axios from "axios";

// BASE
const BASE_URL = "QmXZ53Kzz3L2LvvbGve2ebtLKWMhjjB1a3U2jnUj2YwGCW";
const ARBITRUM_URL = "Qmdn5hAZZj3wmWVuksXHtua3E6aWftCDeTFcW8YQ8Lu6pB";
const POL_URL = "QmceoHP3ekxJ6JYqAXhqrVgv8rb9WXumrGe1ZhVZah8Ar5";

const SUBGRAPH_URL = `https://api.thegraph.com/subgraphs/id/${POL_URL}`;

const DAYS_IN_A_YEAR = 365;
const fetchAPYData = async () => {
  try {
    console.log("Fetching data for USDC pool on...");

    const query = `
    {
      reserves(where: { symbol: "USDC" }) {
        id
        name
        symbol
        liquidityRate
        stableBorrowRate
        variableBorrowRate
        totalScaledVariableDebt
        totalLiquidity
      }
    }`;

    const response = await axios.post(SUBGRAPH_URL, { query });

    console.log("Response:", response.data);

    const reserves = response.data.data.reserves;

    if (reserves.length === 0) {
      console.log("No data found for USDC pool.");
      return;
    }

    const pool = reserves[0];
    console.log("Fetched data for pool:", pool);

    // Convert liquidityRate from 1e27 scale to a decimal rate
    const liquidityRate = parseFloat(pool.liquidityRate) / 1e27;
    console.log(`Liquidity Rate (scaled): ${liquidityRate}`);

    // Get total debt and total liquidity
    const totalScaledVariableDebt = parseFloat(pool.totalScaledVariableDebt);
    const totalLiquidity = parseFloat(pool.totalLiquidity);

    console.log(`Total Scaled Variable Debt: ${totalScaledVariableDebt}`);
    console.log(`Total Liquidity: ${totalLiquidity}`);

    // 1. Calculate the utilization ratio
    const utilizationRatio = totalScaledVariableDebt / totalLiquidity;
    console.log(`Utilization Ratio: ${utilizationRatio}`);

    // 2. Apply the correct slope depending on utilization ratio
    let variableRate = liquidityRate;

    if (utilizationRatio < 0.8) {
      // Below OPTIMAL_USAGE_RATIO
      variableRate *= 0.5; // Example Slope1
    } else {
      variableRate *= 1.5; // Example Slope2
    }

    console.log(`Variable Borrow Rate: ${variableRate}`);

    // 3. Calculate APY (assuming daily compounding)
    const apy =
      (Math.pow(1 + variableRate / DAYS_IN_A_YEAR, DAYS_IN_A_YEAR) - 1) * 100;
    console.log(`Estimated APY: ${apy.toFixed(2)}%`);
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

// Run the function
fetchAPYData();
