/**
 * 市場比較（相対強度） - AIパネル用
 * 日経リターン・銘柄リターン・相対強度・アウト/アンダーパフォーム判定
 * 依存ファイルとして追加、失敗しても動作継続
 */
(function () {
  if (typeof window === "undefined") return;

  window.AI_REL = (function () {
    function calcReturn(data, period) {
      period = period || 20;
      if (!data || data.length < period) return 0;

      var last = data[data.length - period];
      var curr = data[data.length - 1];
      var start = Number(last && (last.close != null ? last.close : last.c)) || 0;
      var end = Number(curr && (curr.close != null ? curr.close : curr.c)) || 0;
      if (!start || !end) return 0;

      return ((end - start) / start) * 100;
    }

    function analyze(stockData, nikkeiData) {
      if (!stockData || !nikkeiData) {
        return { error: true };
      }

      var stockReturn = calcReturn(stockData, 20);
      var nikkeiReturn = calcReturn(nikkeiData, 20);

      var relative = stockReturn - nikkeiReturn;

      var judge = "普通";
      if (relative > 2) judge = "強い（アウトパフォーム）";
      else if (relative < -2) judge = "弱い（アンダーパフォーム）";

      return {
        stockReturn: stockReturn,
        nikkeiReturn: nikkeiReturn,
        relative: relative,
        judge: judge
      };
    }

    return {
      analyze: analyze
    };
  })();

  /* 呼び出し＆表示：既存 renderAIProPanel をラップして市場比較を追加 */
  var orig = window.renderAIProPanel;
  if (typeof orig === "function") {
    window.renderAIProPanel = function (result) {
      try {
        var stockData = window.currentData || window.priceData || window.data || [];
        var nikkeiJson = window.allData && window.allData["1001"];
        var nikkeiData = Array.isArray(nikkeiJson)
          ? nikkeiJson
          : (nikkeiJson && nikkeiJson.history) || window.nikkeiData || [];

        if (nikkeiData.length < 20 && stockData.length >= 20) {
          nikkeiData = stockData;
        }

        var rel = window.AI_REL.analyze(stockData, nikkeiData);
        window.aiRelativeResult = rel;
      } catch (e) {
        window.aiRelativeResult = { error: true };
        console.warn("REL error", e);
      }

      orig.apply(this, arguments);

      try {
        var panel = document.getElementById("aiProPanel");
        if (panel && window.aiRelativeResult && !window.aiRelativeResult.error) {
          var r = window.aiRelativeResult;
          var body = panel.querySelector(".ai-panel-body");
          if (body) {
            var fmt = function (v) {
              return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
            };
            body.innerHTML +=
              "<br><b>市場比較:</b><br>" +
              "日経: " + fmt(r.nikkeiReturn) + "<br>" +
              "銘柄: " + fmt(r.stockReturn) + "<br>" +
              "相対強度: " + fmt(r.relative) + "<br>" +
              "判定: " + r.judge + "<br>";
          }
        }
      } catch (e2) {
        console.warn("REL display error", e2);
      }
    };
  }
})();
