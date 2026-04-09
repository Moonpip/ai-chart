/**
 * 銘柄 未来ライン描画
 * 銘柄予測（緑）の横線のみ描画。日経はオーバーレイテキストで表示。
 * スケール差（銘柄3k vs 日経55k）のため日経ラインは描画しない。
 */
(function(){
  if (typeof window === "undefined") return;

  if (!window.drawIndexLines) {
    window.drawIndexLines = function(ctx, AI, canvas, priceToY){
      if (!ctx || !AI || !AI.montecarlo) return;

      const stock = AI.montecarlo.mid;

      if (stock == null) return;
      if (typeof priceToY !== "function") return;

      const yStock = priceToY(stock);

      const x1 = (canvas && canvas.width != null) ? canvas.width - 120 : 0;
      const x2 = (canvas && canvas.width != null) ? canvas.width - 10 : 0;

      ctx.save();

      // 銘柄ライン（緑）のみ描画
      ctx.strokeStyle = "#00ffcc";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, yStock);
      ctx.lineTo(x2, yStock);
      ctx.stroke();

      ctx.restore();
    };
  }
})();
