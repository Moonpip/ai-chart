/**
 * AI Analysis Engine - メインエンジン
 * 株価データを使ったAI分析を統合
 *
 * 入力: priceData 配列
 * 戻り値: { futureZone, heatmap, crash, similar, lines }
 */

import { computeFutureZone } from './ai_future_zone.js';
import { predictFutureDays } from './ai_future_days.js';
import { predictFutureRange } from './ai_future_engine.js';
import { computeHeatmap } from './ai_heatmap.js';
import { detectCrash } from './ai_crash_detector.js';
import { findSimilar } from './ai_similarity.js';
import { computeLines } from './ai_line_engine.js';
import { computeBreakout } from './ai_breakout.js';
import { computeTrend, computeTrendStrength, computeAITrendLines, detectTrendBreak, detectTrend } from './ai_trend.js';
import { computePatternFuture } from './ai_pattern_future.js';
import { computeWinrateMap } from './ai_winrate_map.js';
import { computeMonteCarloFuture } from './ai_montecarlo_future.js';

let cachedAI = null;
let lastLength = 0;

/**
 * AI分析エンジン実行
 * @param {Array<{date:string,open:number,high:number,low:number,close:number,volume:number}>} priceData
 * @returns {{futureZone:object, heatmap:Array, crash:object|null, similar:Array, lines:object}}
 */
export function runAIEngine(priceData) {
  if (cachedAI && Array.isArray(priceData) && priceData.length === lastLength && priceData.length > 0) {
    return cachedAI;
  }
  lastLength = Array.isArray(priceData) ? priceData.length : 0;

  if (!Array.isArray(priceData) || priceData.length === 0) {
    const empty = {
      futureZone: null,
      futureForecast: null,
      futureDays: null,
      montecarlo: null,
      heatmap: [],
      crash: null,
      similar: [],
      lines: { swingHighs: [], swingLows: [] },
      breakout: null,
      trend: null,
      trendInfo: { direction: '-', strength: 0, breakState: 'NONE' },
      trendLines: { supportLine: null, resistanceLine: null },
      patternFuture: null,
      winrateMap: null
    };
    console.log('AI', empty);
    return empty;
  }

  const linesResult = computeLines(priceData);
  const lines = {
    swingHighs: linesResult.resistances,
    swingLows: linesResult.supports
  };
  const similar = findSimilar(priceData);
  const trend = computeTrendStrength(priceData);
  const trendLines = computeAITrendLines(priceData, linesResult);
  let breakState = 'NONE';
  if (trendLines?.supportLine) {
    breakState = detectTrendBreak(priceData, trendLines.supportLine);
  } else if (trendLines?.resistanceLine) {
    breakState = detectTrendBreak(priceData, trendLines.resistanceLine);
  }
  const slopeTrend = detectTrend(trendLines?.supportLine, trendLines?.resistanceLine);
  const trendInfo = {
    direction: trend.direction,
    strength: trend.strength,
    breakState,
    slopeTrend
  };
  const AI = {
    futureZone: computeFutureZone(priceData),
    futureForecast: predictFutureRange(priceData),
    futureDays: predictFutureDays(priceData),
    montecarlo: computeMonteCarloFuture(priceData),
    heatmap: computeHeatmap(priceData),
    crash: detectCrash(priceData),
    similar,
    lines,
    breakout: computeBreakout(priceData, lines),
    trend: computeTrend(priceData),
    trendInfo,
    trendLines,
    patternFuture: computePatternFuture(priceData, similar),
    winrateMap: computeWinrateMap(priceData)
  };

  if (typeof window !== 'undefined' && typeof window.computeSupportResistance === 'function') {
    try {
      AI.srZones = window.computeSupportResistance(priceData);
      if (AI.srZones && Array.isArray(AI.srZones)) {
        AI.srZones.forEach(function (z) {
          if (z && typeof window.computeSRScore === 'function') z.score = window.computeSRScore(z, priceData);
        });
        if (typeof window.detectSRBreak === 'function') AI.srZones = window.detectSRBreak(AI.srZones, priceData);
      }
    } catch (e) {
      console.warn('AI srZones:', e);
    }
  }

  console.log('AI', AI);
  cachedAI = AI;
  return AI;
}

// グローバルから呼び出し可能にする（既存コードとの連携用）
if (typeof window !== 'undefined') {
  window.runAIEngine = runAIEngine;
}
