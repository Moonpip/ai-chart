/* ======================================
   AIサポート・レジスタンスゾーン描画
   依存: なし（window関数でグローバル接続）
   左端表示・長押しドラッグでまとめて移動可能（window.srZonePanelOffset / localStorage）
====================================== */

window.drawSRZones = function(ctx, zones, priceToY, canvas, chartLeft, chartRight) {
  if (!zones || !Array.isArray(zones) || !ctx) return;

  const cvs = canvas || (ctx && ctx.canvas);
  if (!cvs || typeof cvs.width !== 'number') return;

  if (!window.srZoneLabelOffsets) window.srZoneLabelOffsets = {};
  window.__srZoneLabelRects = [];

  const width = cvs.width;
  const fillLeft = (chartLeft != null && Number.isFinite(chartLeft)) ? chartLeft : 0;
  const fillRight = (chartRight != null && Number.isFinite(chartRight)) ? chartRight : width;
  const fillW = Math.max(1, fillRight - fillLeft);
  const pad = 6;
  const labelLeftBase = fillLeft + 4;
  if (!window.srZonePanelOffset) {
    try {
      const s = localStorage.getItem('srZonePanelPos');
      if (s) {
        const o = JSON.parse(s);
        if (Number.isFinite(o.x) && Number.isFinite(o.y)) window.srZonePanelOffset = { x: o.x, y: o.y };
      }
    } catch (_) {}
    if (!window.srZonePanelOffset) window.srZonePanelOffset = { x: 0, y: 0 };
  }
  const panelOff = window.srZonePanelOffset;

  zones.forEach(function(z) {
    if (!z || (z.price == null && (z.low == null || z.high == null))) return;
    if (typeof priceToY !== 'function') return;

    const price = z.price != null ? z.price : (z.low + z.high) / 2;
    const y = priceToY(price);

    const zoneKey = (z.type || 's') + '_' + price.toFixed(2) + '_' + (z.touches || 0);

    const touches = z.touches || 1;
    const isMobile = window.innerWidth <= 768;
    const alphaBoost = isMobile ? 0.25 : 0;
    const widthBoost = isMobile ? 0.4 : 0;

    let alpha, lineWidth, dash;
    if (touches <= 1) {
      alpha = 0.55;
      lineWidth = 1;
      dash = [2, 6];
    } else if (touches === 2) {
      alpha = 0.75;
      lineWidth = 1.2;
      dash = [4, 4];
    } else if (touches === 3) {
      alpha = 0.9;
      lineWidth = 1.4;
      dash = [6, 2];
    } else {
      alpha = 1;
      lineWidth = 1.5;
      dash = [];
    }
    if (z.break) dash = [4, 4];

    alpha = Math.min(1, alpha + alphaBoost);
    lineWidth += widthBoost;

    const baseRgb = z.type === 'support' ? '0,255,150' : '255,80,80';
    const lineColor = 'rgba(' + baseRgb + ',' + alpha + ')';

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(fillLeft, y);
    ctx.lineTo(fillRight, y);
    ctx.stroke();
    ctx.setLineDash([]);

    const labelY = y;
    const zoneLabel = z.type === 'support' ? 'サポート' : 'レジスタンス';
    const touchesLabel = (z.touches || 0) + '回';
    const mainText = zoneLabel + '(' + touchesLabel + ')';
    ctx.font = 'bold 12px system-ui, sans-serif';
    const tw = ctx.measureText(mainText).width;
    const boxW = tw + pad * 2;
    let boxX = labelLeftBase + (panelOff.x || 0);
    let boxY = labelY - 10 + (panelOff.y || 0);
    const boxH = 20;

    var off = window.srZoneLabelOffsets && window.srZoneLabelOffsets[zoneKey];
    if (off && (off.x != null || off.y != null)) {
      boxX += off.x || 0;
      boxY += off.y || 0;
    }
    window.__srZoneLabelRects.push({ key: zoneKey, x: boxX, y: boxY, w: boxW, h: boxH });

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = z.type === 'support' ? 'rgba(0,255,150,0.6)' : 'rgba(255,80,80,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(mainText, boxX + pad, boxY + boxH / 2);

    if (z.break === 'UP') {
      const breakText = '↑突破';
      ctx.font = 'bold 11px system-ui, sans-serif';
      const bw = ctx.measureText(breakText).width;
      const breakBoxW = bw + pad * 2;
      let bx = labelLeftBase + (panelOff.x || 0);
      let by = labelY + 6 + (panelOff.y || 0);
      var breakKey = zoneKey + '_break';
      var boff = window.srZoneLabelOffsets[breakKey];
      if (boff && (boff.x != null || boff.y != null)) {
        bx += boff.x || 0;
        by += boff.y || 0;
      }
      window.__srZoneLabelRects.push({ key: breakKey, x: bx, y: by, w: breakBoxW, h: 16 });
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx, by, breakBoxW, 16);
      ctx.fillStyle = '#ff4444';
      ctx.fillText(breakText, bx + pad, by + 8);
    }

    if (z.break === 'DOWN') {
      const breakText = '↓突破';
      ctx.font = 'bold 11px system-ui, sans-serif';
      const bw = ctx.measureText(breakText).width;
      const breakBoxW = bw + pad * 2;
      let bx = labelLeftBase + (panelOff.x || 0);
      let by = labelY + 6 + (panelOff.y || 0);
      var breakKey = zoneKey + '_break';
      var boff = window.srZoneLabelOffsets[breakKey];
      if (boff && (boff.x != null || boff.y != null)) {
        bx += boff.x || 0;
        by += boff.y || 0;
      }
      window.__srZoneLabelRects.push({ key: breakKey, x: bx, y: by, w: breakBoxW, h: 16 });
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx, by, breakBoxW, 16);
      ctx.fillStyle = '#00ff88';
      ctx.fillText(breakText, bx + pad, by + 8);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  });
};
