// ai_sector/ai_sector_engine.js — セクター分析エンジン

window.AI_SECTOR = (function () {
  function getClose(row) {
    return row.close != null ? row.close : row.c;
  }

  function calcReturn(data, period) {
    period = period || 20;
    if (!data || data.length < period) return 0;
    const start = getClose(data[data.length - period]);
    const end = getClose(data[data.length - 1]);
    if (start == null || end == null || start === 0) return 0;
    return ((end - start) / start) * 100;
  }

  function groupBySector(allStocks) {
    const map = {};
    (allStocks || []).forEach(function (stock) {
      const sector = stock.industry || stock.meta?.industry || "不明";
      if (!map[sector]) map[sector] = [];
      map[sector].push(stock);
    });
    return map;
  }

  function buildSectorHeatmap(allStocks) {
    const groups = groupBySector(allStocks || []);
    const result = [];
    for (var sector in groups) {
      var arr = groups[sector];
      var sum = 0;
      arr.forEach(function (s) {
        sum += calcReturn(s.history);
      });
      var avg = arr.length ? sum / arr.length : 0;
      result.push({ sector: sector, score: avg });
    }
    return result.sort(function (a, b) {
      return b.score - a.score;
    });
  }

  function buildRelativeRanking(allStocks, nikkei) {
    var nikkeiReturn = calcReturn(nikkei || []);
    return (allStocks || [])
      .map(function (s) {
        var r = calcReturn(s.history);
        return { name: s.name, value: r - nikkeiReturn };
      })
      .sort(function (a, b) {
        return b.value - a.value;
      });
  }

  return {
    buildSectorHeatmap: buildSectorHeatmap,
    buildRelativeRanking: buildRelativeRanking,
    calcReturn: calcReturn,
  };
})();
