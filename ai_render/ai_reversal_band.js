// ============================================
// 逆張りバンド描画（画像再現）
// layout 指定時: ima.html の gap / start / priceLeft に同期
// ============================================

function getATR(data, period = 14) {
  const trs = [];

  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );

    trs.push(tr);
  }

  const atr = [];
  for (let i = period; i < trs.length; i++) {
    const avg = trs.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    atr.push(avg);
  }

  return atr;
}

window.drawReversalBand = function (ctx, data, priceData, priceToY, layout) {
  if (!data || !data.ma || !priceData || !priceData.length || typeof priceToY !== 'function') return;

  const ma = data.ma;
  const zArr = data.z || [];
  const lastZ = zArr[zArr.length - 1] || 0;
  const atrArr = getATR(priceData, 14);
  const lastATR = atrArr[atrArr.length - 1] || 0;
  const zFactor = Math.min(Math.abs(lastZ) / 2, 2);
  const dynamicATR = lastATR * (0.85 + zFactor * 0.4);
  const levels = [1, 2, 3];

  const useChart = layout && layout.gap != null && layout.start != null && layout.priceLeft != null;

  function xAtIndex(i) {
    if (useChart) {
      const local = i - layout.start;
      if (local < 0 || i >= layout.end) return null;
      return layout.priceLeft + local * layout.gap + layout.gap / 2;
    }
    const w = ctx.canvas.width;
    const stepX = w / priceData.length;
    return i * stepX;
  }

  ctx.save();
  if (layout && layout.chartTop != null && layout.chartBottom != null) {
    ctx.beginPath();
    ctx.rect(
      layout.priceLeft ?? 0,
      layout.chartTop,
      (layout.chartRight ?? ctx.canvas.width) - (layout.priceLeft ?? 0),
      layout.chartBottom - layout.chartTop
    );
    ctx.clip();
  }

  levels.forEach((lv, idx) => {
    const i0 = useChart ? layout.start : 0;
    const i1 = useChart ? layout.end : priceData.length;

    // ============================
    // 上ゾーン（MAより上）→ 赤のみ（そのまま）
    // ============================
    ctx.beginPath();
    let moved = false;
    for (let i = i0; i < i1; i++) {
      if (!ma[i]) continue;
      const x = xAtIndex(i);
      if (x == null) continue;
      const y = priceToY(ma[i] + dynamicATR * lv * 0.4);
      if (!moved) {
        ctx.moveTo(x, y);
        moved = true;
      } else ctx.lineTo(x, y);
    }
    for (let i = i1 - 1; i >= i0; i--) {
      if (!ma[i]) continue;
      const x = xAtIndex(i);
      if (x == null) continue;
      const y = priceToY(ma[i] * 1); // MA中心
      ctx.lineTo(x, y);
    }
    if (moved) {
      ctx.closePath();
      const redAlpha = 0.04 + idx * 0.04;
      ctx.fillStyle = `rgba(255,60,60,${redAlpha})`;
      ctx.fill();
    }

    // ============================
    // 下ゾーン（MAより下）→ 緑のみ（かなり薄く）
    // ============================
    ctx.beginPath();
    moved = false;
    for (let i = i0; i < i1; i++) {
      if (!ma[i]) continue;
      const x = xAtIndex(i);
      if (x == null) continue;
      const y = priceToY(ma[i] * 1); // MA中心
      if (!moved) {
        ctx.moveTo(x, y);
        moved = true;
      } else ctx.lineTo(x, y);
    }
    for (let i = i1 - 1; i >= i0; i--) {
      if (!ma[i]) continue;
      const x = xAtIndex(i);
      if (x == null) continue;
      const y = priceToY(ma[i] - dynamicATR * lv * 0.55);
      ctx.lineTo(x, y);
    }
    if (moved) {
      ctx.closePath();
      const greenAlpha = 0.06 + idx * 0.05;
      ctx.fillStyle = `rgba(0,255,180,${greenAlpha})`;
      ctx.fill();
    }
  });

  // 外ライン
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 1;
  ctx.beginPath();
  let started = false;
  const j0 = useChart ? layout.start : 0;
  const j1 = useChart ? layout.end : priceData.length;
  for (let i = j0; i < j1; i++) {
    if (!ma[i]) continue;
    const x = xAtIndex(i);
    if (x == null) continue;
    const y = priceToY(ma[i] * 1.02);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
  }
  if (started) ctx.stroke();

  ctx.strokeStyle = 'cyan';
  ctx.beginPath();
  started = false;
  for (let i = j0; i < j1; i++) {
    if (!ma[i]) continue;
    const x = xAtIndex(i);
    if (x == null) continue;
    const y = priceToY(ma[i] * 0.98);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
  }
  if (started) ctx.stroke();

  ctx.restore();
};
