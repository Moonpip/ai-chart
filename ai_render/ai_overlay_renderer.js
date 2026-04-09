/**
 * AIオーバーレイ統合
 * drawFutureZone と AI描画（サポート・レジスタンス、暴落、類似、ヒートマップ）を描画
 */

import { drawFutureZone } from './ai_future_zone_renderer.js?v=5';
import { extendLine } from '../ai/ai_trend.js';

/**
 * AI分析結果をチャートに描画
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} chart - { yPrice, priceTop, priceBottom, priceLeft, priceRight, width, height }
 * @param {{futureZone:object,heatmap:Array,crash:object,similar:Array,lines:object}} AI
 */
export function drawAIOverlay(ctx, chart, AI) {
  if (!ctx || !chart || !AI) return;
  try {
    const showZone = (typeof window !== 'undefined' && window.aiDisplayFlags && window.aiDisplayFlags.zone !== false);
    if (showZone) {
      if (AI.montecarlo) {
        drawFutureZone(ctx, chart, AI.montecarlo);
      } else if (AI.futureZone) {
        drawFutureZone(ctx, chart, AI.futureZone);
      }
    }

    /* ===============================
    AIサポートレジスタンス（AIボタン内でON/OFF可能）
    =============================== */
    const flags = typeof window !== 'undefined' ? window.aiDisplayFlags : {};
    if (AI.lines) {
      ctx.save();
      ctx.lineWidth = 1;
      if (flags.resistanceLines !== false && AI.lines.swingHighs && AI.lines.swingHighs.length) {
        ctx.strokeStyle = '#ff9900';
        AI.lines.swingHighs.forEach((l) => {
          const y = chart.yPrice(l.price);
          ctx.beginPath();
          ctx.moveTo(chart.priceLeft, y);
          ctx.lineTo(chart.priceRight, y);
          ctx.stroke();
        });
      }
      if (flags.supportLines !== false && AI.lines.swingLows && AI.lines.swingLows.length) {
        ctx.strokeStyle = '#00ffaa';
        AI.lines.swingLows.forEach((l) => {
          const y = chart.yPrice(l.price);
          ctx.beginPath();
          ctx.moveTo(chart.priceLeft, y);
          ctx.lineTo(chart.priceRight, y);
          ctx.stroke();
        });
      }
      ctx.restore();
    }

    /* ===============================
    AIトレンドライン（サポート/レジスタンス分離・未来へ延長）
    =============================== */
    const tl = AI.trendLines;
    if (tl && (tl.supportLine || tl.resistanceLine) && flags.trendLines !== false) {
      const candleWidth = chart.gap ?? 1;
      const priceToY = (p) => chart.yPrice(p);
      const dataBase = (chart.dataLength ?? 0) - (chart.aiSlicedLength ?? 0);
      const chartStart = chart.start ?? 0;

      function drawLine(line, color) {
        if (!line) return;
        const ext = extendLine(line, 100);
        const toX = (idx) => chart.priceLeft + (dataBase + idx - chartStart) * candleWidth + candleWidth / 2;
        const x1 = toX(line.x1);
        const y1 = priceToY(line.y1);
        const x2 = toX(ext.x2);
        const y2 = priceToY(ext.y2);
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
      }
      if (tl.supportLine) drawLine(tl.supportLine, 'lime');
      if (tl.resistanceLine) drawLine(tl.resistanceLine, 'red');
    }

    /* ===============================
    AI暴落検出（AIボタン内でON/OFF可能）
    =============================== */
    if (AI.crash && flags.crashLines !== false) {
      const y = chart.yPrice(AI.crash.close);
      ctx.save();
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(chart.priceLeft, y);
      ctx.lineTo(chart.priceRight, y);
      ctx.stroke();
      ctx.fillStyle = '#ff0000';
      ctx.font = '12px sans-serif';
      ctx.fillText(
        'AI暴落 ' + AI.crash.change + '%',
        chart.priceLeft + 8,
        y - 6
      );
      ctx.restore();
    }

    /* ===============================
    AIサポート・レジスタンスゾーン（POC・srZones で ON/OFF可能）
    =============================== */
    if (flags.poc !== false && flags.srZones !== false && AI && AI.srZones && Array.isArray(AI.srZones) && AI.srZones.length > 0 && typeof window.drawSRZones === 'function') {
      const priceToY = chart && typeof chart.yPrice === 'function' ? chart.yPrice : function () { return 0; };
      const cv = ctx && ctx.canvas ? ctx.canvas : null;
      const chartLeft = (chart && chart.priceLeft != null) ? chart.priceLeft : 0;
      const chartRightVal = (chart && chart.priceRight != null) ? chart.priceRight : (cv ? cv.width : 0);
      if (cv) window.drawSRZones(ctx, AI.srZones, priceToY, cv, chartLeft, chartRightVal);
    }

  } catch (e) {
    console.warn('drawAIOverlay:', e);
  }
}

if (typeof window !== 'undefined') {
  window.drawAIOverlay = drawAIOverlay;

  // runAIEngine の結果を window.AI に自動保存（既存 runAIEngine をラップ）
  const orig = window.runAIEngine;
  if (typeof orig === 'function') {
    window.runAIEngine = function (priceData) {
      const result = orig(priceData) || {};

      const unified = window.computeUnifiedFutureForecast(priceData, 3);
      if (unified) {
        result.futureZone = {
          upper: unified.upper,
          mid: unified.mid,
          lower: unified.lower,
          probability: unified.probability,
          volatility: unified.volatility
        };
        result.futureDays = unified.days;
        window.aiUnifiedForecast = unified;
      }

      window.AI = result;

      if (typeof window.updateSimilarityPanel === 'function') {
        window.updateSimilarityPanel(result, priceData);
      }

      return result;
    };
  }
}
