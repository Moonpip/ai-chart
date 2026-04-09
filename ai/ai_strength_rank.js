/**
 * 強さランキング
 * 銘柄の強さスコア・ランク・全銘柄ランキング計算
 */
(function(){
  if (typeof window === "undefined") return;

  if (!window.computeStrengthScore) {
    window.computeStrengthScore = function(AI){
      try {
        if (!AI) return null;

        const stockNow = AI.currentPrice;
        const nikkeiNow = AI.nikkeiCurrentPrice;
        const stockMid = AI.montecarlo?.mid;
        const nikkeiMid = AI.nikkeiMontecarlo?.mid;
        const fw = AI.futureIndexWinRate;

        if (!stockNow || !nikkeiNow || stockMid == null || nikkeiMid == null || fw == null) return null;

        const sr = (stockMid - stockNow) / stockNow;
        const nr = (nikkeiMid - nikkeiNow) / nikkeiNow;
        const diff = sr - nr;

        let score =
          50 +
          sr * 180 +
          diff * 220 +
          (fw - 50) * 0.6;

        score = Math.max(0, Math.min(100, Math.round(score)));
        return score;
      } catch (e) {
        console.warn("computeStrengthScore:", e);
        return null;
      }
    };
  }

  if (!window.getStrengthRankLabel) {
    window.getStrengthRankLabel = function(score){
      if (score == null) return "-";
      if (score >= 85) return "S";
      if (score >= 70) return "A";
      if (score >= 55) return "B";
      return "C";
    };
  }

  if (!window.buildStrengthRanking) {
    window.buildStrengthRanking = function(allData, helpers){
      try {
        if (!allData || typeof allData !== "object") return [];

        const monte =
          helpers?.computeMonteCarloFuture ||
          window.computeMonteCarloFuture;

        const futureWin =
          helpers?.computeFutureIndexWinRate ||
          window.computeFutureIndexWinRate;

        if (typeof monte !== "function" || typeof futureWin !== "function") return [];

        const nikkeiData = allData?.["1001"]?.history || [];
        if (!Array.isArray(nikkeiData) || nikkeiData.length < 30) return [];

        const nikkeiMontecarlo = monte(nikkeiData);
        const nikkeiCurrentPrice =
          nikkeiData[nikkeiData.length - 1]?.close ??
          nikkeiData[nikkeiData.length - 1]?.c;

        if (!nikkeiMontecarlo || !nikkeiCurrentPrice) return [];

        const result = [];

        for (const code of Object.keys(allData)) {
          if (code === "1001") continue;

          const history = allData?.[code]?.history;
          if (!Array.isArray(history) || history.length < 30) continue;

          const currentPrice =
            history[history.length - 1]?.close ??
            history[history.length - 1]?.c;

          if (!currentPrice) continue;

          const montecarlo = monte(history);
          if (!montecarlo) continue;

          const tempAI = {
            montecarlo,
            nikkeiMontecarlo,
            currentPrice,
            nikkeiCurrentPrice
          };

          tempAI.futureIndexWinRate = futureWin(tempAI);
          tempAI.strengthScore = window.computeStrengthScore ? window.computeStrengthScore(tempAI) : null;
          tempAI.strengthRank = window.getStrengthRankLabel ? window.getStrengthRankLabel(tempAI.strengthScore) : "-";

          if (tempAI.strengthScore == null) continue;

          result.push({
            code,
            name: allData?.[code]?.name || code,
            score: tempAI.strengthScore,
            rank: tempAI.strengthRank,
            futureWinRate: tempAI.futureIndexWinRate
          });
        }

        result.sort((a, b) => b.score - a.score);
        return result;
      } catch (e) {
        console.warn("buildStrengthRanking:", e);
        return [];
      }
    };
  }

  if (!window.getTopStrengthRanking) {
    window.getTopStrengthRanking = function(limit){
      const allData = window.allData || {};
      const rows = window.buildStrengthRanking ? window.buildStrengthRanking(allData, {}) : [];
      return rows.slice(0, limit || 20);
    };
  }
})();
