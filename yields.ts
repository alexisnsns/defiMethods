import {
  USDC_ADDRESS_ARBITRUM,
  USDC_ADDRESS_BASE,
  USDC_ADDRESS_POLYGON,
  USDC_ADDRESS_OPTIMISM,
} from "./resources.js";

const usdcAddresses: Record<string, string> = {
  Arbitrum: USDC_ADDRESS_ARBITRUM,
  Base: USDC_ADDRESS_BASE,
  Optimism: USDC_ADDRESS_OPTIMISM,
  Polygon: USDC_ADDRESS_POLYGON,
};

const fetchUSDCAavePools = async () => {
  try {
    const response = await fetch("https://yields.llama.fi/pools");
    const data = await response.json();

    if (data.status !== "success") {
      console.error("Failed to fetch data");
      return;
    }

    const filteredPools = data.data
      .filter(
        (pool: any) =>
          ["Arbitrum", "Base", "Optimism", "Polygon"].includes(pool.chain) &&
          pool.project === "moonwell" &&
          pool.stablecoin === true &&
          pool.exposure === "single" &&
          pool.symbol === "USDC"
      )
      // .map(({ chain, apy }) => ({
      //   chain,
      //   apy: Number(apy).toFixed(2),
      // }))
      .sort((a, b) => Number(b.apy) - Number(a.apy));

    console.log("AAVE USDC pools by descending yield:");
    console.log(filteredPools);
    console.log("Number of pools matching the criteria:", filteredPools.length);
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

const fetchStablePools = async () => {
  try {
    const response = await fetch("https://yields.llama.fi/pools");
    const data = await response.json();

    if (data.status !== "success") {
      console.error("Failed to fetch data");
      return;
    }

    const filteredPools = data.data
      .filter(
        (pool: any) =>
          ["Arbitrum", "Base", "Optimism", "Polygon"].includes(pool.chain) &&
          pool.stablecoin === true &&
          pool.exposure === "single" &&
          pool.symbol === "USDC" &&
          pool.tvlUsd > 1_000_000 &&
          pool.underlyingTokens?.includes(usdcAddresses[pool.chain]) // Ensure correct token address
      )
      .map(({ project, chain, apy }) => ({
        project,
        chain,
        apy: Number(apy).toFixed(2),
      }))
      .sort((a, b) => Number(b.apy) - Number(a.apy));

    console.log("stable USDC pools by descending yield:");
    console.log(filteredPools);
    console.log("Number of pools matching the criteria:", filteredPools.length);
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

const fetchHarvest = async () => {
  try {
    const response = await fetch("https://yields.llama.fi/pools");
    const data = await response.json();

    if (data.status !== "success") {
      console.error("Failed to fetch data");
      return;
    }

    const filteredPools = data.data.filter(
      (pool: any) =>
        ["Ethereum"].includes(pool.chain) &&
        pool.project === "harvest-finance" &&
        pool.symbol === "CBBTC" &&
        pool.poolMeta === "Morpho - Seamless"
    );
    //   .map(({ project, chain, apy }) => ({
    //     project,
    //     chain,
    //     apy: Number(apy).toFixed(2),
    //   }))
    //   .sort((a, b) => Number(b.apy) - Number(a.apy));

    console.log("stable USDC pools by descending yield:");
    console.log(filteredPools);
    console.log("Number of pools matching the criteria:", filteredPools.length);
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

// fetchHarvest();

fetchUSDCAavePools();
// fetchStablePools();
