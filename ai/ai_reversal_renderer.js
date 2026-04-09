/* ======================================
   AI逆張りゾーン描画（プロ仕様）
   買い→緑帯、売り→赤帯／強さ可視化／理由表示
   依存: なし（window関数でグローバル接続）
====================================== */

window.drawReversalZones = function(ctx, zones, xScale, priceToY) {
  if (!zones || !Array.isArray(zones) || !ctx) return;
  if (typeof xScale !== 'function' || typeof priceToY !== 'function') return;

  zones.forEach(function(z) {
    if (!z || z.low == null || z.high == null) return;
    const idx = z.index != null ? z.index : 0;

    const x = xScale(idx);
    const y1 = priceToY(z.high);
    const y2 = priceToY(z.low);

    // 強さで透明度変更
    const alpha = Math.min(0.4, (z.score || 60) / 200);

    let color;
    if (z.type === 'BUY') {
      color = 'rgba(0,255,150,' + alpha + ')'; // 買い→緑帯
    } else {
      color = 'rgba(255,80,80,' + alpha + ')'; // 売り→赤帯
    }

    // ===== ゾーン描画（帯）=====
    ctx.fillStyle = color;
    ctx.fillRect(x - 10, y1, 20, y2 - y1);

    // ===== テキスト（買/売 + スコア）=====
    ctx.fillStyle = '#fff';
    ctx.font = '9px Arial';
    ctx.fillText(
      (z.type === 'BUY' ? '買' : '売') + ' ' + (z.score || 0),
      x - 12,
      y1 - 4
    );

    // ===== 理由表示（RSI）=====
    ctx.fillStyle = '#aaa';
    ctx.font = '8px Arial';
    const rsiVal = (z.reason && z.reason.rsi != null) ? z.reason.rsi : '-';
    ctx.fillText('RSI:' + rsiVal, x - 14, y2 + 10);
  });
};
