/* ======================================
   AI サポート・レジスタンス検出
   スイングポイント抽出＋近い価格まとめ
====================================== */

(function(){

function detectSupportResistance(data){
  if(!data || data.length < 50) return {supports:[], resistances:[]};

  const levels = [];

  // スイングポイント抽出
  for(let i=2; i<data.length-2; i++){
    const p = data[i];

    if(p.low < data[i-1].low && p.low < data[i-2].low &&
       p.low < data[i+1].low && p.low < data[i+2].low){
      levels.push({price:p.low, type:"support"});
    }

    if(p.high > data[i-1].high && p.high > data[i-2].high &&
       p.high > data[i+1].high && p.high > data[i+2].high){
      levels.push({price:p.high, type:"resistance"});
    }
  }

  // 近い価格まとめる
  const merged = [];

  levels.forEach(l=>{
    let found = false;

    for(let m of merged){
      if(Math.abs(m.price - l.price) < m.price*0.01){
        m.count++;
        m.price = (m.price + l.price)/2;
        found = true;
        break;
      }
    }

    if(!found){
      merged.push({price:l.price, type:l.type, count:1});
    }
  });

  const supports = merged.filter(x=>x.type==="support" && x.count>=2);
  const resistances = merged.filter(x=>x.type==="resistance" && x.count>=2);

  return {supports, resistances};
}

window.detectSupportResistance = detectSupportResistance;

/* ======================================
   AI サポート・レジスタンスゾーン検出
   スイングポイント抽出＋ゾーングループ化
====================================== */
function computeSupportResistance(priceData) {
  if (!priceData || priceData.length < 50) return [];

  const zones = [];
  const pivots = [];

  for (let i = 2; i < priceData.length - 2; i++) {
    const p = priceData[i];

    if (
      p.high > priceData[i - 1].high &&
      p.high > priceData[i - 2].high &&
      p.high > priceData[i + 1].high &&
      p.high > priceData[i + 2].high
    ) {
      pivots.push({ price: p.high, type: "resistance", index: i });
    }

    if (
      p.low < priceData[i - 1].low &&
      p.low < priceData[i - 2].low &&
      p.low < priceData[i + 1].low &&
      p.low < priceData[i + 2].low
    ) {
      pivots.push({ price: p.low, type: "support", index: i });
    }
  }

  const grouped = [];

  pivots.forEach((p) => {
    let found = false;
    for (const g of grouped) {
      if (g.price && Math.abs(g.price - p.price) / g.price < 0.01) {
        g.prices.push(p.price);
        g.indices.push(p.index);
        found = true;
        break;
      }
    }
    if (!found) {
      grouped.push({
        price: p.price,
        type: p.type,
        prices: [p.price],
        indices: [p.index]
      });
    }
  });

  grouped.forEach((g) => {
    const avg = g.prices.reduce((a, b) => a + b, 0) / g.prices.length;
    zones.push({
      price: avg,
      low: avg * 0.995,
      high: avg * 1.005,
      touches: g.prices.length,
      indices: g.indices,
      type: g.type
    });
  });

  return zones;
}

window.computeSupportResistance = computeSupportResistance;

})();
