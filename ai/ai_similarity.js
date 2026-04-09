/**
 * AI類似チャート
 * 直近50本の終値を比較し、距離を計算
 */

/**
 * @param {Array} priceData - [{date,open,high,low,close,volume}]
 * @param {number} [len=50] - 比較に使う本数
 * @returns {{pattern:number[],distance:number}|null}
 */
export function computeSimilarity(priceData, len = 50) {
  if (!Array.isArray(priceData) || priceData.length < len) return null;

  const last = priceData.slice(-len);
  const pattern = last.map((d) => Number(d.close)).filter((v) => Number.isFinite(v));
  if (pattern.length < len) return null;

  // 正規化（0-1）
  const min = Math.min(...pattern);
  const max = Math.max(...pattern);
  const range = max - min || 1;
  const normalized = pattern.map((p) => (p - min) / range);

  // 自己類似度：直近と1本前の50本の距離
  let distance = 0;
  if (priceData.length >= len + 1) {
    const prev = priceData.slice(-len - 1, -1);
    const prevPattern = prev.map((d) => Number(d.close)).filter((v) => Number.isFinite(v));
    if (prevPattern.length >= len) {
      const pMin = Math.min(...prevPattern);
      const pMax = Math.max(...prevPattern);
      const pRange = pMax - pMin || 1;
      const prevNorm = prevPattern.slice(-len).map((p) => (p - pMin) / pRange);
      distance = euclideanDistance(normalized, prevNorm);
    }
  }

  return {
    pattern: normalized.map((v) => Number(v.toFixed(4))),
    distance: Number(distance.toFixed(4))
  };
}

function euclideanDistance(a, b) {
  if (a.length !== b.length || a.length === 0) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }
  return Math.sqrt(sum);
}

/**
 * 類似パターンを検索（AIエンジン用）
 * @param {Array} priceData
 * @param {number} [len=50]
 * @param {number} [topN=5]
 * @returns {Array<{startIndex:number,distance:number}>}
 */
export function findSimilar(priceData, len = 50, topN = 5) {
  const result = computeSimilarity(priceData, len);
  if (!result) return [];

  if (priceData.length < len * 2) {
    return [{ startIndex: -1, distance: result.distance }];
  }

  const current = priceData.slice(-len).map((d) => Number(d.close)).filter(Number.isFinite);
  if (current.length < len) return [];

  const cMin = Math.min(...current);
  const cMax = Math.max(...current);
  const cRange = cMax - cMin || 1;
  const currentNorm = current.map((p) => (p - cMin) / cRange);

  const candidates = [];
  for (let i = 0; i <= priceData.length - len - 1; i++) {
    const seg = priceData.slice(i, i + len);
    const segCloses = seg.map((d) => Number(d.close)).filter(Number.isFinite);
    if (segCloses.length < len) continue;

    const sMin = Math.min(...segCloses);
    const sMax = Math.max(...segCloses);
    const sRange = sMax - sMin || 1;
    const segNorm = segCloses.map((p) => (p - sMin) / sRange);
    const dist = euclideanDistance(currentNorm, segNorm);
    candidates.push({ startIndex: i, distance: dist });
  }

  candidates.sort((a, b) => a.distance - b.distance);
  return candidates.slice(1, topN + 1).map(({ startIndex, distance }) => ({
    startIndex,
    distance: Number(distance.toFixed(4))
  }));
}
