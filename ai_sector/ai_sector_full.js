// ai_sector/ai_sector_full.js — 33業種＋クリック→銘柄一覧→チャート遷移

window.AI_SECTOR_FULL = (function () {
  function getClose(row) {
    return row.close != null ? row.close : row.c;
  }

  function calcReturn(data, period) {
    period = period || 20;
    if (!data || data.length < period) return 0;
    var start = getClose(data[data.length - period]);
    var end = getClose(data[data.length - 1]);
    if (start == null || end == null || start === 0) return 0;
    return ((end - start) / start) * 100;
  }

  function groupBySector(stocks) {
    var map = {};
    (stocks || []).forEach(function (s) {
      var sec = s.industry || s.meta?.industry || "不明";
      if (!map[sec]) map[sec] = [];
      map[sec].push(s);
    });
    return map;
  }

  function buildSectorData(stocks) {
    var groups = groupBySector(stocks || []);
    var result = [];
    for (var sec in groups) {
      var arr = groups[sec];
      var sum = 0;
      arr.forEach(function (s) {
        sum += calcReturn(s.history);
      });
      result.push({
        name: sec,
        score: arr.length ? sum / arr.length : 0,
        list: arr,
      });
    }
    return result.sort(function (a, b) {
      return b.score - a.score;
    });
  }

  return {
    buildSectorData: buildSectorData,
    calcReturn: calcReturn,
  };
})();

