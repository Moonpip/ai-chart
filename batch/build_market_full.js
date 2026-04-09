// batch/build_market_full.js — 全表示用データを market_full.json 1つに統合
// 対象: セクターヒートマップ、セクター詳細、日経225ランキング、市場状態
// 20時更新で固定・フロント計算ゼロ・高速表示

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "final_json");
const OUTPUT = path.join(ROOT, "public", "generated", "market_full.json");
const PERIOD = 20;

const NIKKEI_BENCHMARK_CODES = ["1001", "NIKKEI", "^N225", "998407", "NI225", "NKY"];

const INDUSTRY_FALLBACK_BY_SYMBOL = {
  "8332": "銀行業",
  "8355": "銀行業",
  "9613": "情報・通信業",
  "9681": "サービス業",
};

function complementIndustry(json) {
  const raw =
    json?.industry ||
    json?.meta?.industry ||
    json?.sector ||
    json?.meta?.sector;
  if (raw && String(raw).trim()) return String(raw).trim();

  const symbol = getSymbol(json);
  if (INDUSTRY_FALLBACK_BY_SYMBOL[symbol]) {
    return INDUSTRY_FALLBACK_BY_SYMBOL[symbol];
  }

  const name = String(json?.name || json?.meta?.name || "").toUpperCase();
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
    .filter((f) => f.toLowerCase().endsWith(".json") && f !== "list.json");

  const items = [];
  for (const file of files) {
    try {
      const fullPath = path.join(DATA_DIR, file);
      const json = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      const symbol = getSymbol(json);
      const name = getName(json);
      const history = getHistory(json);

      if (!symbol || !history.length) continue;

      items.push({
        file,
        symbol,
        name,
        industry: complementIndustry(json),
        indexes: json.indexes || json.meta?.indexes || {},
        history,
        raw: json,
      });
    } catch (_) {}
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
    pseudoReturn,
  };
}

function main() {
  console.log("market_full.json 生成開始...");
  console.log("DATA_DIR:", DATA_DIR);

  const allStocks = readAllFinalJson();
  const nikkei225 = allStocks.filter((s) => isNikkei225(s.raw));
  console.log("全銘柄:", allStocks.length, "日経225:", nikkei225.length);

  const benchmark = findBenchmark(allStocks);
  const benchmarkReturn =
    benchmark?.pseudoReturn ?? calcReturn(benchmark?.history || []);
  console.log("ベンチマーク:", benchmark?.symbol || "NIKKEI225_AVG", benchmarkReturn?.toFixed(2) + "%");

  const all = nikkei225.map((s) => {
    const ret = calcReturn(s.history);
    return {
      code: s.symbol,
      name: s.name,
      industry: s.industry,
      return: Number(ret.toFixed(2)),
      relative_strength: Number((ret - benchmarkReturn).toFixed(2)),
      volume_ratio: Number(calcVolumeRatio(s.history).toFixed(2)),
      money_flow_score: Number(calcMoneyFlowScore(s.history).toFixed(2)),
    };
  });

  const ranking = [...all].sort((a, b) => {
    if (b.relative_strength !== a.relative_strength) return b.relative_strength - a.relative_strength;
    return b.return - a.return;
  });

  const sectors = {};
  for (const s of all) {
    const sec = s.industry || "不明";
    if (!sectors[sec]) sectors[sec] = [];
    sectors[sec].push(s);
  }

  const sectorArr = [];
  for (const sec in sectors) {
    const arr = sectors[sec];
    const avg = arr.reduce((sum, a) => sum + a.return, 0) / arr.length;
    arr.sort((a, b) => b.return - a.return);
    const rank = toHeatRank(avg);
    const color = toHeatColor(rank);
    sectorArr.push({
      sector: sec,
      score: Number(avg.toFixed(2)),
      vs_nikkei: Number(
        (arr.reduce((sum, a) => sum + a.relative_strength, 0) / arr.length).toFixed(2)
      ),
      money_flow_score: Number(
        (arr.reduce((sum, a) => sum + a.money_flow_score, 0) / arr.length).toFixed(2)
      ),
      rank,
      color,
      count: arr.length,
      stocks: arr.slice(0, 20),
    });
  }
  sectorArr.sort((a, b) => b.score - a.score);

  const top = sectorArr[0];
  let state = "中立";
  if (top && top.score > 10) state = "強気";
  else if (top && top.score < -5) state = "弱気";

  const update = new Date().toISOString();

  const out = {
    update,
    period: PERIOD,
    benchmark_return: Number(benchmarkReturn.toFixed(2)),

    market: {
      state,
      focus_sector: top?.sector || "",
    },

    sector_heatmap: {
      update,
      sectors: sectorArr.map((s) => ({
        sector: s.sector,
        score: s.score,
        vs_nikkei: s.vs_nikkei,
        money_flow_score: s.money_flow_score,
        color: s.color,
        rank: s.rank,
        count: s.count,
      })),
    },

    sector_details: {
      update,
      sectors: sectorArr,
    },

    ranking: {
      update,
      ranking: ranking.slice(0, 50),
    },
  };

  const outDir = path.dirname(OUTPUT);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2), "utf-8");
  console.log("market_full.json 完成:", OUTPUT);
}

main();
