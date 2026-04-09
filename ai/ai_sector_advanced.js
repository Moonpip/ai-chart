export const ALL_SECTORS = [
  "水産・農林業","鉱業","建設業","食料品","繊維製品",
  "パルプ・紙","化学","医薬品","石油・石炭製品","ゴム製品",
  "ガラス・土石製品","鉄鋼","非鉄金属","金属製品","機械",
  "電気機器","輸送用機器","精密機器","その他製品","電気・ガス業",
  "陸運業","海運業","空運業","倉庫・運輸関連業","情報・通信業",
  "卸売業","小売業","銀行業","証券、商品先物取引業","保険業",
  "その他金融業","不動産業","サービス業"
];

export function normalizeSectorArray(sectors){
  const map = {};
  (sectors || []).forEach(s => {
    const name = s?.name ?? s?.sector ?? "";
    if(name) map[name] = s;
  });

  return ALL_SECTORS.map(name => {
    const s = map[name] || {};
    return {
      name,
      change: Number(s.change ?? 0),
      winRate20: Number(s.winRate20 ?? 0),
      volume: Number(s.volume ?? 0),
      volumeAvg20: Number(s.volumeAvg20 ?? 1),
      zScore: Number(s.zScore ?? 0),
      marketStrength: Number(s.marketStrength ?? 0)
    };
  });
}

export function buildSectorHeatmapData(sectors){
  return (sectors || []).map(s => {
    const volumeRatio = (s.volumeAvg20 > 0) ? ((s.volume || 0) / s.volumeAvg20) : 0;
    const heat = (s.change * 0.55) + (volumeRatio * 0.30) + ((s.winRate20 <= 1 ? s.winRate20 * 100 : s.winRate20) * 0.15);
    return {
      ...s,
      volumeRatio,
      heatScore: Number.isFinite(heat) ? heat : 0
    };
  }).sort((a,b) => (b.heatScore || 0) - (a.heatScore || 0));
}

export function buildSectorVsMarket(sectors, nikkeiData){
  const nikkeiChange = Number(nikkeiData?.change ?? 0);
  const nikkeiWinRate20 = Number(nikkeiData?.winRate20 ?? 50);

  return (sectors || []).map(s => {
    const sw = s.winRate20 ?? 0;
    const sWinRate = sw <= 1 ? sw * 100 : sw;
    const relChange = (s.change || 0) - nikkeiChange;
    const relTrend = (sWinRate || 0) - nikkeiWinRate20;

    let label = "中立";
    if(relChange > 1 && relTrend > 3) label = "日経より強い";
    else if(relChange < -1 && relTrend < -3) label = "日経より弱い";
    else if(relChange > 0) label = "やや強い";
    else if(relChange < 0) label = "やや弱い";

    return {
      ...s,
      relChange,
      relTrend,
      vsMarketLabel: label
    };
  }).sort((a,b) => (b.relChange || 0) - (a.relChange || 0));
}

export function buildSectorRotationAI(sectors){
  const groups = {
    "景気敏感": ["鉱業","非鉄金属","鉄鋼","機械","輸送用機器"],
    "ディフェンシブ": ["食料品","医薬品","電気・ガス業","小売業"],
    "金融": ["銀行業","証券、商品先物取引業","保険業","その他金融業"],
    "内需": ["不動産業","建設業","サービス業","陸運業"],
    "外需・成長": ["電気機器","精密機器","情報・通信業","卸売業"]
  };

  const summary = [];

  Object.keys(groups).forEach(groupName => {
    const names = groups[groupName];
    const matched = (sectors || []).filter(s => names.includes(s?.name));
    if(!matched.length){
      summary.push({
        group: groupName,
        avgChange: 0,
        avgVolumeRatio: 0,
        avgWinRate: 0,
        state: "データ不足"
      });
      return;
    }

    const avgChange = matched.reduce((a,b)=>a+(b.change||0),0) / matched.length;
    const avgVolumeRatio = matched.reduce((a,b)=>a+((b.volumeAvg20>0)?((b.volume||0)/b.volumeAvg20):0),0) / matched.length;
    const avgWinRate = matched.reduce((a,b)=>a+((b.winRate20<=1 ? (b.winRate20||0)*100 : (b.winRate20||0)),0) / matched.length;

    let state = "中立";
    if(avgChange > 1 && avgVolumeRatio > 1.2) state = "資金流入";
    else if(avgChange < -1 && avgVolumeRatio > 1.0) state = "資金流出";
    else if(avgWinRate > 55) state = "じわ強";
    else if(avgWinRate < 45) state = "じわ弱";

    summary.push({
      group: groupName,
      avgChange,
      avgVolumeRatio,
      avgWinRate,
      state
    });
  });

  const strongest = [...summary].sort((a,b)=> (b.avgChange + b.avgVolumeRatio) - (a.avgChange + a.avgVolumeRatio))[0] || null;
  const weakest   = [...summary].sort((a,b)=> (a.avgChange + a.avgVolumeRatio) - (b.avgChange + b.avgVolumeRatio))[0] || null;

  let rotationComment = "資金循環は中立です。";
  if(strongest && weakest){
    rotationComment =
      "今は「" + strongest.group + "」に資金が寄り、" +
      "「" + weakest.group + "」からは資金が抜けやすい状態です。";
  }

  return {
    groups: summary,
    strongest,
    weakest,
    rotationComment
  };
}
