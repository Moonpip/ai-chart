/**
 * 未来ライン＋雲
 * 銘柄未来予測と日経未来予測を斜めライン＋雲で描画
 * リターン差で outperform 判断、緑/赤で色分け
 */
(function () {
  if (typeof window === "undefined") return;

  if (!window.drawFutureCloudBenchmark) {
    window.drawFutureCloudBenchmark = function (ctx, AI, chartLike, options) {
      try {
        if (!ctx || !AI || !AI.montecarlo || !AI.nikkeiMontecarlo) return;

        const stockMid = AI.montecarlo?.mid;
        const nikkeiMid = AI.nikkeiMontecarlo?.mid;
        if (stockMid == null || nikkeiMid == null) return;

        const canvasWidth =
          chartLike?.width ??
          chartLike?.canvas?.width ??
          options?.canvas?.width ??
          0;
        if (!canvasWidth) return;

        const priceToY =
          options?.priceToY ||
          chartLike?.yPrice ||
          chartLike?.priceToY;

        if (typeof priceToY !== "function") return;

        const currentPrice =
          AI.currentPrice ??
          options?.currentPrice ??
          stockMid;

        const nikkeiCurrentPrice =
          AI.nikkeiCurrentPrice ??
          options?.nikkeiCurrentPrice ??
          nikkeiMid;

        if (!currentPrice || !nikkeiCurrentPrice) return;

        const stockReturn = (stockMid - currentPrice) / currentPrice;
        const nikkeiReturn = (nikkeiMid - nikkeiCurrentPrice) / nikkeiCurrentPrice;
        const outperform = stockReturn >= nikkeiReturn;

        const yNow = priceToY(currentPrice);
        const yStock = priceToY(stockMid);
        const yNikkei = priceToY(nikkeiMid);

        if (!Number.isFinite(yNow) || !Number.isFinite(yStock) || !Number.isFinite(yNikkei)) {
          return;
        }

        const xStart = Math.max(0, canvasWidth - 110);
        const xEnd = Math.max(0, canvasWidth - 16);

        ctx.save();

        // 雲
        ctx.beginPath();
        ctx.moveTo(xStart, yNow);
        ctx.lineTo(xEnd, yStock);
        ctx.lineTo(xEnd, yNikkei);
        ctx.lineTo(xStart, yNow);
        ctx.closePath();
        ctx.fillStyle = outperform ? "rgba(0,255,180,0.18)" : "rgba(255,80,120,0.18)";
        ctx.fill();

        // 銘柄未来線
        ctx.beginPath();
        ctx.moveTo(xStart, yNow);
        ctx.lineTo(xEnd, yStock);
        ctx.strokeStyle = "#00ffcc";
        ctx.lineWidth = 2;
        ctx.stroke();

        // 日経未来線
        ctx.beginPath();
        ctx.moveTo(xStart, yNow);
        ctx.lineTo(xEnd, yNikkei);
        ctx.strokeStyle = "#ffaa00";
        ctx.lineWidth = 2;
        ctx.stroke();

        // 終点マーカー
        ctx.beginPath();
        ctx.arc(xEnd, yStock, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#00ffcc";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(xEnd, yNikkei, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffaa00";
        ctx.fill();

        ctx.restore();
      } catch (e) {
        console.warn("drawFutureCloudBenchmark:", e);
      }
    };
  }
})();
