/* ======================================
   AIサポート・レジスタンスブレイク検出
   依存: なし（window関数でグローバル接続）
====================================== */

window.detectSRBreak = function(zones, priceData) {
  if (!zones || !Array.isArray(zones) || !priceData || priceData.length === 0) return zones || [];

  const last = priceData[priceData.length - 1];
  if (!last || typeof last.close !== 'number') return zones;

  zones.forEach(function(z) {
    if (!z) return;
    z.break = null;

    if (z.type === 'resistance' && z.high != null && last.close > z.high) {
      z.break = 'UP';
    }

    if (z.type === 'support' && z.low != null && last.close < z.low) {
      z.break = 'DOWN';
    }
  });

  return zones;
};
