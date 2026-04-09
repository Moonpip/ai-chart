/**
 * AI暴落検出
 * 1日 -8% 以下の下落を検出
 */

/**
 * @param {Array} priceData - [{date,open,high,low,close,volume}]
 * @returns {Array<{date:string,change:number,prevClose:number,close:number}>}
 */
export function computeCrash(priceData) {
  if (!Array.isArray(priceData) || priceData.length < 2) return [];

  const crashes = [];
  const threshold = -8;

  for (let i = 1; i < priceData.length; i++) {
    const prev = priceData[i - 1];
    const curr = priceData[i];
    const prevClose = Number(prev?.close);
    const currClose = Number(curr?.close);
    if (!Number.isFinite(prevClose) || !Number.isFinite(currClose) || prevClose <= 0) continue;

    const change = ((currClose - prevClose) / prevClose) * 100;
    if (change <= threshold) {
      crashes.push({
        date: String(curr?.date ?? ''),
        change: Number(change.toFixed(2)),
        prevClose,
        close: currClose
      });
    }
  }

  return crashes;
}

/**
 * 直近の暴落を1件返す（AIエンジン用）
 * @param {Array} priceData
 * @returns {{date:string,change:number,prevClose:number,close:number}|null}
 */
export function detectCrash(priceData) {
  const list = computeCrash(priceData);
  return list.length > 0 ? list[list.length - 1] : null;
}
