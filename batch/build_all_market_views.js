// batch/build_all_market_views.js — finalJSON更新後に表示用データを一括生成

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "final_json");
const OUTPUT_DIR = path.join(ROOT, "public", "generated");
const PERIOD = 20;

const NIKKEI_BENCHMARK_CODES = ["1001", "NIKKEI", "^N225", "998407", "NI225", "NKY"];

// industry が null の銘柄を名前・コードから補完
var INDUSTRY_FALLBACK_BY_SYMBOL = {
  "8332": "銀行業",
  "8355": "銀行業",
  "9613": "情報・通信業",
  "9681": "サービス業",
};

function complementIndustry(json) {
  var raw =
    json?.industry ||
    json?.meta?.industry ||
    json?.sector ||
    json?.meta?.sector;
  if (raw && String(raw).trim()) return String(raw).trim();

  var symbol = getSymbol(json);
  if (INDUSTRY_FALLBACK_BY_SYMBOL[symbol]) {
    return INDUSTRY_FALLBACK_BY_SYMBOL[symbol];
  }

  var name = String(json?.name || json?.meta?.name || "").toUpperCase();
  if (/銀行|フィナンシャル|リース|クレジット/.test(name)) return "銀行業";
  if (/証券|投信|アセット/.test(name)) return "証券、商品先物取引業";
  if (/保険/.test(name)) return "保険業";
  if (/データ|ＮＴＴ|NTT|情報|通信|ネットワーク|ソフトウェア|電通/.test(name)) return "情報・通信業";
  if (/不動産|リアルティ|建物/.test(name)) return "不動産業";
  if (/鉄道|運輸|海運|空運|倉庫/.test(name)) return "陸運業";
  if (/電力|ガス|エネルギ/.test(name)) return "電気・ガス業";
  if (/自動車|輸送機器|車両/.test(name)) return "輸送用機器";
  if (/製薬|医薬|ファルマ/.test(name)) return "医薬品";
  if (/ドーム|スタジアム|球団|娯楽/.test(name)) return "サービス業";
  if (/小売|百貨店|コンビニ|ショッピング/.test(name)) return "小売業";
  if (/卸売|商社/.test(name)) return "卸売業";

  return "不明";
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function safeNum(v, d) {
  if (d === undefined) d = 0;
  return Number.isFinite(Number(v)) ? Number(v) : d;
}

function isNikkei225(json) {
  const idx = json?.indexes || json?.meta?.indexes || {};
  return idx.NIKKEI225 === true;
}

function getSymbol(json) {
  return String(
    json?.symbol ||
    json?.code ||
    json?.meta?.symbol ||
    json?.meta?.code ||
    ""
  );
}

function getName(json) {
  return String(
    json?.name ||
    json?.meta?.name ||
    getSymbol(json) ||
    "不明"
  );
}

function getHistory(json) {
  if (Array.isArray(json?.history)) return json.history;
  if (Array.isArray(json?.price_history)) return json.price_history;
  return [];
}

function getClose(bar) {
  return bar?.close ?? bar?.c;
}

function calcReturn(history, period) {
  period = period || PERIOD;
  if (!Array.isArray(history) || history.length < period) return 0;
  const startBar = history[history.length - period];
  const endBar = history[history.length - 1];
  const start = safeNum(getClose(startBar), 0);
  const end = safeNum(getClose(endBar), 0);
  if (!start || !end) return 0;
  return ((end - start) / start) * 100;
}

function calcVolumeRatio(history, period) {
  period = period || PERIOD;
  if (!Array.isArray(history) || history.length < period + 1) return 1;
  const last = safeNum(history[history.length - 1]?.volume, 0);
  const slice = history.slice(-period);
  const avg =
    slice.reduce((sum, bar) => sum + safeNum(bar?.volume, 0), 0) / slice.length;
  if (!avg) return 1;
  return last / avg;
}

function calcMoneyFlowScore(history, period) {
  period = period || PERIOD;
  if (!Array.isArray(history) || history.length < period) return 0;
  const ret = calcReturn(history, period);
  const volRatio = calcVolumeRatio(history, period);
  return ret + (volRatio - 1) * 10;
}

function toHeatRank(score) {
  if (score >= 15) return "very_hot";
  if (score >= 10) return "hot";
  if (score >= 5) return "warm";
  if (score >= 0) return "neutral";
  if (score >= -5) return "cool";
  return "cold";
}

function toHeatColor(rank) {
  switch (rank) {
    case "very_hot": return "🟥";
    case "hot": return "🟧";
    case "warm": return "🟨";
    case "neutral": return "⬜";
    case "cool": return "🟩";
    case "cold": return "🟦";
    default: return "⬜";
  }
}

function readAllFinalJson() {
  if (!fs.existsSync(DATA_DIR)) {
    console.warn("DATA_DIR が存在しません:", DATA_DIR);
    return [];
  }
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.toLowerCase().endsWith(".json"));

  const items = [];
  const total = files.length;
  let done = 0;

  for (const file of files) {
    try {
      const fullPath = path.join(DATA_DIR, file);
      const json = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      const symbol = getSymbol(json);
      const name = getName(json);
      const industry = complementIndustry(json);
      const history = getHistory(json);

      if (!symbol || !history.length) continue;

      items.push({
        file,
        symbol,
        name,
        industry,
        indexes: json.indexes || json.meta?.indexes || {},
        history,
        raw: json,
      });
    } catch (err) {
      if (done % 5000 === 0 && done > 0) {
        console.log("  読込進捗:", done, "/", total);
      }
    }
    done++;
  }

  return items;
}

