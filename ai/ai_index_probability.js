/**
 * 日経アウトパフォーム確率
 * 銘柄が日経より上昇した日の割合（%）を計算
 * 依存: ai_engine.js
 */
(function(){
  if (typeof window === "undefined") return;

  if (!window.computeIndexProbability) {
    window.computeIndexProbability = function(stockData, nikkeiData){
      if (!stockData || !nikkeiData) return null;

      let win = 0;
      let total = 0;

      const len = Math.min(stockData.length, nikkeiData.length);

      for (let i = 1; i < len; i++) {
        const s1 = stockData[i]?.close ?? stockData[i]?.c;
        const s0 = stockData[i - 1]?.close ?? stockData[i - 1]?.c;

        const n1 = nikkeiData[i]?.close ?? nikkeiData[i]?.c;
        const n0 = nikkeiData[i - 1]?.close ?? nikkeiData[i - 1]?.c;

        if (!s1 || !s0 || !n1 || !n0) continue;

        const sr = (s1 - s0) / s0;
        const nr = (n1 - n0) / n0;

        if (sr > nr) win++;

        total++;
      }

      if (total === 0) return null;

      return Math.round((win / total) * 100);
    };
  }
})();
