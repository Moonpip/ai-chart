/**
 * 未来勝率
 * MonteCarlo の結果から、銘柄が日経を上回る確率を計算
 */
(function(){
  if (typeof window === "undefined") return;

  if (!window.computeFutureIndexWinRate) {
    window.computeFutureIndexWinRate = function(AI){
      try {
        if (!AI || !AI.montecarlo || !AI.nikkeiMontecarlo) return null;

        const stockNow = AI.currentPrice;
        const nikkeiNow = AI.nikkeiCurrentPrice;

        if (!stockNow || !nikkeiNow) return null;

        const sp = AI.montecarlo?.paths;
        const np = AI.nikkeiMontecarlo?.paths;

        if (Array.isArray(sp) && Array.isArray(np) && sp.length && np.length) {
          const len = Math.min(sp.length, np.length);
          let win = 0;
          let total = 0;

          for (let i = 0; i < len; i++) {
            const s = sp[i];
            const n = np[i];
            if (s == null || n == null) continue;

            const sr = (s - stockNow) / stockNow;
            const nr = (n - nikkeiNow) / nikkeiNow;

            if (sr > nr) win++;
            total++;
          }

          if (!total) return null;
          return Math.round((win / total) * 100);
        }

        const sMid = AI.montecarlo?.mid;
        const nMid = AI.nikkeiMontecarlo?.mid;
        if (sMid == null || nMid == null) return null;

        const sr = (sMid - stockNow) / stockNow;
        const nr = (nMid - nikkeiNow) / nikkeiNow;
        const diff = sr - nr;

        // 簡易近似（paths が無い場合）
        const approx = 50 + diff * 200;
        return Math.max(0, Math.min(100, Math.round(approx)));
      } catch (e) {
        console.warn("computeFutureIndexWinRate:", e);
        return null;
      }
    };
  }
})();
