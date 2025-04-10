import { ethers } from "ethers";

const endpoint = "https://blue-api.morpho.org/graphql";

const query = `
  query {
    vaultByAddress(
      address: "0xc1256Ae5FF1cf2719D4937adb3bbCCab2E00A2Ca"
      chainId: 8453
    ) {
      state {
        dailyNetApy
      }
    }
  }
`;

// Function to fetch data from GraphQL endpoint
async function fetchAPY() {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: query,
      }),
    });

    const result = await response.json();

    // Check for any errors in the response
    if (result.errors) {
      console.error("Error fetching data:", result.errors);
      return;
    }

    // Extract APY data
    const { dailyNetApy } = result.data.vaultByAddress.state;

    // Log the APY values
    console.log(`Net APY: ${(dailyNetApy * 100).toFixed(2)} %`);
  } catch (error) {
    console.error("Error:", error);
  }
}

fetchAPY();

// TO PLAY WITH THE QUERY

// query {
//   vaultByAddress(
//     address: "0xc1256Ae5FF1cf2719D4937adb3bbCCab2E00A2Ca"
//     chainId: 8453 
//   ) {
//     id
//     state {
    
//       apy
//       netApy
//       totalAssets
//       allTimeApy
//       allTimeNetApy
//       dailyApy
//       dailyNetApy
//       id
//       netApyWithoutRewards
      
//       weeklyApy
//       weeklyNetApy
//       yearlyApy
//       yearlyNetApy
//     }
//   }
// }