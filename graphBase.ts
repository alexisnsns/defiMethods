import axios from "axios";
// https://github.com/aave/protocol-subgraphs

const BASE_URL = "QmXZ53Kzz3L2LvvbGve2ebtLKWMhjjB1a3U2jnUj2YwGCW";
const ARBITRUM_URL = "Qmdn5hAZZj3wmWVuksXHtua3E6aWftCDeTFcW8YQ8Lu6pB";
const POL_URL = "QmceoHP3ekxJ6JYqAXhqrVgv8rb9WXumrGe1ZhVZah8Ar5";
const OP_URL = "QmScPH3aFxzFgrie8MMDU4QtFu3CE7nTfsRfSQXiccxBPh";

const UMAMI_URL = "QmaP6HkZfzgqVvdVkiRHNy6LJiuQTnkdWmMbuu3Red5J2s";

const SUBGRAPH_URL = `https://api.thegraph.com/subgraphs/id/${UMAMI_URL}`;
const fetchAPYData = async () => {
  try {
    console.log("Fetching data...");

    const query = `
    {
      vaultTVLs(first: 5, where: { vault: "0x959f3807f0aa7921e18c78b00b2819ba91e52fef" }) {
        id
        vault
        timestamp
        tvl
      }
    }`;

    const response = await axios.post(SUBGRAPH_URL, { query });
    const data = response.data.data.vaultTVLs;
    if (data.length < 2) {
      console.error("Not enough data to calculate APY.");
      return;
    }

    // Sort snapshots by timestamp ascending (oldest first)
    const sortedData = data.sort(
      (a, b) => parseInt(a.timestamp) - parseInt(b.timestamp)
    );
    const initialTVL = parseInt(sortedData[0].tvl);
    const finalTVL = parseInt(sortedData[sortedData.length - 1].tvl);

    // Calculate time difference (in seconds)
    const timeDifference =
      parseInt(sortedData[sortedData.length - 1].timestamp) -
      parseInt(sortedData[0].timestamp);

    // Convert TVL from USDC (6 decimals)
    const initialTVLInUSDC = initialTVL / 1e6;
    const finalTVLInUSDC = finalTVL / 1e6;

    // Calculate APY from TVL change
    const growthFactor = finalTVLInUSDC / initialTVLInUSDC;
    const apy =
      (Math.pow(growthFactor, (365 * 24 * 60 * 60) / timeDifference) - 1) * 100;

    console.log(`Initial TVL: ${initialTVLInUSDC} USDC`);
    console.log(`Final TVL: ${finalTVLInUSDC} USDC`);
    console.log(`Estimated APY: ${apy.toFixed(2)}%`);
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

fetchAPYData();
