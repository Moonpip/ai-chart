// ============================================
// 逆張りゾーン描画（価格追従リボン・参考画像スタイル）
// ============================================

window.drawReversalZone = function(ctx, data, scaleY, chartRight) {
  if (!ctx || !data) return;
  const chart = (typeof scaleY === 'object' && scaleY !== null) ? scaleY : null;
  const priceToY = chart && typeof chart.yPrice === 'function' ? chart.yPrice : null;
  if (!priceToY) return;

  const { upper1, upper2, upper3, lower1, lower2, lower3, maArr } = data;
  if (!upper3 || !lower3 || !maArr) return;

  const priceLeft = chart && chart.priceLeft != null ? chart.priceLeft : 0;
  const priceRight = chart && chart.priceRight != null ? chart.priceRight : (ctx.canvas ? ctx.canvas.width : 0);
  const chartTop = chart && chart.priceTop != null ? chart.priceTop : 0;
  const chartBottom = chart && chart.priceBottom != null ? chart.priceBottom : (ctx.canvas ? ctx.canvas.height : 0);
  const xScale = chart && typeof chart.xScale === 'function' ? chart.xScale : (i) => i * (ctx.canvas.width / maArr.length);
  const start = chart && chart.start != null ? chart.start : 0;
  const gap = chart && chart.gap != null ? chart.gap : Math.max(1, (priceRight - priceLeft) / 200);
  const dataLen = maArr.length;
  const visEnd = Math.min(start + Math.ceil((priceRight - priceLeft) / gap) + 1, dataLen);
  const visStart = Math.max(0, start);

  ctx.save();
  ctx.beginPath();
  ctx.rect(priceLeft, chartTop, priceRight - priceLeft, chartBottom - chartTop);
  ctx.clip();

  // === 上部：MA→upper1→upper2→upper3 の赤グラデーション ===
  const upperBands = [maArr, upper1, upper2, upper3];
  for (let b = 0; b < upperBands.length - 1; b++) {
    const bandLo = upperBands[b];
    const bandHi = upperBands[b + 1];
    const alpha = 0.08 + (b + 1) * 0.06;
    const r = Math.min(255, 150 + (b + 1) * 35);
    ctx.fillStyle = `rgba(${r},60,60,${alpha})`;
    ctx.beginPath();
    for (let i = visStart; i < visEnd; i++) {
      const pLo = bandLo[i], pHi = bandHi[i];
      if (pLo == null || pHi == null) continue;
      const x = xScale(i);
      const yLo = priceToY(pLo), yHi = priceToY(pHi);
      if (i === visStart) ctx.moveTo(x, yLo);
      else ctx.lineTo(x, yLo);
    }
    for (let i = visEnd - 1; i >= visStart; i--) {
      const pHi = bandHi[i];
      if (pHi == null) continue;
      const x = xScale(i);
      const yHi = priceToY(pHi);
      ctx.lineTo(x, yHi);
    }
    ctx.closePath();
    ctx.fill();
  }

  // === 下部：MA→lower1→lower2→lower3 のシアングラデーション ===
  const lowerBands = [maArr, lower1, lower2, lower3];
  for (let b = 0; b < lowerBands.length - 1; b++) {
    const bandLo = lowerBands[b];
    const bandHi = lowerBands[b + 1];
    const alpha = 0.08 + (b + 1) * 0.06;
    const g = Math.min(255, 150 + (b + 1) * 35);
    const bVal = Math.min(255, 180 + (b + 1) * 25);
    ctx.fillStyle = `rgba(60,${g},${bVal},${alpha})`;
    ctx.beginPath();
    for (let i = visStart; i < visEnd; i++) {
      const pLo = bandLo[i], pHi = bandHi[i];
      if (pLo == null || pHi == null) continue;
      const x = xScale(i);
      const yLo = priceToY(pLo), yHi = priceToY(pHi);
      if (i === visStart) ctx.moveTo(x, yLo);
      else ctx.lineTo(x, yLo);
    }
    for (let i = visEnd - 1; i >= visStart; i--) {
      const pHi = bandHi[i];
      if (pHi == null) continue;
      const x = xScale(i);
      const yHi = priceToY(pHi);
      ctx.lineTo(x, yHi);
    }
    ctx.closePath();
    ctx.fill();
  }

  // === 上部外側：太い赤ライン ===
  ctx.strokeStyle = 'rgba(255,80,80,0.9)';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = visStart; i < visEnd; i++) {
    const p = upper3[i];
    if (p == null) continue;
    const x = xScale(i);
    const y = priceToY(p);
    if (i === visStart) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // === 下部外側：太いシアンライン ===
  ctx.strokeStyle = 'rgba(0,255,200,0.9)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = visStart; i < visEnd; i++) {
    const p = lower3[i];
    if (p == null) continue;
    const x = xScale(i);
    const y = priceToY(p);
    if (i === visStart) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.restore();
};
