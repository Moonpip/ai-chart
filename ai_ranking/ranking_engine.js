// ai_ranking/ranking_engine.js

import { computeAIRankMetrics } from "./ai_rank_calculator.js";
import { clamp01, normalizePercentLike, normalizeExpect } from "./ai_rank_normalizer.js";
import { computeCrashScore, computeSpikeScore } from "./ranking_signal_metrics.js";
import { computeConditionalWinrate } from "./ranking_ai_metrics.js";
import {
  computeNikkeiOutperformScore,
  computeRelativeStrengthScore
} from "./ranking_relative_metrics.js";

/** スコア 0 を有効とするランキング（getBoostScore 未加算・未計算は別途 null） */
const SCORE_ZERO_ALLOWED_TYPES = new Set([
  "ai_prob_up",
  "ai_expect",
  "ai_winrate",
  "crash",
  "spike",
  "nikkei_outperform",
  "relative_strength"
]);

const SCORE_CAP_SKIP_TYPES = new Set(["crash", "spike"]);

const RANK_CHECK_TYPES = new Set([
  "ai_winrate",
  "crash",
  "spike",
  "nikkei_outperform",
  "relative_strength"
]);

function getLatestDate(allData) {
  let latest = "";
  allData.forEach((s) => {
    const h = s.history;
    if (!h || h.length === 0) return;
    const d = h[h.length - 1].date;
    if (d > latest) latest = d;
  });
  return latest;
}

function isValidStock(stock, latestDate) {
  if (!stock || !stock.history || stock.history.length < 2) return false;

  const last = stock.history[stock.history.length - 1];

  // 最新日一致
  if (last.date !== latestDate) return false;

  // 出来高ゼロ除外
  if (!last.volume || last.volume === 0) return false;

  // 指数除外（^）
  if (stock.code && stock.code.startsWith("^")) return false;

  // 指数コード除外（重要）
  const INDEX_CODES = ["1001", "1002"];
  if (INDEX_CODES.includes(String(stock.code || stock.symbol))) return false;

  // 名前ベースで指数除外
  if (stock.name) {
    const name = stock.name.toLowerCase();
    if (
      name.includes("日経") ||
      name.includes("topix") ||
      name.includes("index") ||
      name.includes("指数")
    ) {
      return false;
    }
  }

  // ETF除外強化
  if (stock.name) {
    const name = stock.name.toLowerCase();
    if (
      name.includes("etf") ||
      name.includes("etn") ||
      name.includes("連動型") ||
      name.includes("インデックス")
    ) {
      return false;
    }
  }

  // 上場廃止っぽい（履歴少ない）
  if (stock.history.length < 50) return false;

  return true;
}

function getBoostScore(stock, last, prev) {
  const flow = last.volume / (prev.volume || 1);
  const relative = stock.relative?.nikkei || 0;
  let ai = 0;
  const wr = stock.AI?.winrate;
  const ex = stock.AI?.expect;
  if (wr != null && Number.isFinite(wr)) ai += wr / 100;
  if (ex != null && Number.isFinite(ex)) ai += ex;
  const vol = Math.abs(last.close - prev.close) / (prev.close || 1);

  return flow * 0.3 + relative * 0.3 + ai * 0.3 - vol * 0.2;
}

