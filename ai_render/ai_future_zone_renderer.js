/**
 * AI未来価格ゾーン描画（単一ゾーン形式）
 * 上値・中央値・下値による青い半透明ゾーン＋情報ボックス（ゾーン/上値/中央値/下値/確率/ボラ）
 * ※上昇・下降の3日間バーは廃止し、ゾーン表示に統一
 */

/** 価格を表示用にフォーマット */
function fmtPrice(v) {
  if (!Number.isFinite(v)) return '―';
  if (v >= 1000) return v.toFixed(0);
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(4);
}

/**
 * 単一ゾーン描画：青ゾーン＋半透明情報ボックス（ゾーン/上値/中央値/下値/確率/ボラ）
 */
function drawSimpleZone(ctx, chart, forecast, baseLeft, baseRight, lastIndex, gap) {
  const upper = forecast.upper ?? forecast.zoneUpper;
  const mid = forecast.mid ?? forecast.zoneMid;
  const lower = forecast.lower ?? forecast.zoneLower;
  const { probability, volatility } = forecast;
  const zoneLeft = baseLeft + lastIndex * gap;
  const zoneWidth = 4 * gap;
  const zoneRight = Math.min(zoneLeft + zoneWidth, baseRight);
  if (zoneLeft >= zoneRight) return;

  const yUpper = chart.yPrice(upper);
  const yLower = chart.yPrice(lower);
  const yMid = chart.yPrice(mid);
  const top = Math.min(yUpper, yLower);
  const bottom = Math.max(yUpper, yLower);
  const zoneHeight = Math.max(1, bottom - top);

  // 青ゾーン（半透明）
  ctx.fillStyle = 'rgba(0, 120, 255, 0.2)';
  ctx.fillRect(zoneLeft, top, zoneRight - zoneLeft, zoneHeight);

  // upper/lower線
  ctx.strokeStyle = 'rgba(0, 120, 255, 0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(zoneLeft, yUpper);
  ctx.lineTo(zoneRight, yUpper);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(zoneLeft, yLower);
  ctx.lineTo(zoneRight, yLower);
  ctx.stroke();

  // mid線（点線）
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(zoneLeft, yMid);
  ctx.lineTo(zoneRight, yMid);
  ctx.stroke();
  ctx.setLineDash([]);

  // 半透明情報ボックス（画像スタイル）
  const pad = 4;
  const lineH = 16;
  const rows = ['ゾーン', `上値${fmtPrice(upper)}`, `中央値${fmtPrice(mid)}`, `下値${fmtPrice(lower)}`];
  if (Number.isFinite(probability)) rows.push(`確率${probability.toFixed(0)}%`);
  if (Number.isFinite(volatility)) {
    const volNum = volatility < 2 ? Math.round(volatility * 100) : Math.round(volatility);
    rows.push(`ボラ${volNum}`);
  }
  const boxW = 110;
  const boxH = pad * 2 + rows.length * lineH;
  const boxX = zoneRight + pad;
  const boxY = (top + bottom) / 2 - boxH / 2;
  const maxY = Number.isFinite(ctx.canvas?.height) ? ctx.canvas.height - boxH - 4 : boxY;
  const boxYClamped = Math.max(4, Math.min(maxY, boxY));

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.strokeStyle = '#2bbcff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(boxX, boxYClamped, boxW, boxH);
  ctx.fill();
  ctx.stroke();

  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e6e6e6';
  rows.forEach((text, i) => {
    ctx.fillStyle = i === 0 ? '#2bbcff' : '#e6e6e6';
    ctx.fillText(text, boxX + pad, boxYClamped + pad + (i + 0.5) * lineH);
  });
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} chart - { yPrice(price):number, priceLeft:number, priceRight:number, lastIndex:number, gap:number }
 * @param {{upper:number,mid:number,lower:number,probability?:number,volatility?:number}|null} futureZone
 */
export function drawFutureZone(ctx, chart, futureZone) {
  const forecast = window.aiUnifiedForecast || window.AI?.futureZone || futureZone;
  if (!forecast || !chart?.yPrice) return;

  const baseLeft = chart.priceLeft ?? 0;
  const baseRight = chart.priceRight ?? ctx.canvas?.width ?? chart.width;
  const lastIndex = chart.lastIndex ?? 0;
  const gap = chart.gap ?? 1;

  // 過去チャート表示時は描画しない（最新足の右側のみ描画対象）
  if (lastIndex < 0) return;

  const upper = forecast.upper ?? forecast.zoneUpper;
  const mid = forecast.mid ?? forecast.zoneMid;
  const lower = forecast.lower ?? forecast.zoneLower;
  const hasSimpleZone = Number.isFinite(upper) && Number.isFinite(lower) && Number.isFinite(mid);

  // ゾーン形式を優先（上昇・下降3日間の個別バーではなく、単一ゾーン＋半透明情報ボックス）
  if (hasSimpleZone) {
    ctx.save();
    drawSimpleZone(ctx, chart, forecast, baseLeft, baseRight, lastIndex, gap);
    ctx.restore();
    return;
  }

  // ゾーンデータがなければ描画しない（上昇・下降3日間バーは廃止し、ゾーン形式のみ）
}
