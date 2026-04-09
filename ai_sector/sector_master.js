// ai_sector/sector_master.js — 銘柄コード→業種、および表示ラベルの33業種正規化

import { getSector } from "./sector_engine.js";

/** 銘柄コード（4桁等）→ 33業種名（データ欠損時の上書き用） */
export const SECTOR_MASTER = {
  "1301": "水産・農林業",
  "1332": "水産・農林業",
  "1333": "水産・農林業",
  "1375": "水産・農林業",
  "1382": "水産・農林業",
  "1605": "鉱業",
  "1514": "鉱業"
};

/** 東証 33 業種の正式名称（2022 業種分類ベース） */
export const SECTOR_33_LABELS = [
  "水産・農林業",
  "鉱業",
  "建設業",
  "食料品",
  "繊維製品",
  "パルプ・紙",
  "化学",
  "医薬品",
  "石油・石炭製品",
  "ゴム製品",
  "ガラス・土石製品",
  "鉄鋼",
  "非鉄金属",
  "金属製品",
  "機械",
  "電気機器",
  "輸送用機器",
  "精密機器",
  "その他製品",
  "電気・ガス業",
  "陸運業",
  "海運業",
  "空運業",
  "倉庫・運輸関連業",
  "情報・通信業",
  "卸売業",
  "小売業",
  "銀行業",
  "証券、商品先物取引業",
  "保険業",
  "その他金融業",
  "不動産業",
  "サービス業"
];

const SECTOR_33_SET = new Set(SECTOR_33_LABELS);

/** JPX 業種コード（4桁等）→ 33業種名（industry 欠損時） */
export const INDUSTRY_CODE_TO_SECTOR = {
  "0050": "水産・農林業",
  "50": "水産・農林業",
  "1050": "鉱業",
  "2050": "建設業",
  "3050": "食料品",
  "3100": "繊維製品",
  "3150": "パルプ・紙",
  "3200": "化学",
  "3250": "医薬品",
  "3300": "石油・石炭製品",
  "3350": "ゴム製品",
  "3400": "ガラス・土石製品",
  "3450": "鉄鋼",
  "3500": "非鉄金属",
  "3550": "金属製品",
  "3600": "機械",
  "3650": "電気機器",
  "3700": "輸送用機器",
  "3750": "精密機器",
  "3800": "その他製品",
  "4050": "電気・ガス業",
  "5050": "陸運業",
  "5100": "海運業",
  "5150": "空運業",
  "5200": "倉庫・運輸関連業",
  "5250": "情報・通信業",
  "6050": "卸売業",
  "6100": "小売業",
  "7050": "銀行業",
  "7100": "証券、商品先物取引業",
  "7150": "保険業",
  "7200": "その他金融業",
  "8050": "不動産業",
  "9050": "サービス業"
};

/** JSON 等で出る表記ゆれ → 正式33業種名 */
const INDUSTRY_ALIASES = {
  水産・農林: "水産・農林業",
  農林: "水産・農林業",
  鉱: "鉱業",
  建設: "建設業",
  食料: "食料品",
  繊維: "繊維製品",
  パルプ: "パルプ・紙",
  紙: "パルプ・紙",
  化学: "化学",
  医薬: "医薬品",
  石油: "石油・石炭製品",
  石炭: "石油・石炭製品",
  ゴム: "ゴム製品",
  ガラス: "ガラス・土石製品",
  土石: "ガラス・土石製品",
  鉄鋼: "鉄鋼",
  非鉄: "非鉄金属",
  金属製品: "金属製品",
  機械: "機械",
  電気機器: "電気機器",
  輸送用機器: "輸送用機器",
  自動車: "輸送用機器",
  精密: "精密機器",
  その他製品: "その他製品",
  電気・ガス: "電気・ガス業",
  電力: "電気・ガス業",
  ガス: "電気・ガス業",
  陸運: "陸運業",
  海運: "海運業",
  空運: "空運業",
  倉庫: "倉庫・運輸関連業",
  運輸: "倉庫・運輸関連業",
  情報・通信: "情報・通信業",
  情報通信: "情報・通信業",
  通信: "情報・通信業",
  卸売: "卸売業",
  小売: "小売業",
  銀行: "銀行業",
  証券: "証券、商品先物取引業",
  商品先物: "証券、商品先物取引業",
  保険: "保険業",
  その他金融: "その他金融業",
  金融: "その他金融業",
  不動産: "不動産業",
  サービス: "サービス業",
  証券・商品先物取引業: "証券、商品先物取引業",
  倉庫・運輸関連: "倉庫・運輸関連業"
};

/**
 * 任意ラベルを33業種名に寄せる。合致しなければ null。
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function normalizeToSector33(raw) {
  if (raw == null) return null;
  let t = String(raw).trim();
  if (!t || t === "-" || t === "—" || t === "不明") return null;
  t = t.replace(/\u3000/g, " ").replace(/\s+/g, "").replace(/（株）$/, "");
  if (SECTOR_33_SET.has(t)) return t;
  if (INDUSTRY_ALIASES[t]) return INDUSTRY_ALIASES[t];
  const zenComma = t.replace(/・/g, "、");
  if (SECTOR_33_SET.has(zenComma)) return zenComma;
  const midDot = t.replace(/、/g, "・");
  if (SECTOR_33_SET.has(midDot)) return midDot;
  return null;
}

/**
 * ランキング・パネル用：33業種名のみ返す（解決不可は null）
 * @param {{ code?: string, symbol?: string, sector?: string, industry?: string, meta?: object }} stock
 */
export function resolveStockSector(stock) {
  if (!stock) return null;
  const fromJson = getSector(stock);
  if (fromJson) return fromJson;
  const code = String(stock.code ?? stock.symbol ?? "").trim();
  if (SECTOR_MASTER[code]) return SECTOR_MASTER[code];
  const icRaw = stock.industry_code;
  if (icRaw != null && icRaw !== "") {
    const ic = String(icRaw).trim();
    if (INDUSTRY_CODE_TO_SECTOR[ic]) return INDUSTRY_CODE_TO_SECTOR[ic];
    const icPad = ic.padStart(4, "0");
    if (INDUSTRY_CODE_TO_SECTOR[icPad]) return INDUSTRY_CODE_TO_SECTOR[icPad];
  }
  const rawFields = [
    stock.sector,
    stock.industry,
    stock.meta?.sector,
    stock.meta?.industry,
    stock.profile?.sector,
    stock.profile?.industry
  ];
  for (const raw of rawFields) {
    const n = normalizeToSector33(raw);
    if (n) return n;
  }
  return null;
}
