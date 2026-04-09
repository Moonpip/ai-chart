// ai_ranking/ranking_ai_metrics.js — 類似局面ベースの条件付き勝率

function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function makeState(history, i) {
  const c0 = Number(history[i]?.close ?? history[i]?.c);
  const c5 = Number(history[i - 5]?.close ?? history[i - 5]?.c);
  const c20 = Number(history[i - 20]?.close ?? history[i - 20]?.c);
  if (
    !Number.isFinite(c0) ||
    !Number.isFinite(c5) ||
    !Number.isFinite(c20) ||
    c5 === 0 ||
    c20 === 0
  ) {
    return null;
  }

  const volNow = Number(history[i]?.volume ?? history[i]?.v);
  if (!Number.isFinite(volNow) || volNow < 0) return null;

  const vols = history.slice(i - 4, i + 1).map((x) => Number(x?.volume ?? x?.v));
  if (vols.some((v) => !Number.isFinite(v) || v < 0)) return null;
  const volAvg5 = avg(vols);
  if (volAvg5 == null || volAvg5 === 0) return null;

  return {
    r5: (c0 - c5) / c5,
    r20: (c0 - c20) / c20,
    volRatio: volNow / volAvg5
  };
}

function dist(a, b) {
  return Math.sqrt(
    (a.r5 - b.r5) ** 2 + (a.r20 - b.r20) ** 2 + (a.volRatio - b.volRatio) ** 2
  );
}

export function computeConditionalWinrate(history) {
  if (!Array.isArray(history) || history.length < 80) return null;

  const curIdx = history.length - 2;
  const cur = makeState(history, curIdx);
  if (!cur) return null;

  const rows = [];
  for (let i = 20; i < history.length - 1; i++) {
    const st = makeState(history, i);
    if (!st) continue;

    const nextClose = Number(history[i + 1]?.close ?? history[i + 1]?.c);
    const nowClose = Number(history[i]?.close ?? history[i]?.c);
    if (!Number.isFinite(nextClose) || !Number.isFinite(nowClose) || nowClose === 0) continue;

    rows.push({
      d: dist(cur, st),
      ret: (nextClose - nowClose) / nowClose
    });
  }

  rows.sort((a, b) => a.d - b.d);
  const top = rows.slice(0, 30);
  if (!top.length) return null;

  const wins = top.filter((x) => x.ret > 0).length;
  return wins / top.length;
}
