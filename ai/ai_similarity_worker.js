/**
 * AI類似チャート計算 Web Worker（安全版）
 * 正規化（％変化）ベースの比較で直近偏向を解消。
 */
function normalizeClose(data) {
  if (!data || data.length === 0) return [];
  const base = Number(data[0].close || 0);
  if (!base) return data.map(function () { return 0; });
  return data.map(function (d) {
    return (Number(d.close || 0) - base) / base;
  });
}

self.onmessage = function (e) {
  const payload = e.data || {};
  const priceData = Array.isArray(payload.priceData) ? payload.priceData : [];
  const config = payload.config || {};

  const result = computeSimilarityWorker(priceData, config);
  self.postMessage(result);
};

function computeSimilarityWorker(priceData, config) {
  const recentLen = Number(config.recent || 40);
  const lookback = Number(config.lookback || 2000);
  const step = Number(config.step || 5);
  const futureLen = Number(config.futureLen || 20);

  if (!Array.isArray(priceData) || priceData.length < recentLen + futureLen + 5) {
    return [];
  }

  var d0 = priceData[0] && priceData[0].date ? String(priceData[0].date) : "";
  var d1 = priceData[priceData.length - 1] && priceData[priceData.length - 1].date ? String(priceData[priceData.length - 1].date) : "";
  if (d0 && d1 && d0 > d1) {
    priceData = priceData.slice().reverse();
  }

  const recent = priceData.slice(-recentLen);
  const recentNorm = normalizeClose(recent);
  const startIndex = Math.max(1, priceData.length - lookback - recentLen - futureLen);
  const endIndex = priceData.length - recentLen - futureLen;

  const results = [];
  console.log("類似比較：正規化モード");

  for (let i = startIndex; i < endIndex; i += step) {
    let score = 0;
    const pastSlice = priceData.slice(i, i + recentLen);
    const pastNorm = normalizeClose(pastSlice);

    for (let j = 1; j < recentLen; j++) {
      const a = recent[j];
      const b = priceData[i + j];
      const prevA = recent[j - 1];
      const prevB = priceData[i + j - 1];

      if (!a || !b || !prevA || !prevB) continue;

      const aClose = Number(a.close || 0);
      const bClose = Number(b.close || 0);
      const prevAClose = Number(prevA.close || 0);
      const prevBClose = Number(prevB.close || 0);

      const aHigh = Number(a.high || aClose);
      const aLow = Number(a.low || aClose);
      const bHigh = Number(b.high || bClose);
      const bLow = Number(b.low || bClose);

      const aVol = Number(a.volume || 0);
      const bVol = Number(b.volume || 0);

      score += Math.abs(recentNorm[j] - pastNorm[j]) * 100;

      const diffA = aClose - prevAClose;
      const diffB = bClose - prevBClose;
      score += Math.abs(diffA - diffB) * 1.5;

      const rangeA = Math.abs(aHigh - aLow);
      const rangeB = Math.abs(bHigh - bLow);
      score += Math.abs(rangeA - rangeB) * 0.8;

      if (aVol > 0 && bVol > 0) {
        score += Math.abs(aVol - bVol) * 0.00001;
      }
    }

    const futureSlice = priceData.slice(i + recentLen, i + recentLen + futureLen);
    const baseBar = priceData[i + recentLen - 1];
    const baseClose = Number(baseBar && baseBar.close ? baseBar.close : 0);

    const future = futureSlice.map((bar, idx) => {
      const close = Number(bar && bar.close ? bar.close : 0);
      const pct = baseClose ? ((close - baseClose) / baseClose) * 100 : 0;
      return { ...bar, index: idx, pct };
    });

    const lastFuture = future.length ? future[future.length - 1] : null;
    const futureReturn = lastFuture ? lastFuture.pct : 0;

    const pastBarEnd = priceData[i + recentLen - 1];
    const pastDateRaw = pastBarEnd && pastBarEnd.date ? pastBarEnd.date : "";
    const pastDate = String(pastDateRaw).slice(0, 10);

    results.push({
      index: i,
      score,
      similarity: Math.max(0, 100 - score / recentLen),
      pastDate,
      future,
      futureReturn
    });
  }

  results.sort((a, b) => a.score - b.score);
  const sliced = results.slice(0, 20);
  if (sliced.length === 0) return [];
  const minScore = sliced[0].score;
  const maxScore = sliced[sliced.length - 1].score;
  const range = Math.max(1e-6, maxScore - minScore);
  return sliced.map(function (r) {
    const simRaw = 100 - r.score / recentLen;
    const simRank = 100 * (1 - (r.score - minScore) / range);
    const similarity = Math.max(0, Math.min(100, simRaw > 0 ? simRaw : simRank));
    return {
      index: r.index,
      score: r.score,
      similarity: Math.round(similarity * 10) / 10,
      pastDate: r.pastDate,
      future: r.future,
      futureReturn: r.futureReturn
    };
  });
}
