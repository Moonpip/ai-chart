/**
 * 日経ベンチマーク未来ガイド
 * 銘柄予測と日経予測を比較し、AI.indexFuture に保存
 * 依存ファイル: ai_engine.js, ai_analysis_panel.js, ai_overlay_renderer.js
 */
(function(){
  if (typeof window === "undefined") return;

  if (!window.computeIndexFuture) {
    window.computeIndexFuture = function(stockForecast, nikkeiForecast){
      if (!stockForecast || !nikkeiForecast) return null;

      const stockMid = stockForecast.mid;
      const nikkeiMid = nikkeiForecast.mid;

      if (stockMid == null || nikkeiMid == null) return null;

      const diff = stockMid - nikkeiMid;

      return {
        diff: diff,
        outperform: diff > 0,
        strength: Math.abs(diff),
        stockMid: stockMid,
        nikkeiMid: nikkeiMid
      };
    };
  }

  if (!window.drawIndexFutureOverlay) {
    window.drawIndexFutureOverlay = function(ctx, AI, canvas){
      if (!ctx || !AI || !AI.indexFuture || !canvas) return;

      const f = AI.indexFuture;
      const x = canvas.width - 190;
      const y = 95;

      ctx.save();

      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(x - 12, y - 24, 172, 86);

      ctx.fillStyle = "#ffffff";
      ctx.font = "12px sans-serif";
      ctx.fillText("日経ベンチマーク", x, y);

      ctx.fillStyle = "#ffffff";
      ctx.fillText(`銘柄予測: ${Number(f.stockMid).toFixed(2)}`, x, y + 20);

      ctx.fillStyle = "#ffffff";
      ctx.fillText(`日経予測: ${Number(f.nikkeiMid).toFixed(2)}`, x, y + 38);

      ctx.fillStyle = f.outperform ? "#00ffcc" : "#ff6666";
      ctx.fillText(
        f.outperform ? `日経より強い ↑  差: ${Number(f.diff).toFixed(2)}` : `日経より弱い ↓  差: ${Number(f.diff).toFixed(2)}`,
        x,
        y + 58
      );

      ctx.restore();
    };
  }

  if (!window.renderIndexFuturePanel) {
    window.renderIndexFuturePanel = function(AI){
      if (!AI || !AI.indexFuture) return "";

      const f = AI.indexFuture;
      const color = f.outperform ? "#00ffcc" : "#ff6666";
      const text = f.outperform ? "日経より強い" : "日経より弱い";

      return `
        <div class="ai-box ai-index-future-box">
          <div><strong>📊 日経ベンチマーク</strong></div>
          <div>銘柄予測: ${Number(f.stockMid).toFixed(2)}</div>
          <div>日経予測: ${Number(f.nikkeiMid).toFixed(2)}</div>
          <div>差分: ${Number(f.diff).toFixed(2)}</div>
          <div style="color:${color}; font-weight:bold;">${text}</div>
        </div>
      `;
    };
  }
})();
