/**
 * AI未来価格ゾーン
 * ATR + 確率 + ボラティリティで upper, mid, lower を算出
 */

/**
 * ATR + 確率 + ボラティリティでAI未来予測を計算
 * @param {Array} data - [{close,high,low}]
 * @returns {{upper:number,mid:number,lower:number,probability:number,volatility:number,atr:number}|null}
 */
function calculateAIForecast(data) {
  if (!Array.isArray(data)) return null;
  if (data.length < 20) return null;

  const closes = data.map((d) => Number(d?.close ?? d?.c));
  const highs = data.map((d) => Number(d?.high ?? d?.h ?? 0));
  const lows = data.map((d) => Number(d?.low ?? d?.l ?? 0));
  if (closes.length < 20 || closes.some((v) => !Number.isFinite(v))) return null;

  const last = closes[closes.length - 1];

  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((a, b) => a + (b - mean) * (b - mean), 0) / returns.length;
  const volatility = Math.sqrt(variance);

  let atr = 0;
  for (let i = 1; i < data.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    atr += tr;
  }
  atr = atr / (data.length - 1);

  const upCount = returns.filter((r) => r > 0).length;
  const probability = Math.round((upCount / returns.length) * 100);

  const forecast = {
    upper: last + atr * 1.2,
    mid: last,
    lower: last - atr * 1.2,
    probability: Math.min(100, Math.max(0, probability)),
    volatility: volatility * 100,
    atr
  };
  return forecast;
}

/**
 * @param {Array} priceData - [{date,open,high,low,close,volume}]
 * @returns {{upper:number,mid:number,lower:number}|null}
 */
export function computeFutureZone(priceData) {
  if (!Array.isArray(priceData) || priceData.length < 20) return null;

  const data = priceData.slice(-50).map((d) => ({
    close: Number(d?.close ?? d?.c),
    high: Number(d?.high ?? d?.h ?? 0),
    low: Number(d?.low ?? d?.l ?? 0)
  }));

  const forecast = calculateAIForecast(data);
  if (forecast) {
    return {
      upper: Number(forecast.upper.toFixed(2)),
      mid: Number(forecast.mid.toFixed(2)),
      lower: Number(forecast.lower.toFixed(2)),
      probability: forecast.probability,
      volatility: Number(forecast.volatility.toFixed(4))
    };
  }

  if (priceData.length < 50) return null;
  const last50 = priceData.slice(-50);
  const dataLegacy = last50.map((d) => ({ close: Number(d.close) })).filter((d) => Number.isFinite(d.close));
  if (dataLegacy.length < 50) return null;

  const closes = dataLegacy.map((d) => d.close);
  const last = closes[closes.length - 1];

  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((a, b) => a + (b - mean) * (b - mean), 0) / returns.length;
  const volatility = Math.sqrt(variance) * 100;
  const upCount = returns.filter((r) => r > 0).length;
  const probability = Math.round((upCount / returns.length) * 100);

  const upper = last * (1 + volatility / 200);
  const mid = last;
  const lower = last * (1 - volatility / 200);

  return {
    upper: Number(upper.toFixed(2)),
    mid: Number(mid.toFixed(2)),
    lower: Number(lower.toFixed(2)),
    probability,
    volatility: Number(volatility.toFixed(4))
  };
}
