// ai_sector/sector_engine.js — セクター別集計（final_json の業種を優先）

// final_json の industry 表記に合わせた33キー（「証券」「倉庫」は東証表記どおり）
const SECTOR_33 = [
  "水産・農林業", "鉱業", "建設業", "食料品", "繊維製品",
  "パルプ・紙", "化学", "医薬品", "石油・石炭製品", "ゴム製品",
  "ガラス・土石製品", "鉄鋼", "非鉄金属", "金属製品", "機械",
  "電気機器", "輸送用機器", "精密機器", "その他製品", "電気・ガス業",
  "陸運業", "海運業", "空運業", "倉庫・運輸関連業", "情報・通信業",
  "卸売業", "小売業", "銀行業", "証券、商品先物取引業", "保険業",
  "その他金融業", "不動産業", "サービス業"
];

/** 必要最低限の正規化（final_json の表記を基本そのまま使う） */
export function normalizeSectorName(name) {
  if (name == null || name === "") return null;
  const n = String(name).trim();
  if (!n) return null;

  if (n.endsWith("業")) {
    return n;
  }

  if (n === "情報通信") return "情報・通信業";
  if (n === "銀行") return "銀行業";
  // 略称のみ。final_json 正式名「証券、商品先物取引業」は上の endsWith("業") でそのまま通る
  if (n === "証券") return "証券、商品先物取引業";

  return n;
}

// 既存呼び出し互換
export const normalizeSector = normalizeSectorName;

/** final_json / 銘柄オブジェクトから業種文字列を取得（industry 最優先） */
export function getSector(stock) {
  const raw =
    stock.industry ||
    stock.meta?.industry ||
    stock.sector ||
    stock.profile?.sector ||
    stock.profile?.industry ||
    null;
  return normalizeSectorName(raw);
}

function pct(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb) || nb === 0) return null;
  return (na - nb) / nb;
}

/**
 * @returns {Array<{ sector: string, change: number, trend: number, volume: number, weakness: number }>}
 */
export function computeSectorStats(allData) {
  const map = {};
  SECTOR_33.forEach((sec) => {
    map[sec] = {
      change: 0,
      trend: 0,
      volume: 0,
      count: 0
    };
  });

  (allData || []).forEach((stock) => {
    const h = stock.history;
    if (!h || h.length < 25) return;

    const last = h[h.length - 1];
    const prev = h[h.length - 2];
    const prev20 = h[h.length - 20];

    const raw =
      stock.industry ||
      stock.meta?.industry ||
      stock.sector ||
      stock.profile?.sector ||
      stock.profile?.industry ||
      null;
    console.log("SECTOR_OK", stock.code, raw);

    const key = normalizeSectorName(raw);
    const sector = getSector(stock);

    console.log("SECTOR_CHECK", {
      code: stock.code,
      meta: stock.meta,
      profile: stock.profile,
      sector
    });
    console.log("SECTOR_MATCH", {
      code: stock.code,
      raw: stock.meta?.industry,
      normalized: key
    });
    if (!key || !map[key]) return;

    const lc = last.close ?? last.c;
    const pc = prev.close ?? prev.c;
    const p20c = prev20?.close ?? prev20?.c;

    const change = pct(lc, pc);
    const trend = pct(lc, p20c);
    if (change == null || trend == null) return;

    const vol = Number(last.volume ?? last.v);
    const volume = Number.isFinite(vol) && vol >= 0 ? vol : 0;

    map[key].change += change;
    map[key].trend += trend;
    map[key].volume += volume;
    map[key].count += 1;
  });

  return SECTOR_33.map((sec) => {
    const s = map[sec];
    const change = s.count ? s.change / s.count : 0;
    const trend = s.count ? s.trend / s.count : 0;
    const volume = s.count ? s.volume / s.count : 0;
    return {
      sector: sec,
      change,
      trend,
      volume,
      count: s.count,
      weakness: change * 0.5 + trend * 0.5
    };
  }).sort((a, b) => (b.change || 0) - (a.change || 0));
}
