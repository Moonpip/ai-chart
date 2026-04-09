export function computePatternFuture(priceData, similar) {
  if (!similar || similar.length === 0) return null;
  const best = similar[0];
  const start = best.startIndex;
  if (start < 0) return null;
  const after = priceData.slice(start + 50, start + 60);
  if (after.length === 0) return null;
  const avg = after.reduce((a, b) => a + b.close, 0) / after.length;
  return {
    futureAvg: avg,
    distance: best.distance
  };
}
