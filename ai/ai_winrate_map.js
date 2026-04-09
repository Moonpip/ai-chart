export function computeWinrateMap(priceData) {
  if (priceData.length < 2) return null;
  let win = 0;
  let lose = 0;
  for (let i = 1; i < priceData.length; i++) {
    if (priceData[i].close > priceData[i - 1].close) win++;
    else lose++;
  }
  const total = win + lose;
  return {
    winRate: Math.round((win / total) * 100),
    loseRate: Math.round((lose / total) * 100)
  };
}
