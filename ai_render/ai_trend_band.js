// ============================================
// 順張りバンド描画（雲ゾーン・上昇重視）
// ma25/ma75 間の雲ゾーンを描画。順張りなので上昇トレンド時は緑を強調
// ============================================

window.drawTrendBand = function (ctx, data, priceData, priceToY, layout) {
  if (!data || !priceData || !priceData.length || typeof priceToY !== 'function') return;

  const ma25 = data.ma25;
  const ma75 = data.ma75;
  if (!Array.isArray(ma25) || !Array.isArray(ma75)) return;

  const useChart = layout && layout.gap != null && layout.start != null && layout.priceLeft != null;
  const i0 = useChart ? layout.start : 0;
  const i1 = useChart ? layout.end : priceData.length;

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

  const state = data.state || 'SIDEWAYS';
  const isMobile = window.innerWidth <= 768;
  const alphaBoost = isMobile ? 0.2 : 0;

  // ma25 と ma75 の間を雲ゾーンとして塗りつぶし
  ctx.beginPath();
  let moved = false;
  for (let i = i0; i < i1; i++) {
    const v25 = ma25[i];
    const v75 = ma75[i];
    if (v25 == null || v75 == null) continue;
    const x = xAtIndex(i);
    if (x == null) continue;
    const upper = Math.max(v25, v75);
    const yUpper = priceToY(upper);
    if (!moved) {
      ctx.moveTo(x, yUpper);
      moved = true;
    } else {
      ctx.lineTo(x, yUpper);
    }
  }
  for (let i = i1 - 1; i >= i0; i--) {
    const v25 = ma25[i];
    const v75 = ma75[i];
    if (v25 == null || v75 == null) continue;
    const x = xAtIndex(i);
    if (x == null) continue;
    const lower = Math.min(v25, v75);
    const yLower = priceToY(lower);
    ctx.lineTo(x, yLower);
  }
  if (moved) {
    ctx.closePath();
    const chartTop = layout?.chartTop ?? 0;
    const chartBottom = layout?.chartBottom ?? ctx.canvas.height;
    const useGradient = layout && chartTop != null && chartBottom != null;
    if (useGradient) {
      const grad = ctx.createLinearGradient(0, chartTop, 0, chartBottom);
      const base = { UPTREND: { r: 0, g: 200, b: 120 }, DOWNTREND: { r: 255, g: 80, b: 80 }, SIDEWAYS: { r: 150, g: 180, b: 220 } }[state];
      const aTop = Math.min(1, (state === 'UPTREND' ? 0.5 : state === 'SIDEWAYS' ? 0.35 : 0.25) + alphaBoost);
      const aBottom = Math.min(1, (state === 'UPTREND' ? 0.2 : state === 'SIDEWAYS' ? 0.1 : 0.06) + alphaBoost * 0.5);
      grad.addColorStop(0, `rgba(${base.r},${base.g},${base.b},${aTop})`);
      grad.addColorStop(0.4, `rgba(${base.r},${base.g},${base.b},${(aTop + aBottom) / 2})`);
      grad.addColorStop(1, `rgba(${base.r},${base.g},${base.b},${aBottom})`);
      ctx.fillStyle = grad;
    } else {
      if (state === 'UPTREND') {
        ctx.fillStyle = `rgba(0, 200, 120, ${Math.min(1, 0.38 + alphaBoost)})`;
      } else if (state === 'DOWNTREND') {
        ctx.fillStyle = `rgba(255, 80, 80, ${Math.min(1, 0.12 + alphaBoost)})`;
      } else {
        ctx.fillStyle = `rgba(150, 180, 220, ${Math.min(1, 0.15 + alphaBoost)})`;
      }
    }
    ctx.fill();
  }

  // 雲ゾーン上部オーバーレイ（順張り＝上昇重視で上を濃く）
  ctx.beginPath();
  moved = false;
  for (let i = i0; i < i1; i++) {
    const v25 = ma25[i];
    const v75 = ma75[i];
    if (v25 == null || v75 == null) continue;
    const x = xAtIndex(i);
    if (x == null) continue;
    const upper = Math.max(v25, v75);
    const lower = Math.min(v25, v75);
    const mid = (upper + lower) / 2;
    const y = priceToY(mid);
    if (!moved) {
      ctx.moveTo(x, y);
      moved = true;
    } else ctx.lineTo(x, y);
  }
  for (let i = i1 - 1; i >= i0; i--) {
    const v25 = ma25[i];
    const v75 = ma75[i];
    if (v25 == null || v75 == null) continue;
    const x = xAtIndex(i);
    if (x == null) continue;
    const upper = Math.max(v25, v75);
    const y = priceToY(upper);
    ctx.lineTo(x, y);
  }
  if (moved) {
    ctx.closePath();
    const upperAlpha = isMobile ? 0.25 : 0.15;
    if (state === 'UPTREND') {
      ctx.fillStyle = `rgba(0, 220, 140, ${Math.min(1, 0.2 + upperAlpha)})`;
    } else if (state === 'SIDEWAYS') {
      ctx.fillStyle = `rgba(100, 160, 220, ${Math.min(1, 0.12 + upperAlpha)})`;
    } else {
      ctx.fillStyle = `rgba(255, 90, 90, ${Math.min(1, 0.06 + upperAlpha * 0.5)})`;
    }
    ctx.fill();
  }

  // 上昇トレンド時：雲ゾーン上部に追加の上昇強調ゾーン（MA上側の広がり）
  if (state === 'UPTREND') {
    const ma25Last = ma25[ma25.length - 1];
    const ma75Last = ma75[ma75.length - 1];
    const baseMa = Math.min(ma25Last, ma75Last);
    const range = Math.abs((ma25Last ?? 0) - (ma75Last ?? 0)) || baseMa * 0.02;
    const expand = range * 1.5;

    ctx.beginPath();
    moved = false;
    for (let i = i0; i < i1; i++) {
      const v25 = ma25[i];
      const v75 = ma75[i];
      if (v25 == null || v75 == null) continue;
      const x = xAtIndex(i);
      if (x == null) continue;
      const upper = Math.max(v25, v75) + expand;
      const y = priceToY(upper);
      if (!moved) {
        ctx.moveTo(x, y);
        moved = true;
      } else ctx.lineTo(x, y);
    }
    for (let i = i1 - 1; i >= i0; i--) {
      const v25 = ma25[i];
      const v75 = ma75[i];
      if (v25 == null || v75 == null) continue;
      const x = xAtIndex(i);
      if (x == null) continue;
      const upper = Math.max(v25, v75);
      const y = priceToY(upper);
      ctx.lineTo(x, y);
    }
    if (moved) {
      ctx.closePath();
      ctx.fillStyle = `rgba(0, 230, 140, ${Math.min(1, 0.22 + alphaBoost)})`;
      ctx.fill();
    }
  }

  // 雲の境界線（上昇時は緑、下降時は赤（薄め）／スマホ時は濃く）
  const lineAlphaBoost = isMobile ? 0.2 : 0;
  ctx.strokeStyle = state === 'UPTREND'
    ? `rgba(0, 200, 120, ${Math.min(1, 0.65 + lineAlphaBoost)})`
    : state === 'DOWNTREND'
      ? `rgba(255, 100, 100, ${Math.min(1, 0.45 + lineAlphaBoost)})`
      : `rgba(150, 180, 220, ${Math.min(1, 0.4 + lineAlphaBoost)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  let started = false;
  for (let i = i0; i < i1; i++) {
    const v25 = ma25[i];
    const v75 = ma75[i];
    if (v25 == null || v75 == null) continue;
    const x = xAtIndex(i);
    if (x == null) continue;
    const upper = Math.max(v25, v75);
    const y = priceToY(upper);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
  }
  if (started) ctx.stroke();
  ctx.beginPath();
  started = false;
  for (let i = i0; i < i1; i++) {
    const v25 = ma25[i];
    const v75 = ma75[i];
    if (v25 == null || v75 == null) continue;
    const x = xAtIndex(i);
    if (x == null) continue;
    const lower = Math.min(v25, v75);
    const y = priceToY(lower);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
  }
  if (started) ctx.stroke();

  ctx.restore();
};
