/**
 * AI勝率ヒートマップ
 * 曜日別（0〜6）上昇率を算出
 */

/**
 * @param {Array} priceData - [{date,open,high,low,close,volume}]
 * @returns {Array<{day:number,upRate:number,count:number}>}
 */
export function computeHeatmap(priceData) {
  if (!Array.isArray(priceData) || priceData.length < 2) return [];

  const byDay = Array.from({ length: 7 }, () => ({ up: 0, down: 0 }));

  for (let i = 1; i < priceData.length; i++) {
    const prev = priceData[i - 1];
    const curr = priceData[i];
    const prevClose = Number(prev?.close);
    const currClose = Number(curr?.close);
    if (!Number.isFinite(prevClose) || !Number.isFinite(currClose)) continue;

    const day = getDayOfWeek(curr.date);
    if (currClose >= prevClose) {
      byDay[day].up++;
    } else {
      byDay[day].down++;
    }
  }

  return byDay.map((d, day) => {
    const total = d.up + d.down;
    const upRate = total > 0 ? Math.round((d.up / total) * 100) : 50;
    return {
      day,
      upRate,
      count: total
    };
  });
}

function getDayOfWeek(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return d.getDay();
}
