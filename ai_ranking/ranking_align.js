// ai_ranking/ranking_align.js — 日付一致で株と指数を突き合わせる

export function alignByDate(stockHistory, indexHistory) {
  if (!Array.isArray(stockHistory) || !Array.isArray(indexHistory)) return [];
  const map = new Map();
  for (const row of indexHistory) {
    const d = String(row?.date ?? "");
    const c = Number(row?.close ?? row?.c);
    if (!d || !Number.isFinite(c)) continue;
    map.set(d, c);
  }

  const out = [];
  for (const row of stockHistory) {
    const d = String(row?.date ?? "");
    const sc = Number(row?.close ?? row?.c);
    const ic = map.get(d);
    if (!d || !Number.isFinite(sc) || !Number.isFinite(ic)) continue;
    out.push({ date: d, stockClose: sc, indexClose: ic, stockRow: row });
  }
  return out;
}
