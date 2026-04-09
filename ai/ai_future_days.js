/**
 * AI未来日数予測
 * 1〜3日先
 * ATR + ボラティリティ
 */

function calcATR(data, period = 14) {
  let sum = 0;

  for (let i = data.length - period; i < data.length; i++) {
    const h = Number(data[i]?.high ?? data[i]?.h ?? 0);
    const l = Number(data[i]?.low ?? data[i]?.l ?? 0);

    if (Number.isFinite(h) && Number.isFinite(l)) {
      sum += h - l;
    }
  }

  return sum / period;
}

export function predictFutureDays(dataset) {
  if (!Array.isArray(dataset)) return null;
  if (dataset.length < 20) return null;

  const data = dataset;

  const last = Number(data[data.length - 1]?.close ?? data[data.length - 1]?.c);

  if (!Number.isFinite(last)) return null;

  const atr = calcATR(data, 14);
  const vol = atr / last;

  function make(day) {
    const f = Math.sqrt(day);

    return {
      upper: last + atr * f,
      mid: last,
      lower: last - atr * f,
      probability: Math.round(60 + day * 5),
      volatility: vol
    };
  }

  return {
    d1: make(1),
    d2: make(2),
    d3: make(3)
  };
}
