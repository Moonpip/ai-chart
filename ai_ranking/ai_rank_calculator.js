// ai_ranking/ai_rank_calculator.js — 既存 AI 値優先、欠損は価格履歴から類似局面ベースで算出

import { getAIFields } from "./ai_rank_source.js";

const metricsCache = new WeakMap();

const K_NEAREST = 20;
const MIN_SIMILAR = 8;
const MIN_INDEX = 25;

function closeOf(bar) {
  if (!bar) return null;
  const x = bar.close ?? bar.c;
  return x != null && Number.isFinite(x) ? x : null;
}

function volumeOf(bar) {
  if (!bar) return null;
  const x = bar.volume ?? bar.v;
  return x != null && Number.isFinite(x) && x >= 0 ? x : null;
}

/**
 * @param {Array} history
 * @param {number} i 参照日のインデックス
 * @returns {[number, number, number]|null} 5日騰落率、25日乖離、出来高比
 */
export function buildStateVector(history, i) {
  if (!history || i < MIN_INDEX || i >= history.length) return null;

  const c0 = closeOf(history[i]);
  const c5 = closeOf(history[i - 5]);
  if (c0 == null || c5 == null || c5 === 0) return null;

  const ret5 = (c0 - c5) / c5;

  let maSum = 0;
  for (let k = i - 24; k <= i; k++) {
    const ck = closeOf(history[k]);
    if (ck == null) return null;
    maSum += ck;
  }
  const ma25 = maSum / 25;
  if (ma25 === 0) return null;
  const dev25 = (c0 - ma25) / ma25;

  let volSum = 0;
  for (let k = i - 4; k <= i; k++) {
    const vk = volumeOf(history[k]);
    if (vk == null) return null;
    volSum += vk;
  }
  const volAvg = volSum / 5;
  if (volAvg === 0) return null;

  const vi = volumeOf(history[i]);
  if (vi == null) return null;
  const volRatio = vi / volAvg;

  return [ret5, dev25, volRatio];
}

export function distance(a, b) {
  if (!a || !b || a.length !== 3 || b.length !== 3) return Infinity;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * 類似局面（状態ベクトル距離が小さい順に最大 K_NEAREST）の次足リターンを集める
 */
function collectSimilarNextReturns(history) {
  if (!history || history.length < MIN_INDEX + 3) return null;

  const currentIdx = history.length - 1;
  const target = buildStateVector(history, currentIdx);
  if (!target) return null;

  const scored = [];
  for (let j = MIN_INDEX; j <= history.length - 2; j++) {
    const state = buildStateVector(history, j);
    if (!state) continue;
    const cj = closeOf(history[j]);
    const cj1 = closeOf(history[j + 1]);
    if (cj == null || cj1 == null || cj === 0) continue;
    const dist = distance(state, target);
    if (!Number.isFinite(dist)) continue;
    const nextRet = (cj1 - cj) / cj;
    if (!Number.isFinite(nextRet)) continue;
    scored.push({ dist, nextRet });
  }

  if (scored.length < MIN_SIMILAR) return null;

  scored.sort((x, y) => x.dist - y.dist);
  const slice = scored.slice(0, Math.min(K_NEAREST, scored.length));
  if (slice.length < MIN_SIMILAR) return null;

  return slice.map((s) => s.nextRet);
}

export function calcSimpleProbUp(history) {
  const rets = collectSimilarNextReturns(history);
  if (!rets || rets.length < MIN_SIMILAR) return null;
  let up = 0;
  for (const r of rets) {
    if (r > 0) up++;
  }
  return up / rets.length;
}

export function calcSimpleExpect(history) {
  const rets = collectSimilarNextReturns(history);
  if (!rets || rets.length < MIN_SIMILAR) return null;
  let sum = 0;
  for (const r of rets) sum += r;
  return sum / rets.length;
}

export function calcSimpleWinrate(history) {
  const rets = collectSimilarNextReturns(history);
  if (!rets || rets.length < MIN_SIMILAR) return null;
  let wins = 0;
  for (const r of rets) {
    if (r > 0) wins++;
  }
  return wins / rets.length;
}

export function computeAIRankMetrics(stock) {
  if (metricsCache.has(stock)) return metricsCache.get(stock);

  const fields = getAIFields(stock);
  const history = stock?.history;

  let probUp = fields.probUp;
  if (probUp == null && history) probUp = calcSimpleProbUp(history);

  let expect = fields.expect;
  if (expect == null && history) expect = calcSimpleExpect(history);

  let winrate = fields.winrate;
  if (winrate == null && history) winrate = calcSimpleWinrate(history);

  if (probUp == null && expect == null && winrate == null) {
    metricsCache.set(stock, null);
    return null;
  }

  const out = { probUp, expect, winrate };
  metricsCache.set(stock, out);
  return out;
}
