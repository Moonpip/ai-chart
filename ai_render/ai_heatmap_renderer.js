/**
 * AI曜日別勝率ヒートマップ描画
 * チャート右上に7曜日分を表示
 * 赤(50%) 〜 青(70%以上)
 */

/**
 * 勝率から色を算出（50%=赤、70%+=青）
 * @param {number} upRate - 0-100
 * @returns {string} rgba
 */
function heatmapColor(upRate) {
  const r = Number(upRate);
  // 50%以下: 赤寄り、70%以上: 青、その間: グラデーション
  if (r <= 50) {
    const t = r / 50;
    return `rgba(255,${Math.round(80 * (1 - t))},${Math.round(80 * (1 - t))},0.85)`;
  }
  if (r >= 70) {
    return 'rgba(80,120,255,0.9)';
  }
  const t = (r - 50) / 20;
  return `rgba(${Math.round(255 - 175 * t)},${Math.round(80 - 120 * t)},255,0.85)`;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} chart - { priceRight:number, priceTop:number, width:number }
 * @param {Array<{day:number,upRate:number,count:number}>} heatmap
 */
export function drawWinRateHeatmap(ctx, chart, heatmap) {
  if (!Array.isArray(heatmap) || heatmap.length === 0) return;

  const pad = 8;
  const boxW = 24;
  const boxH = 18;
  const cols = 7;
  const totalW = cols * boxW + pad * 2;
  const totalH = boxH + pad * 2;

  const right = chart.priceRight ?? ctx.canvas?.width ?? 220;
  const top = chart.priceTop ?? 16;
  const x = right - totalW - 10;
  const y = top + 4;

  ctx.save();

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.fillRect(x, y, totalW, totalH);
  ctx.strokeRect(x, y, totalW, totalH);

  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  for (let i = 0; i < Math.min(7, heatmap.length); i++) {
    const d = heatmap[i];
    const upRate = Number(d?.upRate ?? 50);
    const bx = x + pad + (i % cols) * boxW;
    const by = y + pad;
    ctx.fillStyle = heatmapColor(upRate);
    ctx.fillRect(bx, by, boxW - 2, boxH - 2);
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dayNames[d?.day ?? i], bx + (boxW - 2) / 2, by + (boxH - 2) / 2);
  }

  ctx.restore();
}
