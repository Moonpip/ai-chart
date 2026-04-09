// ai/ai_sector_engine.js — セクター分析強化エンジン（売れるレベル）

import { computeSectorStats } from "../ai_sector/sector_engine.js";

const ALL_SECTORS = [
  "水産・農林業", "鉱業", "建設業", "食料品", "繊維製品",
  "パルプ・紙", "化学", "医薬品", "石油・石炭製品", "ゴム製品",
  "ガラス・土石製品", "鉄鋼", "非鉄金属", "金属製品", "機械",
  "電気機器", "輸送用機器", "精密機器", "その他製品", "電気・ガス業",
  "陸運業", "海運業", "空運業", "倉庫・運輸関連業", "情報・通信業",
  "卸売業", "小売業", "銀行業", "証券、商品先物取引業", "保険業",
  "その他金融業", "不動産業", "サービス業"
];

/**
 * computeSectorStats の出力を analyzeSectors 入力形式に変換・補完
 * @param {Array<{ sector: string, change: number, trend: number, volume: number, count: number }>} stats
 */
function prepareSectorsForAnalysis(stats) {
  if (!stats || stats.length === 0) return [];
  const valid = stats.filter((s) => s.count > 0); // 平均・分散計算用（表示は全セクター）
  const changes = valid.map((s) => s.change);
  const meanChange =
    changes.reduce((a, b) => a + b, 0) / (changes.length || 1);
  const variance =
    changes.reduce((a, c) => a + (c - meanChange) ** 2, 0) /
    (changes.length || 1);
  const stdChange = Math.sqrt(variance) || 0.0001;

  const volumes = valid.map((s) => s.volume || 0).filter((v) => v > 0);
  const meanVolume =
    volumes.length > 0
      ? volumes.reduce((a, b) => a + b, 0) / volumes.length
      : 1;

  return (stats || []).map((s) => {
    const rawChange = s.change ?? 0;
    const change = rawChange * 100;
    const trend = s.trend ?? 0;
    const vol = s.volume ?? 0;
    const z = stdChange > 0 ? (rawChange - meanChange) / stdChange : 0;
    const winRate20 = Math.max(0, Math.min(1, 0.5 + trend * 2));
    const volumeAvg20 = Math.max(1, meanVolume);

    return {
      name: s.sector,
      sector: s.sector,
      change,
      trend,
      volume: vol,
      volumeAvg20,
      winRate20,
      zScore: z
    };
  });
}

/**
 * セクター分析（完全版）
 * @param {Array<{ name?: string, sector?: string, change: number, winRate20?: number, volume?: number, volumeAvg20?: number, zScore?: number }>} sectors
 */
export function analyzeSectors(sectors) {
  const sectorMap = {};
  (sectors || []).forEach((s) => {
    const key = s.name ?? s.sector;
    if (key) sectorMap[key] = s;
  });

  const normalized = ALL_SECTORS.map((name) => {
    const s = sectorMap[name] || {};
    return {
      name,
      sector: name,
      change: s.change ?? 0,
      winRate20: s.winRate20 ?? 0,
      volume: s.volume ?? 0,
      volumeAvg20: s.volumeAvg20 ?? 1,
      zScore: s.zScore ?? 0
    };
  });

  console.log("全セクター", normalized);
  console.log("セクター一覧", normalized.map((s) => s.name));

  // 上昇ランキング
  const gainers = [...normalized]
    .sort((a, b) => (b.change || 0) - (a.change || 0))
    .slice(0, 6);

  // 下降ランキング（マイナスのみ）
  const losers = normalized
    .filter((s) => (s.change || 0) < 0)
    .sort((a, b) => (a.change || 0) - (b.change || 0))
    .slice(0, 6);

  // トレンドスコア
  const scored = normalized.map((s) => {
    const winRate = s.winRate20 ?? 0;
    const change = s.change ?? 0;
    const score = (winRate * 0.7) + (change * 0.3);

    return { ...s, score };
  });

  const trendStrong = [...scored]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 6);

  const trendWeak = [...scored]
    .sort((a, b) => (a.score || 0) - (b.score || 0))
    .slice(0, 6);

  // 資金流入（出来高）
  const flow = normalized.map((s) => {
    const ratio = (s.volume ?? 0) / ((s.volumeAvg20 ?? 1) || 1);
    return { ...s, volumeRatio: ratio };
  });

  const inflow = flow
    .filter((s) => (s.volumeRatio ?? 0) > 1.5)
    .sort((a, b) => (b.volumeRatio || 0) - (a.volumeRatio || 0))
    .slice(0, 3);

  // 逆張りゾーン（Zスコア）
  const reversal = normalized
    .map((s) => {
      const z = s.zScore ?? 0;
      let type = null;
      if (z > 2) type = "overbought";
      if (z < -2) type = "oversold";
      return { ...s, reversalType: type };
    })
    .filter((s) => s.reversalType !== null);

  const top = gainers[0] ?? null;

  return {
    gainers,
    losers,
    trendStrong,
    trendWeak,
    inflow,
    reversal,
    top,
    sectors: normalized
  };
}

/**
 * allData から一括で分析（推奨エントリポイント）
 * @param {Array} allData - 銘柄データ配列
 */
export function analyzeSectorsFromStockData(allData) {
  const stats = computeSectorStats(allData);
  const sectors = prepareSectorsForAnalysis(stats);
  return analyzeSectors(sectors);
}

/**
 * computeSectorStats の出力から分析（既存 stats を再利用する場合）
 * @param {Array} stats - sector_engine.computeSectorStats の戻り値
 */
export function analyzeSectorsFromStats(stats) {
  const sectors = prepareSectorsForAnalysis(stats || []);
  return analyzeSectors(sectors);
}
