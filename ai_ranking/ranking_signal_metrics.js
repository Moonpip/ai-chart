// ai_ranking/ranking_signal_metrics.js — 暴落・急騰スコア（履歴直接計算）

function pct(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return (a - b) / b;
}

function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stdev(arr) {
  if (arr.length < 2) return null;
  const m = avg(arr);
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}

function closeNum(row) {
  if (!row) return NaN;
  return Number(row.close ?? row.c);
}

export function computeCrashScore(history) {
  if (!Array.isArray(history) || history.length < 30) return null;

  const last = history[history.length - 1];
  const prev = history[history.length - 2];

  const r1 = pct(closeNum(last), closeNum(prev));
  const r3 = pct(closeNum(last), closeNum(history[history.length - 4]));
  const r5 = pct(closeNum(last), closeNum(history[history.length - 6]));

  if (r1 == null || r3 == null || r5 == null) return null;

  const vols = history
    .slice(-20)
    .map((x) => closeNum(x))
    .filter(Number.isFinite);
  if (vols.length < 2) return null;

  const returns = [];
  for (let i = 1; i < vols.length; i++) {
    returns.push((vols[i] - vols[i - 1]) / vols[i - 1]);
  }
  const sig = stdev(returns);
  const sigma = sig != null && sig > 0 ? sig : 0.0001;

  const drop = Math.min(r1, r3, r5);
  const severity = Math.abs(Math.min(0, drop)) / sigma;
  return Number.isFinite(severity) ? severity : null;
}

export function computeSpikeScore(history) {
  if (!Array.isArray(history) || history.length < 30) return null;

  const last = history[history.length - 1];
  const prev = history[history.length - 2];

  const r1 = pct(closeNum(last), closeNum(prev));
  const r3 = pct(closeNum(last), closeNum(history[history.length - 4]));
  const r5 = pct(closeNum(last), closeNum(history[history.length - 6]));

  if (r1 == null || r3 == null || r5 == null) return null;

  const closes = history
    .slice(-20)
    .map((x) => closeNum(x))
    .filter(Number.isFinite);
  if (closes.length < 2) return null;

  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const sig = stdev(returns);
  const sigma = sig != null && sig > 0 ? sig : 0.0001;

  const rise = Math.max(r1, r3, r5);
  const severity = Math.max(0, rise) / sigma;
  return Number.isFinite(severity) ? severity : null;
}
