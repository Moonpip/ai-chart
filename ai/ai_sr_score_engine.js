/* ======================================
   AIサポート・レジスタンス強さスコア
   依存: なし（window関数でグローバル接続）
====================================== */

window.computeSRScore = function(zone, priceData) {
  if (!zone || !priceData || !Array.isArray(priceData)) return 0;

  let score = 0;

  score += (zone.touches || 0) * 20;

  const lastIndex = zone.indices && zone.indices.length > 0
    ? zone.indices[zone.indices.length - 1]
    : 0;
  const recent = priceData.length - lastIndex;
  score += Math.max(0, 30 - recent);

  let vol = 0;
  if (zone.indices && Array.isArray(zone.indices)) {
    zone.indices.forEach(function(i) {
      const d = priceData[i];
      if (d && typeof d.volume === 'number') vol += d.volume;
    });
  }
  score += Math.min(30, vol / 1000000);

  return score;
};
