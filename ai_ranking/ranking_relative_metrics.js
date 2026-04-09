// ai_ranking/ranking_relative_metrics.js — 日経アウトパフォーム・相対強度（日付一致）

import { alignByDate } from "./ranking_align.js";

function pct(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return (a - b) / b;
}

export function computeNikkeiOutperformScore(stockHistory, nikkeiHistory, lookback = 60) {
  const aligned = alignByDate(stockHistory, nikkeiHistory);
  if (aligned.length < lookback + 1) return null;

  const rows = aligned.slice(-(lookback + 1));
  let win = 0;
  let total = 0;

  for (let i = 1; i < rows.length; i++) {
    const sr = pct(rows[i].stockClose, rows[i - 1].stockClose);
    const nr = pct(rows[i].indexClose, rows[i - 1].indexClose);
    if (sr == null || nr == null) continue;
    if (sr > nr) win++;
    total++;
  }

  if (!total) return null;
  return win / total;
}

export function computeRelativeStrengthScore(stockHistory, nikkeiHistory) {
  const aligned = alignByDate(stockHistory, nikkeiHistory);
  if (aligned.length < 61) return null;

  const last = aligned[aligned.length - 1];
  const p20 = aligned[aligned.length - 21];
  const p60 = aligned[aligned.length - 61];

  const stock20 = pct(last.stockClose, p20.stockClose);
  const idx20 = pct(last.indexClose, p20.indexClose);
  const stock60 = pct(last.stockClose, p60.stockClose);
  const idx60 = pct(last.indexClose, p60.indexClose);

  if ([stock20, idx20, stock60, idx60].some((v) => v == null)) return null;

  return (stock20 - idx20) * 0.4 + (stock60 - idx60) * 0.6;
}
