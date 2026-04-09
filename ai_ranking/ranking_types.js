// ai_ranking/ranking_types.js

export const RANKING_TYPES = {
  price: [
    { key: "gain", name: "値上がり率" },
    { key: "loss", name: "値下がり率" },
    { key: "volume", name: "出来高" },
    { key: "value", name: "売買代金" }
  ],
  flow: [
    { key: "volume_spike", name: "出来高急増" },
    { key: "money_flow", name: "資金流入" }
  ],
  trend: [
    { key: "trend_up", name: "上昇トレンド" },
    { key: "trend_down", name: "下降トレンド" }
  ],
  momentum: [
    { key: "rsi", name: "RSI" },
    { key: "macd", name: "MACD" },
    { key: "divergence", name: "乖離率" }
  ],
  ai: [
    { key: "ai_prob_up", name: "AI上昇確率" },
    { key: "ai_expect", name: "AI期待値" },
    { key: "ai_winrate", name: "AI勝率" }
  ],
  anomaly: [
    { key: "crash", name: "暴落検出" },
    { key: "spike", name: "急騰検出" }
  ],
  benchmark: [
    { key: "nikkei_outperform", name: "日経アウトパフォーム" },
    { key: "relative_strength", name: "相対強度" }
  ]
};