export function computeRanking(allData, type) {
  if (!allData) return [];

  const latestDate = getLatestDate(allData);

  return allData
    .filter((stock) => isValidStock(stock, latestDate))
    .map((stock) => {
      const h = stock.history;
      if (!h || h.length < 2) return null;

      const last = h[h.length - 1];
      const prev = h[h.length - 2];

      let score = 0;

      switch (type) {
        case "gain":
          score = (last.close - prev.close) / (prev.close || 1);
          score += getBoostScore(stock, last, prev);
          break;
        case "loss":
          score = (prev.close - last.close) / (prev.close || 1);
          score += getBoostScore(stock, last, prev);
          break;
        case "volume":
          score = last.volume || 0;
          score += getBoostScore(stock, last, prev);
          break;
        case "value":
          score = (last.close || 0) * (last.volume || 0);
          score += getBoostScore(stock, last, prev);
          break;
        case "volume_spike":
          score = (last.volume || 0) / (prev.volume || 1);
          score += getBoostScore(stock, last, prev);
          break;
        case "money_flow":
          score = (last.close - last.open || 0) * (last.volume || 0);
          score += getBoostScore(stock, last, prev);
          break;
        case "trend_up":
          score = last.close - (h[h.length - 20]?.close || last.close);
          score += getBoostScore(stock, last, prev);
          break;
        case "trend_down": {
          const base = h[h.length - 20]?.close || last.close;
          score = (last.close - base) / base;
          score += getBoostScore(stock, last, prev);
          break;
        }
        case "rsi":
          score =
            stock.indicators?.rsi ??
            stock.RSI ??
            stock.ai?.rsi ??
            null;
          if (score === null) return null;
          score += getBoostScore(stock, last, prev);
          break;
        case "macd":
          score =
            stock.indicators?.macd?.histogram ??
            stock.indicators?.macd ??
            stock.MACD ??
            null;
          if (score === null) return null;
          score += getBoostScore(stock, last, prev);
          break;
        case "divergence": {
          const ma = stock.indicators?.ma25 || stock.MA25;
          if (!ma || !last.close) return null;
          score = (last.close - ma) / ma;
          score += getBoostScore(stock, last, prev);
          break;
        }
        case "ai_prob_up": {
          const ai = computeAIRankMetrics(stock);
          console.log("AI_RANK", stock.code, ai);
          if (!ai || ai.probUp == null) return null;
          score = clamp01(normalizePercentLike(ai.probUp));
          break;
        }
        case "ai_expect": {
          const ai = computeAIRankMetrics(stock);
          console.log("AI_RANK", stock.code, ai);
          if (!ai || ai.expect == null) return null;
          score = normalizeExpect(ai.expect);
          break;
        }
        case "ai_winrate": {
          const v =
            stock.AI?.winrate ??
            stock.AI?.winRate ??
            stock.ai?.winrate ??
            null;

          if (v != null && Number.isFinite(Number(v))) {
            const nv = Number(v);
            score = nv > 1 ? nv / 100 : nv;
          } else {
            score = computeConditionalWinrate(h);
          }

          if (score == null || Number.isNaN(score)) return null;
          break;
        }
        case "crash": {
          score = computeCrashScore(h);
          if (score == null || Number.isNaN(score)) return null;
          break;
        }
        case "spike": {
          score = computeSpikeScore(h);
          if (score == null || Number.isNaN(score)) return null;
          break;
        }
        case "nikkei_outperform": {
          const nikkei = allData.find((x) => String(x.code) === "1001")?.history || [];
          score = computeNikkeiOutperformScore(h, nikkei, 60);
          if (score == null || Number.isNaN(score)) return null;
          break;
        }
        case "relative_strength": {
          const nikkei = allData.find((x) => String(x.code) === "1001")?.history || [];
          score = computeRelativeStrengthScore(h, nikkei);
          if (score == null || Number.isNaN(score)) return null;
          break;
        }
        default:
          break;
      }

      if (RANK_CHECK_TYPES.has(type)) {
        console.log("RANK_CHECK", type, stock.code, score);
      }

      console.log("RANKING_ENGINE_ITEM", {
        code: stock.code,
        name: stock.name,
        companyName: stock.companyName,
        metaName: stock.meta?.name,
        sector: stock.sector,
        industry: stock.industry
      });

      return {
        code: stock.code || stock.symbol || "-",
        name: stock.name ?? stock.companyName ?? stock.meta?.name ?? "",
        sector: stock.sector ?? stock.industry ?? stock.meta?.sector ?? "",
        score
      };
    })
    .filter((x) => {
      if (!x || x.score == null || Number.isNaN(x.score)) return false;
      if (SCORE_ZERO_ALLOWED_TYPES.has(type)) return true;
      return x.score !== 0;
    })
    .map((x) => {
      if (!SCORE_CAP_SKIP_TYPES.has(type) && Math.abs(x.score) > 1000) x.score = 0;
      return x;
    })
    .filter((x) => {
      if (SCORE_ZERO_ALLOWED_TYPES.has(type)) {
        return x != null && x.score != null && !Number.isNaN(x.score);
      }
      return x.score !== 0;
    })
    .sort((a, b) => {
      if (type === "loss" || type === "trend_down") {
        return a.score - b.score;
      }
      return b.score - a.score;
    })
    .slice(0, 20);
}