(function () {
  var SECTOR_LOAD_LIMIT = 400;
  var STORAGE_KEY = "sectorFullPanelPos";
  var LONG_MS = 450;

  function sampleFromList(arr, limit) {
    if (!arr || arr.length === 0) return [];
    if (arr.length <= limit) return arr.slice();
    var step = arr.length / limit;
    var out = [];
    for (var i = 0; i < limit; i++) {
      var idx = Math.min(Math.floor(i * step), arr.length - 1);
      out.push(arr[idx]);
    }
    return out;
  }

  function isIndexCode(code) {
    var c = String(code || "");
    return c === "1001" || c === "1002" || c === "1003" || c === "1004";
  }

  async function fetchAllStocks() {
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
        return [];
      }
    }
    items = items.filter(function (x) {
      return !isIndexCode(x.symbol || x.code);
    });

    var results = await Promise.all(
      items.map(function (item) {
        var code = item.symbol || item.code;
        if (!code) return Promise.resolve(null);
        return fetch("final_json/" + code + ".json")
          .then(function (r) {
            return r.ok ? r.json() : null;
          })
          .then(function (json) {
            if (!json) return null;
            return {
              code: String(code),
              name: json.name || item.name || code,
              industry: json.industry || null,
              history: json.history || [],
              indexes: json.indexes,
              meta: json.meta || { industry: json.industry, indexes: json.indexes },
            };
          })
          .catch(function () {
            return null;
          });
      })
    );
    return results.filter(Boolean);
  }

  function loadPos() {
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

  function savePos(left, top) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ left: left, top: top }));
    } catch (_) { }
  }

  function setupDrag(panel) {
    var dragTimer = null;
    var dragging = false;
    var startX = 0, startY = 0, startLeft = 0, startTop = 0;

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
      savePos(left, top);
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
        savePos(parseFloat(panel.style.left), parseFloat(panel.style.top));
      }
    }

    panel.addEventListener("pointerdown", function (e) {
      if (e.target && e.target.closest && (e.target.closest("a, button") || e.target.closest(".stockRow"))) return;
      e.stopPropagation();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseFloat(panel.style.left) || 80;
      startTop = parseFloat(panel.style.top) || 100;
      if (dragTimer) clearTimeout(dragTimer);
      dragTimer = setTimeout(function () {
        dragTimer = null;
        dragging = true;
        panel.style.cursor = "grabbing";
        if (navigator.vibrate) navigator.vibrate(50);
        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
        document.addEventListener("pointercancel", onUp);
        try { panel.setPointerCapture(e.pointerId); } catch (_) { }
      }, LONG_MS);
    }, false);

    panel.addEventListener("pointermove", function (e) {
      if (dragTimer && Math.hypot(e.clientX - startX, e.clientY - startY) > 12) {
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

  function showSectorDetail(secName, sectorData) {
    var sorted = [];
    if (sectorData && sectorData.stocks) {
      sorted = sectorData.stocks.map(function (s) {
        return { name: s.name, code: s.code, value: s.return };
      });
    } else {
      var stocks = window.allStocks || [];
      var sectors = window.AI_SECTOR_FULL.buildSectorData(stocks);
      var sec = sectors.filter(function (s) { return s.name === secName; })[0];
      if (!sec) return;
      sorted = sec.list
        .filter(function (s) {
          var idx = s.indexes || (s.meta && s.meta.indexes);
          return idx && idx.NIKKEI225 === true;
        })
        .map(function (s) {
          return {
            name: s.name,
            code: s.code,
            value: window.AI_SECTOR_FULL.calcReturn(s.history),
          };
        })
        .sort(function (a, b) { return b.value - a.value; });
    }

    var html = "<br><b style=\"color:#9fe8ff;\">【" + secName + "（日経225）】</b><br>";

    sorted.slice(0, 20).forEach(function (s, i) {
      var sign = s.value >= 0 ? "+" : "";
      html += "<div class=\"stockRow\" data-code=\"" + (s.code || "").replace(/"/g, "&quot;") + "\" style=\"margin:6px 0;padding:8px;cursor:pointer;border-radius:6px;background:rgba(255,255,255,0.06);font-size:12px;pointer-events:auto;\">" +
        (i + 1) + ". █████ " + sign + s.value.toFixed(1) + "% " + (s.name || "?") +
        "</div>";
    });

    if (sorted.length === 0) {
      html += "<div style=\"color:#888;font-size:12px;padding:8px;\">日経225構成銘柄がありません</div>";
    }

    var detailEl = document.getElementById("sectorDetail");
    if (detailEl) detailEl.innerHTML = html;

    document.querySelectorAll("#sectorFullPanel .stockRow").forEach(function (el) {
      el.onclick = function (e) {
        e.stopPropagation();
        var code = el.getAttribute("data-code");
        if (!code) return;
        var fn = window.loadStock || window.loadChart;
        if (typeof fn === "function") fn(code);
      };
      el.onmouseenter = function () { this.style.background = "rgba(79,227,255,0.15)"; };
      el.onmouseleave = function () { this.style.background = "rgba(255,255,255,0.06)"; };
    });
  }

  window.showSectorPanel = async function () {
    var old = document.getElementById("sectorFullPanel");
    if (old) {
      old.remove();
      return;
    }

    var placeholder = document.createElement("div");
    placeholder.id = "sectorFullPanel";
    placeholder.style.cssText = "position:fixed;top:100px;left:80px;width:min(300px,90vw);max-width:300px;background:rgba(0,0,0,0.95);color:#fff;padding:16px;z-index:9000;border-radius:10px;border:1px solid #2c3b55;";
    placeholder.innerHTML = "<span style=\"color:#9fe8ff;\">読み込み中…</span>";
    document.body.appendChild(placeholder);

    var sectors = [];
    var useGenerated = false;
    try {
      var res = await fetch("public/generated/sector_details.json");
      if (res.ok) {
        var data = await res.json();
        window.__sectorDetailsData = data;
        sectors = (data.sectors || []).slice(0, 33);
        useGenerated = sectors.length > 0;
      }
    } catch (_) { }
    if (!useGenerated) {
      var stocks = [];
      try {
        stocks = await fetchAllStocks();
      } catch (e) {
        console.warn("セクター: 読込エラー", e);
      }
      window.allStocks = stocks;
      window.__sectorDetailsData = null;
      sectors = window.AI_SECTOR_FULL.buildSectorData(stocks).slice(0, 33);
    }
    placeholder.remove();

    var panel = document.createElement("div");
    panel.id = "sectorFullPanel";

    var pos = loadPos();
    var left = (pos && pos.left != null) ? pos.left : 80;
    var top = (pos && pos.top != null) ? pos.top : 100;

    panel.style.cssText =
      "position:fixed;left:" + left + "px;top:" + top + "px;" +
      "width:min(300px,90vw);max-width:300px;max-height:70vh;" +
      "overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;touch-action:pan-y;" +
      "background:rgba(0,0,0,0.95);color:#fff;padding:12px;z-index:9000;border-radius:10px;" +
      "border:1px solid #2c3b55;box-shadow:0 4px 12px rgba(0,0,0,0.5);" +
      "cursor:grab;user-select:none;";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "セクター資金");

    var html = "<b style=\"color:#9fe8ff;font-size:14px;\">【セクター資金】</b><br><br>";
    if (window.__sectorDetailsData && window.__sectorDetailsData.update) {
      html += "<span style=\"color:#666;font-size:10px;\">更新: " + (window.__sectorDetailsData.update || "").replace("T", " ").slice(0, 19) + "</span><br><br>";
    }
    if (sectors.length === 0) {
      html += "<span style=\"color:#888;font-size:12px;\">データがありません。npm run build:market を実行してください。</span><br><br>";
    }
    sectors.forEach(function (sec, idx) {
      var secName = sec.sector || sec.name || "不明";
      var score = sec.score != null ? sec.score : 0;
      var color = sec.color || "🟩";
      if (!sec.color) {
        if (score > 15) color = "🟥";
        else if (score > 10) color = "🟧";
        else if (score > 5) color = "🟨";
      }
      html += "<div class=\"sectorRow\" data-sec=\"" + String(secName).replace(/"/g, "&quot;") + "\" data-sec-idx=\"" + idx + "\" style=\"margin-bottom:6px;padding:8px;cursor:pointer;border-radius:6px;background:rgba(255,255,255,0.04);font-size:13px;\">" +
        color + " " + secName + " (" + score.toFixed(1) + "%)" +
        "</div>";
    });

    html += "<hr style=\"border-color:#333;margin:12px 0;\">";
    html += "<div id=\"sectorDetail\"></div>";

    panel.innerHTML = html;
    document.body.appendChild(panel);
    setupDrag(panel);

    panel.querySelectorAll(".sectorRow").forEach(function (el) {
      el.onclick = function () {
        var secName = el.getAttribute("data-sec");
        var secIdx = el.getAttribute("data-sec-idx");
        var secData = null;
        if (window.__sectorDetailsData && secIdx !== null) {
          var arr = window.__sectorDetailsData.sectors || [];
          secData = arr[parseInt(secIdx, 10)];
        }
        showSectorDetail(secName, secData);
      };
    });
  };

  window.addEventListener("load", function () {
    var rankingBtn = document.querySelector("#rankingBtn");
    if (!rankingBtn) return;

    var existing = document.getElementById("sectorBtn");
    if (existing) {
      var fresh = existing.cloneNode(true);
      fresh.onclick = window.showSectorPanel;
      existing.parentNode.replaceChild(fresh, existing);
      return;
    }

    var btn = document.createElement("div");
    btn.id = "sectorBtn";
    btn.innerText = "📊 セクター";
    btn.style.cssText = "margin-top:10px;padding:10px;background:#222;color:#fff;border-radius:8px;text-align:center;cursor:pointer;";
    btn.onclick = window.showSectorPanel;
    rankingBtn.parentNode.insertBefore(btn, rankingBtn.nextSibling);
  });
})();
