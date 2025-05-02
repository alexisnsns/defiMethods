const endpoint = "https://blue-api.morpho.org/graphql";

const morphoVaults = [
  {
    llamaID: "69cf831d-624a-4f23-b5e3-c0f63ad1fa01",
    address: "0xc1256ae5ff1cf2719d4937adb3bbccab2e00a2ca",
  },
  {
    llamaID: "4a22de3c-271e-4152-b8d8-29053de06f37",
    address: "0x616a4e1db48e22028f6bbf20444cd3b8e3273738",
  },
  {
    llamaID: "9f146531-9c31-46ba-8e26-6b59bdaca9ff",
    address: "0x7bfa7c4f149e7415b73bdedfe609237e29cbf34a",
  },
];

export const fetchAllMorphoAPYs = async (): Promise<
  { llamaID: string; APY: string }[]
> => {
  const results: { llamaID: string; APY: string }[] = [];

  for (const vault of morphoVaults) {
    const query = `
      query {
        vaultByAddress(address: "${vault.address}", chainId: 8453) {
          state {
            dailyNetApy
          }
        }
      }
    `;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const result = await response.json();

      const dailyNetApy = result?.data?.vaultByAddress?.state?.dailyNetApy || 0;
      const formattedAPY = (dailyNetApy * 100).toFixed(2);

      results.push({
        llamaID: vault.llamaID,
        APY: formattedAPY,
      });
    } catch (error) {
      console.error(
        `Error fetching Morpho APY for vault ${vault.llamaID}:`,
        error
      );
      results.push({
        llamaID: vault.llamaID,
        APY: "0",
      });
    }
  }

  console.log(results);
  return results;
};

fetchAllMorphoAPYs();
