/**
 * AIモンテカルロ未来予測
 * 過去リターンから未来価格分布を生成
 */

export function computeMonteCarloFuture(priceData, simulations = 1000, days = 3) {
  if (!Array.isArray(priceData) || priceData.length < 30) return null;

  const closes = priceData.map((d) => Number(d.close)).filter(Number.isFinite);

  const lastPrice = closes[closes.length - 1];

  const returns = [];

  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }

  if (returns.length < 10) return null;

  const paths = [];

  for (let s = 0; s < simulations; s++) {
    let price = lastPrice;

    for (let d = 0; d < days; d++) {
      const r = returns[Math.floor(Math.random() * returns.length)];
      price = price * (1 + r);
    }

    paths.push(price);
  }

  paths.sort((a, b) => a - b);

  const lower = paths[Math.floor(paths.length * 0.1)];
  const mid = paths[Math.floor(paths.length * 0.5)];
  const upper = paths[Math.floor(paths.length * 0.9)];

  const upCount = paths.filter((p) => p > lastPrice).length;
  const probability = (upCount / paths.length) * 100;

  return {
    lower: Number(lower.toFixed(2)),
    mid: Number(mid.toFixed(2)),
    upper: Number(upper.toFixed(2)),
    probability: Number(probability.toFixed(1)),
    volatility: Number(stdDev(paths).toFixed(4))
  };
}

function stdDev(arr) {
  const mean = arr.reduce((a, b) => a + b) / arr.length;

  const variance =
    arr.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / arr.length;

  return Math.sqrt(variance);
}
