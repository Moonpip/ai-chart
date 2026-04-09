// ============================================
// 下の Probable Range（Zスコア＝偏差ライン）
// panel + layout で ima.html の乖離パネル領域に描画
// ============================================

window.drawReversalRange = function (ctx, data, panel, layout) {
  if (!data || !data.z || !panel || !layout) return;

  const z = data.z;
  const priceLeft = layout.priceLeft ?? 0;
  const gap = layout.gap;
  const start = layout.start;
  const end = layout.end;
  const chartRight = layout.chartRight ?? ctx.canvas.width - (layout.dynamicPadR ?? 0);

  const panelY = panel.top;
  const panelHeight = panel.bottom - panel.top;
  const midY = panelY + panelHeight / 2;
  const scale = layout.zScale != null ? layout.zScale : Math.max(12, panelHeight / 6);

  ctx.save();
  ctx.beginPath();
  ctx.rect(priceLeft, panelY, chartRight - priceLeft, panelHeight);
  ctx.clip();

  ctx.strokeStyle = 'cyan';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let moved = false;

  for (let local = 0; local < end - start; local++) {
    const idx = start + local;
    if (idx < 0 || idx >= z.length) continue;
    const zi = z[idx];
    if (!Number.isFinite(zi)) continue;
    const x = priceLeft + local * gap + gap / 2;
    const y = midY - zi * scale;
    if (!moved) {
      ctx.moveTo(x, y);
      moved = true;
    } else ctx.lineTo(x, y);
  }
  if (moved) ctx.stroke();

  // 中心線（0）
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(priceLeft, midY);
  ctx.lineTo(chartRight, midY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = getContrastAxisColorSafe(ctx);
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Probable Range (Z)', priceLeft + 4, panelY + 4);

  ctx.restore();
};

function getContrastAxisColorSafe(ctx) {
  try {
    if (typeof getContrastAxisColor === 'function') return getContrastAxisColor();
  } catch (e) { /* ignore */ }
  return 'rgba(200,200,200,0.9)';
}
