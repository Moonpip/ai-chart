// ============================================
// 逆張りAI コア（完全版）
// ============================================

window.computeReversal = function (priceData) {
  if (!priceData || !priceData.length) {
    return {
      ma: [],
      z: [],
      rsi: null,
      state: 'NORMAL',
      score: 50,
      lastZ: null,
      deviationPct: 0,
      percentile: 0,
      meanReversion: 0,
      successRate: 50,
      position: '中間',
      volumeSpike: false,
      winRate: 50
    };
  }

  const closes = priceData.map(d => d.close);

  const maPeriod = 25;
  const ma = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < maPeriod) {
      ma.push(null);
      continue;
    }

    const avg = closes.slice(i - maPeriod, i).reduce((a, b) => a + b, 0) / maPeriod;
    ma.push(avg);
  }

  // =====================
  // 乖離率
  // =====================
  const dev = closes.map((c, i) => {
    if (!ma[i]) return 0;
    return (c - ma[i]) / ma[i];
  });

  // =====================
  // Zスコア
  // =====================
  const avg = dev.reduce((a, b) => a + b, 0) / dev.length;
  const std = Math.sqrt(dev.reduce((a, b) => a + (b - avg) ** 2, 0) / dev.length);

  const z = dev.map(d => (d - avg) / (std || 1));

  // =====================
  // RSI
  // =====================
  const rsi = calcRSI(closes, 14);

  const lastZ = z[z.length - 1];
  const lastRSI = rsi.length ? rsi[rsi.length - 1] : null;
  const price = closes[closes.length - 1];

  // =====================
  // サポレジ
  // =====================
  const recent = closes.slice(-50);
  const max = Math.max(...recent);
  const min = Math.min(...recent);

  let score = 50;

  if (lastZ > 1.5) score += 20;
  if (lastZ < -1.5) score += 20;

  if (lastRSI != null && lastRSI > 70) score += 15;
  if (lastRSI != null && lastRSI < 30) score += 15;

  if (Math.abs(price - max) / max < 0.02) score += 10;
  if (Math.abs(price - min) / min < 0.02) score += 10;

  let state = 'NORMAL';
  if (lastZ > 1.5) state = 'OVERHEAT';
  if (lastZ < -1.5) state = 'OVERSOLD';

  // =====================
  // 逆張りフィルター強化（安全版）
  // =====================

  const candles = priceData;
  const now = candles[candles.length - 1];
  const prev = candles.length >= 2 ? candles[candles.length - 2] : null;

  if (prev && ma.length >= 2 && ma[ma.length - 2] != null) {
    const lastMA = ma[ma.length - 1];
    const prevMA = ma[ma.length - 2];

    // ① トレンド判定（MA傾き）
    const downTrend = lastMA < prevMA;
    const upTrend = lastMA > prevMA;

    // ② バンド下抜けチェック
    const bandLower = lastMA * 0.98;
    const belowBand = now.close < bandLower;

    // ③ 反転チェック
    const bullish = now.close > now.open;
    const lowerWick = Math.min(now.open, now.close) - now.low;
    const range = now.high - now.low || 1;
    const strongReversal = lowerWick > range * 0.4;
    const stopFall = now.close >= prev.close;

    // ④ スコア調整（ここが核心）
    if (state === 'OVERSOLD') {
      if (downTrend) score -= 30;
      if (belowBand) score -= 25;
      if (!bullish) score -= 20;
      if (!strongReversal) score -= 15;
      if (!stopFall) score -= 15;
    }

    if (state === 'OVERHEAT') {
      if (upTrend) score -= 30;
      const bandUpper = lastMA * 1.02;
      const aboveBand = now.close > bandUpper;
      if (aboveBand) score -= 25;
    }
  }

  // =====================
  // 出来高解析
  // =====================
  const volumes = priceData.map(d => d.volume || 0);
  const volMA = volumes.length >= 20 ? volumes.slice(-20).reduce((a, b) => a + b, 0) / 20 : 1;
  const currentVol = volumes[volumes.length - 1] || 0;
  const volumeSpike = currentVol > volMA * 1.5;

  // =====================
  // 勝率学習（簡易AI）
  // =====================
  let win = 0;
  let total = 0;
  const rsiPeriod = 14;

  for (let i = 50; i < priceData.length - 5; i++) {
    const pastZ = z[i];
    const rsiIdx = i - rsiPeriod;
    const pastRSI = rsiIdx >= 0 && rsiIdx < rsi.length ? rsi[rsiIdx] : 50;

    if (Math.abs(pastZ - lastZ) < 0.3 && Math.abs(pastRSI - (lastRSI ?? 50)) < 5) {
      total++;
      const futureReturn = (closes[i + 5] - closes[i]) / closes[i];

      if (pastZ < -1.5 && futureReturn > 0) win++;
      if (pastZ > 1.5 && futureReturn < 0) win++;
    }
  }

  let winRate = 50;
  if (total > 5) {
    winRate = Math.floor((win / total) * 100);
  }

  // =====================
  // スコア調整（出来高＋勝率）
  // =====================
  if (state === 'OVERSOLD' && volumeSpike) score += 15;
  if (state === 'OVERSOLD' && !volumeSpike) score -= 10;

  score += (winRate - 50) * 0.5;

  score = Math.max(5, score);
  score = Math.min(95, score);

  // =====================
  // 乖離率（%）
  // =====================
  const deviationPct = closes.map((c, i) => {
    if (!ma[i]) return 0;
    return ((c - ma[i]) / ma[i]) * 100;
  });

  // =====================
  // 過去200日ランキング
  // =====================
  const recentDev = deviationPct.slice(-200);
  const sorted = [...recentDev].sort((a, b) => Math.abs(b) - Math.abs(a));

  const currentDev = deviationPct[deviationPct.length - 1];
  const rankIndex = sorted.findIndex(
    v => Math.abs(Math.abs(v) - Math.abs(currentDev)) < 1e-9
  );

  const percentile =
    sorted.length > 0 && rankIndex >= 0
      ? Math.floor((rankIndex / sorted.length) * 100)
      : 0;

  // =====================
  // 平均回帰幅
  // =====================
  const meanReversion = -currentDev * 0.5;

  // =====================
  // 成功率（簡易）
  // =====================
  let successRate = 50;

  if (Math.abs(currentDev) > 5) successRate += 10;
  if (Math.abs(currentDev) > 8) successRate += 10;
  if (lastRSI != null && (lastRSI > 70 || lastRSI < 30)) successRate += 10;

  successRate = Math.min(85, successRate);

  // =====================
  // 位置判定
  // =====================
  let position = '中間';

  if (Math.abs(price - max) / max < 0.02) position = 'レジスタンス';
  if (Math.abs(price - min) / min < 0.02) position = 'サポート';

  return {
    ma,
    z,
    rsi: lastRSI,
    state,
    score,
    lastZ,

    deviationPct: currentDev,
    percentile,
    meanReversion,
    successRate,
    position,
    volumeSpike,
    winRate
  };
};

// RSI
function calcRSI(closes, period) {
  const gains = [];
  const losses = [];

  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  const rsi = [];

  for (let i = period; i < gains.length; i++) {
    const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    const rs = avgGain / (avgLoss || 1);
    rsi.push(100 - 100 / (1 + rs));
  }

  return rsi;
}
