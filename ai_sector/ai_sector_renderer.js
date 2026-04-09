// ai_sector/ai_sector_renderer.js — セクター分析パネル（ヒートマップ・日経強弱）

(function () {
  var SECTOR_LOAD_LIMIT = 300;
  var STORAGE_KEY = "sectorPanelPos";
  var LONG_MS = 450;

  function sampleFromList(arr, limit) {
    if (!arr || arr.length === 0) return [];
    if (arr.length <= limit) return arr.slice();
    var step = arr.length / limit;
    var sampled = [];
    for (var i = 0; i < limit; i++) {
      var idx = Math.min(Math.floor(i * step), arr.length - 1);
      sampled.push(arr[idx]);
    }
    return sampled;
  }

  function isIndexCode(code) {
    var c = String(code || "");
    return c === "1001" || c === "1002" || c === "1003" || c === "1004";
  }

  async function fetchSectorData() {
    var list = window.STOCK_LIST || [];
    var items = [];
    if (list.length > 0) {
      items = sampleFromList(list, SECTOR_LOAD_LIMIT);
    } else {
      try {
        var res = await fetch("final_json/list.json");
        var listData = await res.json();
        var arr = Array.isArray(listData) ? listData : listData.history || [];
        items = sampleFromList(arr, SECTOR_LOAD_LIMIT);
      } catch (e) {
        console.warn("セクター: list.json 読込失敗", e);
        return { allStocks: [], nikkeiData: [] };
      }
    }
    items = items.filter(function (x) {
      return !isIndexCode(x.symbol || x.code);
    });

    var nikkeiPromise = fetch("final_json/1001.json")
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (json) {
        return (json && json.history) || [];
      })
      .catch(function () {
        return (window.allData && window.allData["1001"] && window.allData["1001"].history) || [];
      });

    var stockPromises = items.map(function (item) {
      var code = item.symbol || item.code;
      if (!code) return Promise.resolve(null);
      return fetch("final_json/" + code + ".json")
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (json) {
          if (!json) return null;
          var h = json.history || [];
          return {
            code: String(code),
            name: json.name || item.name || code,
            industry: json.industry || null,
            history: h,
          };
        })
        .catch(function () {
          return null;
        });
    });

    var results = await Promise.all(stockPromises);
    var allStocks = results.filter(Boolean);
    var nikkeiData = await nikkeiPromise;

    return { allStocks: allStocks, nikkeiData: nikkeiData };
  }

  function loadPanelPos() {
    try {
      var s = localStorage.getItem(STORAGE_KEY);
      if (s) {
        var p = JSON.parse(s);
        if (Number.isFinite(p.left) && Number.isFinite(p.top)) {
          return { left: p.left, top: p.top };
        }
      }
    } catch (_) { }
    return null;
  }

  function savePanelPos(left, top) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ left: left, top: top }));
    } catch (_) { }
  }

  function setupDrag(panel) {
    var dragTimer = null;
    var dragging = false;
    var startX = 0,
      startY = 0,
      startLeft = 0,
      startTop = 0;

    function onMove(e) {
      if (!dragging) return;
      e.preventDefault();
      e.stopPropagation();
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      var maxL = Math.max(0, (window.innerWidth || 400) - panel.offsetWidth);
      var maxT = Math.max(0, (window.innerHeight || 400) - panel.offsetHeight);
      var left = Math.max(0, Math.min(maxL, startLeft + dx));
      var top = Math.max(0, Math.min(maxT, startTop + dy));
      panel.style.left = left + "px";
      panel.style.top = top + "px";
      startX = e.clientX;
      startY = e.clientY;
      startLeft = left;
      startTop = top;
      savePanelPos(left, top);
    }

    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      if (dragTimer) {
        clearTimeout(dragTimer);
        dragTimer = null;
      }
      if (dragging) {
        dragging = false;
        panel.style.cursor = "";
        savePanelPos(parseFloat(panel.style.left), parseFloat(panel.style.top));
      }
    }

    panel.addEventListener(
      "pointerdown",
      function (e) {
        if (e.target && e.target.closest && e.target.closest("a, button")) return;
        e.stopPropagation();
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseFloat(panel.style.left) || 80;
        startTop = parseFloat(panel.style.top) || 120;
        if (dragTimer) clearTimeout(dragTimer);
        dragTimer = setTimeout(
          function () {
            dragTimer = null;
            dragging = true;
            panel.style.cursor = "grabbing";
            if (navigator.vibrate) navigator.vibrate(50);
            document.addEventListener("pointermove", onMove);
            document.addEventListener("pointerup", onUp);
            document.addEventListener("pointercancel", onUp);
            try {
              panel.setPointerCapture(e.pointerId);
            } catch (_) { }
          },
          LONG_MS
        );
      },
      false
    );

    panel.addEventListener("pointermove", function (e) {
      if (
        dragTimer &&
        Math.hypot(
          e.clientX - startX,
          e.clientY - startY
        ) > 12
      ) {
        clearTimeout(dragTimer);
        dragTimer = null;
      }
    });

    panel.addEventListener("pointerup", function () {
      if (dragTimer) {
        clearTimeout(dragTimer);
        dragTimer = null;
      }
    });
  }

  window.toggleSectorPanel = async function () {
    var panel = document.getElementById("sectorPanel");
    if (panel) {
      panel.remove();
      return;
    }

    panel = document.createElement("div");
    panel.id = "sectorPanel";

    var pos = loadPanelPos();
    var left = (pos && pos.left != null) ? pos.left : 80;
    var top = (pos && pos.top != null) ? pos.top : 120;

    panel.style.cssText =
      "position:fixed;left:" +
      left +
      "px;top:" +
      top +
      "px;width:min(280px, 90vw);max-width:280px;background:rgba(0,0,0,0.9);color:#fff;padding:12px;z-index:9000;border-radius:8px;border:1px solid #2c3b55;box-shadow:0 4px 12px rgba(0,0,0,0.5);overflow-y:auto;max-height:70vh;-webkit-overflow-scrolling:touch;touch-action:pan-y;user-select:none;cursor:grab;";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "セクター分析パネル");

    panel.innerHTML =
      '<div style="font-size:12px;color:#9fe8ff;">読み込み中…</div>';

    document.body.appendChild(panel);
    setupDrag(panel);

    var data = null;
    if (
      Array.isArray(window.allStocks) &&
      window.allStocks.length > 0 &&
      Array.isArray(window.nikkeiData) &&
      window.nikkeiData.length >= 20
    ) {
      data = {
        allStocks: window.allStocks,
        nikkeiData: window.nikkeiData,
      };
    } else {
      data = await fetchSectorData();
      window.allStocks = data.allStocks;
      window.nikkeiData = data.nikkeiData;
    }

    if (!window.AI_SECTOR) {
      panel.innerHTML =
        '<div style="color:#ff8888;">セクターエンジンが読み込まれていません</div>';
      return;
    }

    var heat = window.AI_SECTOR.buildSectorHeatmap(data.allStocks);
    var rank = window.AI_SECTOR.buildRelativeRanking(
      data.allStocks,
      data.nikkeiData
    );
    var nikkeiRet =
      data.nikkeiData && data.nikkeiData.length >= 20
        ? window.AI_SECTOR.calcReturn(data.nikkeiData)
        : 0;

    var html = '<b style="color:#9fe8ff;">① セクターヒートマップ</b><br>';

    heat.slice(0, 8).forEach(function (h) {
      var icon =
        h.score > 2 ? "🔥🔥🔥" : h.score > 1 ? "🔥🔥" : h.score > 0 ? "🔥" : "❄️";
      html +=
        (h.sector || "不明").substring(0, 12) +
        " " +
        icon +
        " (" +
        h.score.toFixed(1) +
        "%)<br>";
    });

    html += '<br><b style="color:#9fe8ff;">② セクター比較（vs日経）</b><br>';
    heat.slice(0, 5).forEach(function (h) {
      var diff = h.score - nikkeiRet;
      var sign = diff >= 0 ? "+" : "";
      var color = diff >= 0 ? "#4fe3ff" : "#ff4f6a";
      html +=
        '<span style="color:' +
        color +
        '">' +
        (h.sector || "不明").substring(0, 10) +
        " " +
        sign +
        diff.toFixed(1) +
        "%</span><br>";
    });

    html += '<br><b style="color:#9fe8ff;">③ 日経225強弱ランキング</b><br>';

    rank.slice(0, 8).forEach(function (r, i) {
      var sign = r.value >= 0 ? "+" : "";
      html +=
        (i + 1) +
        ". " +
        (r.name || "?").substring(0, 14) +
        " " +
        sign +
        r.value.toFixed(1) +
        "%<br>";
    });

    panel.innerHTML = html;
  };
})();
