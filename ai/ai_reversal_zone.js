/* ======================================
   AI逆張りゾーン（リバーサルゾーン）
   RSI + ヒゲ + 出来高 + サポレジ融合
   依存: なし（window関数でグローバル接続）
====================================== */

window.computeReversalZones = function(priceData, srZones) {
  if (!priceData || !Array.isArray(priceData)) return [];

  const zones = [];

  for (let i = 20; i < priceData.length; i++) {
    const p = priceData[i];
    if (!p || typeof p.close !== 'number' || typeof p.open !== 'number') continue;

    let score = 0;

    // RSI風（簡易）
    let gain = 0;
    let loss = 0;
    for (let j = i - 14; j < i; j++) {
      if (j <= 0 || !priceData[j] || !priceData[j - 1]) continue;
      const diff = priceData[j].close - priceData[j - 1].close;
      if (diff > 0) gain += diff;
      else loss += Math.abs(diff);
    }
    const rs = gain / (loss || 1);
    const rsi = 100 - (100 / (1 + rs));

    // RSI判定
    if (rsi < 30) score += 30;
    if (rsi > 70) score += 30;

    // ヒゲ判定
    const body = Math.abs(p.close - p.open);
    const lowerWick = Math.max(0, p.open - (p.low != null ? p.low : p.open));
    const upperWick = Math.max(0, (p.high != null ? p.high : p.close) - p.close);
    if (lowerWick > body * 2) score += 20;
    if (upperWick > body * 2) score += 20;

    // サポレジ接触
    let srTouch = false;
    if (srZones && Array.isArray(srZones)) {
      srZones.forEach(function(z) {
        if (!z || z.low == null || z.high == null) return;
        if (p.low <= z.high && p.high >= z.low) {
          score += 25;
          srTouch = true;
        }
      });
    }

    // 出来高
    if (p.volume > 0) {
      let sum = 0;
      let count = 0;
      for (let k = i - 20; k < i; k++) {
        if (k >= 0 && priceData[k] && typeof priceData[k].volume === 'number') {
          sum += priceData[k].volume;
          count++;
        }
      }
      const avgVol = count > 0 ? sum / count : 0;
      if (avgVol > 0 && p.volume > avgVol * 1.5) score += 20;
    }

    // 急変動
    const prev = priceData[i - 1];
    if (prev && typeof prev.close === 'number' && prev.close > 0) {
      const change = Math.abs(p.close - prev.close) / prev.close;
      if (change > 0.03) score += 20;
    }

    // ゾーン生成
    if (score >= 60) {
      const wickSignal = lowerWick > body * 2 || upperWick > body * 2;
      zones.push({
        index: i,
        price: p.close,
        low: p.low != null ? p.low : p.close,
        high: p.high != null ? p.high : p.close,
        score: score,
        type: rsi < 30 ? 'BUY' : 'SELL',
        reason: {
          rsi: Math.round(rsi),
          wick: wickSignal,
          volume: p.volume != null ? p.volume : 0,
          srTouch: srTouch
        }
      });
    }
  }

  return zones;
};
