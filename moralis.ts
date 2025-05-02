import Moralis from "moralis";

try {
  await Moralis.start({
    apiKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjBkZjEyYTdjLWNiYWEtNGI5Yy1iNDhjLWQwZDZiYTM1NTBkMyIsIm9yZ0lkIjoiNDQzMjU2IiwidXNlcklkIjoiNDU2MDU0IiwidHlwZUlkIjoiM2VhYTVkZWQtZDlhMC00ZTg2LWJiMzQtNWQ1NGVkYzQ3ZmM0IiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NDUzMzIxMjEsImV4cCI6NDkwMTA5MjEyMX0.H37ws7MNZNk6kyIo8T08rVeO621xlUE-_qmjWQCVwy4",
  });

  const response = await Moralis.SolApi.account.getPortfolio({
    network: "mainnet",
    address: "APfsPRTSjeRSRM6Ne1TdjeLab3rjVxkfLi8YdfG7s7eW",
  });

  console.log(response);
} catch (e) {
  console.error(e);
}
