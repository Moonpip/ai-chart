// ============================================
// 順張りAI コア（トレンドフォロー）
// ============================================

function calcSimpleMA(closes, period) {
  if (!closes || closes.length < period) return [];
  const ma = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      ma.push(null);
      continue;
    }
    const sum = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    ma.push(sum / period);
  }
  return ma;
}

window.computeTrend = function (priceData) {
  if (!priceData || !Array.isArray(priceData) || priceData.length < 30) {
    return null;
  }

  const closes = priceData.map((d) => Number(d.close) || 0);
  const first = closes[0];
  const last = closes[closes.length - 1];
  const slope = first ? ((last - first) / first) * 100 : 0;

  const ma25 = calcSimpleMA(closes, 25);
  const ma75 = calcSimpleMA(closes, 75);
  const ma25Last = ma25[ma25.length - 1];
  const ma75Last = ma75[ma75.length - 1];

  let upPoints = 0;
  let downPoints = 0;
  if (slope > 3) upPoints += 2;
  if (slope < -3) downPoints += 2;
  if (ma25Last != null && ma75Last != null) {
    if (ma25Last > ma75Last) upPoints += 2;
    if (ma25Last < ma75Last) downPoints += 2;
  }

  let higherHigh = 0;
  let lowerLow = 0;
  const slice = priceData.slice(-30);
  for (let i = 1; i < slice.length; i++) {
    if ((slice[i].high ?? 0) > (slice[i - 1].high ?? 0)) higherHigh++;
    if ((slice[i].low ?? 0) < (slice[i - 1].low ?? 0)) lowerLow++;
  }
  if (higherHigh >= 10) upPoints += 2;
  if (lowerLow >= 10) downPoints += 2;

  let label = '横ばい';
  let state = 'SIDEWAYS';
  let action = '様子見';
  let score = 50;

  if (upPoints >= downPoints + 2) {
    label = '上昇トレンド';
    state = 'UPTREND';
    action = '🟢 買い検討';
    score = Math.min(95, 50 + (upPoints - downPoints) * 8);
  } else if (downPoints >= upPoints + 2) {
    label = '下降トレンド';
    state = 'DOWNTREND';
    action = '🔴 売り検討';
    score = Math.min(95, 50 + (downPoints - upPoints) * 8);
  }

  return {
    label,
    state,
    action,
    score,
    slope: slope != null && Number.isFinite(slope) ? slope : 0,
    upPoints,
    downPoints,
    ma25Last,
    ma75Last,
    ma25,
    ma75,
    price: last
  };
};