function findBenchmark(allStocks) {
  for (const code of NIKKEI_BENCHMARK_CODES) {
    const found = allStocks.find((s) => s.symbol === code);
    if (found && found.history && found.history.length >= PERIOD) {
      return {
        ...found,
        pseudoReturn: calcReturn(found.history),
      };
    }
  }

  const nikkei225 = allStocks.filter((s) => isNikkei225(s.raw));
  if (!nikkei225.length) return null;

  const pseudoReturn =
    nikkei225.reduce((sum, s) => sum + calcReturn(s.history), 0) /
    nikkei225.length;

  return {
    symbol: "NIKKEI225_AVG",
    name: "日経225平均",
    industry: "指数",
    history: [],
    pseudoReturn,
  };
}

function buildNikkei225StrengthRanking(allStocks, benchmarkReturn) {
  return allStocks
    .filter((s) => isNikkei225(s.raw))
    .map((s) => {
      const ret = calcReturn(s.history);
      const relative = ret - benchmarkReturn;
      const moneyFlowScore = calcMoneyFlowScore(s.history);
      return {
        code: s.symbol,
        name: s.name,
        industry: s.industry,
        return: Number(ret.toFixed(2)),
        relative_strength: Number(relative.toFixed(2)),
        volume_ratio: Number(calcVolumeRatio(s.history).toFixed(2)),
        money_flow_score: Number(moneyFlowScore.toFixed(2)),
      };
    })
    .sort((a, b) => {
      if (b.relative_strength !== a.relative_strength) {
        return b.relative_strength - a.relative_strength;
      }
      return b.return - a.return;
    });
}

function buildSectorBuckets(allStocks, benchmarkReturn) {
  const nikkei225 = allStocks.filter((s) => isNikkei225(s.raw));
  const map = new Map();

  for (const s of nikkei225) {
    const sector = s.industry || "不明";
    if (!map.has(sector)) map.set(sector, []);
    map.get(sector).push(s);
  }

  const sectors = [];

  for (const [sector, stocks] of map.entries()) {
    const stockRows = stocks
      .map((s) => {
        const ret = calcReturn(s.history);
        const relative = ret - benchmarkReturn;
        const moneyFlowScore = calcMoneyFlowScore(s.history);
        return {
          code: s.symbol,
          name: s.name,
          industry: s.industry,
          return: Number(ret.toFixed(2)),
          relative_strength: Number(relative.toFixed(2)),
          volume_ratio: Number(calcVolumeRatio(s.history).toFixed(2)),
          money_flow_score: Number(moneyFlowScore.toFixed(2)),
        };
      })
      .sort((a, b) => {
        if (b.relative_strength !== a.relative_strength) {
          return b.relative_strength - a.relative_strength;
        }
        return b.return - a.return;
      });

    const avgReturn =
      stockRows.reduce((sum, row) => sum + row.return, 0) / stockRows.length;
    const avgRelative =
      stockRows.reduce((sum, row) => sum + row.relative_strength, 0) /
      stockRows.length;
    const avgMoneyFlow =
      stockRows.reduce((sum, row) => sum + row.money_flow_score, 0) /
      stockRows.length;

    const rank = toHeatRank(avgReturn);
    const color = toHeatColor(rank);

    sectors.push({
      sector,
      score: Number(avgReturn.toFixed(2)),
      vs_nikkei: Number(avgRelative.toFixed(2)),
      money_flow_score: Number(avgMoneyFlow.toFixed(2)),
      rank,
      color,
      count: stockRows.length,
      stocks: stockRows,
    });
  }

  sectors.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.vs_nikkei - a.vs_nikkei;
  });

  return sectors;
}

