/**
 * AI未来価格エンジン
 * 1〜3日先の価格レンジを予測
 *
 * 入力: dataset
 * 使用指標: ATR（Average True Range）
 * 出力: { upper, mid, lower, probability, volatility }
 */

/**
 * ATR（Average True Range）を計算
 * @param {Array<{high:number,low:number}>} data
 * @param {number} period
 * @returns {number}
 */
function calcATR(data, period = 14) {
  if (!Array.isArray(data) || data.length < period) return 0;
  let sum = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const high = Number(data[i]?.high ?? data[i]?.h ?? 0);
    const low = Number(data[i]?.low ?? data[i]?.l ?? 0);
    if (Number.isFinite(high) && Number.isFinite(low)) {
      sum += high - low;
    }
  }
  return sum / period;
}

/**
 * 1〜3日先の価格レンジを予測（ATRベース）
 * @param {Array<{date:string,open:number,high:number,low:number,close:number,volume?:number}>} dataset
 * @returns {{upper:number,mid:number,lower:number,probability:number,volatility:number}|null}
 */
export function predictFutureRange(dataset) {
  if (!Array.isArray(dataset) || dataset.length < 14) return null;

  const data = dataset;
  const last = Number(data[data.length - 1]?.close ?? data[data.length - 1]?.c);
  if (!Number.isFinite(last)) return null;

  // ATR取得
  const atr = calcATR(data, 14);
  if (!Number.isFinite(atr) || atr <= 0) return null;

  // ゾーン（ATRベース）
  const upper = last + atr * 1.2;
  const mid = last;
  const lower = last - atr * 1.2;

  // ボラティリティ（ATR/価格の比率、表示用％）
  const volPct = last > 0 ? atr / last : 0;

  // トレンド強度（移動平均との乖離）→ 確率
  const ma20Closes = data.slice(-20).map((d) => Number(d?.close ?? d?.c)).filter(Number.isFinite);
  const ma20 = ma20Closes.length > 0 ? ma20Closes.reduce((a, b) => a + b, 0) / ma20Closes.length : last;
  const trendStrength = ma20 !== 0 ? Math.max(-1, Math.min(1, (last - ma20) / ma20 * 10)) : 0;
  const prob = Math.min(90, Math.max(10, 50 + trendStrength * 40));

  return {
    upper: Number(upper.toFixed(2)),
    mid: Number(mid.toFixed(2)),
    lower: Number(lower.toFixed(2)),
    probability: Number(prob.toFixed(1)),
    volatility: Number(volPct.toFixed(6))
  };
}

if (typeof window !== 'undefined') {
  window.predictFutureRange = predictFutureRange;
}

// ===== unified AI forecast =====
// 上昇・下降のバイアス（約75/25パーセンタイル相当）
const SCENARIO_BIAS = 0.674;

window.computeUnifiedFutureForecast = function (priceData, days = 3) {
  if (!priceData || priceData.length < 30) return null;

  const closes = priceData.map(d => Number(d.close));
  const last = closes[closes.length - 1];

  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (prev <= 0) continue;
    returns.push((curr - prev) / prev);
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  const vol = Math.sqrt(variance);

  // 基準シナリオ（従来通り）
  const daysResult = [];
  for (let d = 1; d <= days; d++) {
    const expected = last * (1 + mean * d);
    const range = last * vol * Math.sqrt(d);
    daysResult.push({
      day: d,
      upper: expected + range,
      mid: expected,
      lower: expected - range,
      probability: 50 + (mean * 100),
      volatility: vol * 100
    });
  }

  // 上昇シナリオ（最新日から上昇した場合）: drift = mean + bias*vol
  const driftUp = mean + SCENARIO_BIAS * vol;
  const risingDays = [];
  for (let d = 1; d <= days; d++) {
    const mid = last * (1 + driftUp * d);
    const range = last * vol * Math.sqrt(d);
    risingDays.push({
      day: d,
      upper: mid + range,
      mid,
      lower: mid - range
    });
  }

  // 下降シナリオ（最新日から下降した場合）: drift = mean - bias*vol
  const driftDown = mean - SCENARIO_BIAS * vol;
  const fallingDays = [];
  for (let d = 1; d <= days; d++) {
    const mid = last * (1 + driftDown * d);
    const range = last * vol * Math.sqrt(d);
    fallingDays.push({
      day: d,
      upper: mid + range,
      mid,
      lower: mid - range
    });
  }

  return {
    upper: daysResult[0].upper,
    mid: daysResult[0].mid,
    lower: daysResult[0].lower,
    probability: daysResult[0].probability,
    volatility: daysResult[0].volatility,
    days: daysResult,
    risingDays,
    fallingDays
  };
};
