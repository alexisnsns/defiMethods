import axios from "axios";
// https://github.com/aave/protocol-subgraphs
const SUBGRAPH_IDS: Record<string, string> = {
  mainnet: "GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF",
  arbitrum: "DLuE98kEb5pQNXAcKFQGQgfSQ57Xdou4jnVbAEqMfy3B",
  optimism: "DSfLz8oQBUeU5atALgUFQKMTSYV9mZAVYp4noLSXAfvb",
  polygon: "Co2URyXjnxaw8WqxKyVHdirq9Ahhm5vcTs4dMedAq211",
  umami: "QmaP6HkZfzgqVvdVkiRHNy6LJiuQTnkdWmMbuu3Red5J2s",
};

// in the ENV
const API_KEY = "";
const RAY = 1e27;
const SECONDS_PER_YEAR = 31_536_000;

const fetchAPYData = async (
  ticker: string,
  network: keyof typeof SUBGRAPH_IDS
) => {
  const subgraphId = SUBGRAPH_IDS[network];
  if (!subgraphId) {
    console.error(`Unknown network: ${network}`);
    return;
  }

  const SUBGRAPH_URL = `https://gateway.thegraph.com/api/subgraphs/id/${subgraphId}`;

  try {
    console.log(`📡 Fetching APY for ${ticker} on ${network}...`);

    const query = `
      {
        reserveParamsHistoryItems(
          where: { reserve_: { symbol: "${ticker}" } }
          orderBy: timestamp
          orderDirection: desc
          first: 1
        ) {
          liquidityRate
        }
      }
    `;

    const response = await axios.post(
      SUBGRAPH_URL,
      { query },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      }
    );

    const rayValue =
      response.data.data.reserveParamsHistoryItems[0]?.liquidityRate;

    const depositAPR = Number(rayValue) / RAY;
    const depositAPY =
      Math.pow(1 + depositAPR / SECONDS_PER_YEAR, SECONDS_PER_YEAR) - 1;

    console.log(
      `AAVE APY for ${ticker} on ${network}: ${(depositAPY * 100).toFixed(2)}%`
    );
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

fetchAPYData("LUSD", "optimism");