function buildMarketState(sectors, ranking) {
  const topSector = sectors[0] || null;
  const avgSector =
    sectors.length > 0
      ? sectors.reduce((sum, s) => sum + s.score, 0) / sectors.length
      : 0;

  const risingCount = ranking.filter((r) => r.relative_strength > 0).length;
  const total = ranking.length || 1;
  const ratio = risingCount / total;

  let marketState = "中立";
  if (avgSector >= 8 && ratio >= 0.6) marketState = "強気";
  else if (avgSector >= 3 && ratio >= 0.52) marketState = "やや強気";
  else if (avgSector <= -8 && ratio <= 0.4) marketState = "弱気";
  else if (avgSector <= -3 && ratio <= 0.48) marketState = "やや弱気";

  return {
    market_state: marketState,
    capital_focus_sector: topSector?.sector || "不明",
    capital_focus_score: Number((topSector?.score || 0).toFixed(2)),
    avg_sector_score: Number(avgSector.toFixed(2)),
    rising_ratio: Number((ratio * 100).toFixed(1)),
  };
}

function writeJson(fileName, data) {
  const fullPath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), "utf-8");
  console.log("出力:", fullPath);
}

function main() {
  console.log("finalJSON 読み込み開始...");
  console.log("DATA_DIR:", DATA_DIR);

  ensureDir(OUTPUT_DIR);

  const allStocks = readAllFinalJson();
  console.log("読込銘柄数:", allStocks.length);

  const benchmark = findBenchmark(allStocks);
  const benchmarkReturn =
    benchmark?.pseudoReturn ?? calcReturn(benchmark?.history || []);

  console.log("ベンチマーク:", benchmark?.symbol || "NIKKEI225_AVG", benchmarkReturn?.toFixed(2) + "%");

  const nikkeiRanking = buildNikkei225StrengthRanking(allStocks, benchmarkReturn);
  const sectors = buildSectorBuckets(allStocks, benchmarkReturn);
  const marketState = buildMarketState(sectors, nikkeiRanking);

  const timestamp = new Date().toISOString();

  const marketOverview = {
    update: timestamp,
    period: PERIOD,
    benchmark: {
      code: benchmark?.symbol || "NIKKEI225_AVG",
      name: benchmark?.name || "日経225平均",
      return: Number(benchmarkReturn.toFixed(2)),
    },
    summary: marketState,
    top_sectors: sectors.slice(0, 10).map((s) => ({
      sector: s.sector,
      score: s.score,
      vs_nikkei: s.vs_nikkei,
      color: s.color,
      rank: s.rank,
      count: s.count,
    })),
    top_stocks: nikkeiRanking.slice(0, 20),
  };

  const sectorHeatmap = {
    update: timestamp,
    period: PERIOD,
    sectors: sectors.map((s) => ({
      sector: s.sector,
      score: s.score,
      vs_nikkei: s.vs_nikkei,
      money_flow_score: s.money_flow_score,
      color: s.color,
      rank: s.rank,
      count: s.count,
    })),
  };

  const sectorDetails = {
    update: timestamp,
    period: PERIOD,
    sectors: sectors.map((s) => ({
      sector: s.sector,
      score: s.score,
      vs_nikkei: s.vs_nikkei,
      money_flow_score: s.money_flow_score,
      color: s.color,
      rank: s.rank,
      count: s.count,
      stocks: s.stocks,
    })),
  };

  const nikkeiStrength = {
    update: timestamp,
    period: PERIOD,
    benchmark_return: Number(benchmarkReturn.toFixed(2)),
    ranking: nikkeiRanking,
  };

  const metadata = {
    update: timestamp,
    period: PERIOD,
    total_files: allStocks.length,
    nikkei225_count: allStocks.filter((s) => isNikkei225(s.raw)).length,
    sector_count: sectors.length,
    benchmark_code: benchmark?.symbol || "NIKKEI225_AVG",
    benchmark_name: benchmark?.name || "日経225平均",
  };

  writeJson("market_overview.json", marketOverview);
  writeJson("sector_heatmap.json", sectorHeatmap);
  writeJson("sector_details.json", sectorDetails);
  writeJson("nikkei225_strength_ranking.json", nikkeiStrength);
  writeJson("metadata.json", metadata);

  console.log("全部まとめて自動生成 完了");
}

main();
