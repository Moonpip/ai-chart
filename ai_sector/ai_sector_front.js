// ai_sector/ai_sector_front.js — generated/*.json を読んで表示（重い・ズレる・信用ない 完全解決）

window.AI_SECTOR_FRONT = (function () {
  var heatmap = null;
  var details = null;
  var ranking = null;

  var STORAGE_KEY = "sectorPanelPos";
  var LONG_MS = 450;

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

  function setupPanelDrag(panel) {
    if (panel.__sectorDragBound) return;
    panel.__sectorDragBound = true;

    var dragTimer = null;
    var dragging = false;
    var startX = 0, startY = 0, startLeft = 0, startTop = 0;

    function onMove(e) {
      if (!dragging) return;
      e.preventDefault();
      e.stopPropagation();
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      var maxL = Math.max(0, (window.innerWidth || 800) - panel.offsetWidth);
      var maxT = Math.max(0, (window.innerHeight || 600) - panel.offsetHeight);
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

    panel.addEventListener("pointerdown", function (e) {
      if (e.target && e.target.closest && (e.target.closest(".sectorTab") || e.target.closest(".sectorRow") || e.target.closest(".rankRow") || e.target.closest(".stockRow"))) return;
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
        savePanelPos(startLeft, startTop);
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

  function loadAll() {
    if (window.marketData) {
      console.log("セクターキャッシュ使用");
      return;
    }
    fetch("./public/generated/market_full.json")
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        window.marketData = data;
        heatmap = data.sector_heatmap || null;
        details = data.sector_details || null;
        ranking = data.ranking || null;
        renderAll(data);
      })
      .catch(function (err) {
        if (typeof window !== "undefined" && window.__IMA_DEBUG__) {
          console.warn("market_full 読み込み失敗", err);
        }
      });
  }

  function renderAll(data) {
    if (!data) {
      console.error("dataなし");
      return;
    }
    var panel = document.getElementById("sectorPanel");
    if (panel && panel._sectorMode) {
      var body = document.getElementById("sectorPanelBody");
      if (body) {
        if (panel._sectorMode === "ranking") renderRankingBody(body);
        else renderSectorBody(body);
      }
    }
  }

  function renderSectorPanel(initialMode) {
    var old = document.getElementById("sectorPanel");
    if (old) {
      if (initialMode == null) {
        old.remove();
        return;
      }
    }

    var panel = document.getElementById("sectorPanel");
    var pos = loadPanelPos();
    var left = (pos && pos.left != null) ? pos.left : 80;
    var top = (pos && pos.top != null) ? pos.top : 100;

    if (!panel) {
      panel = document.createElement("div");
      panel.id = "sectorPanel";
      panel.style.cssText =
        "position:fixed;left:" + left + "px;top:" + top + "px;width:min(280px,90vw);max-width:280px;max-height:70vh;" +
        "overflow:hidden;display:flex;flex-direction:column;cursor:grab;" +
        "background:rgba(0,0,0,0.95);color:#fff;padding:12px;z-index:9000;border-radius:10px;" +
        "border:1px solid #2c3b55;box-shadow:0 4px 12px rgba(0,0,0,0.5);";
      document.body.appendChild(panel);
       }
    // ima.html 等で既存 #sectorPanel がある場合も長押しドラッグを1回だけ付与
    setupPanelDrag(panel);

    var mode = initialMode || panel._sectorMode || "sector";
    panel._sectorMode = mode;

    var tabStyle = "padding:8px 12px;cursor:pointer;border-radius:6px;font-size:12px;margin-right:6px;";
    var tabActive = tabStyle + "background:#2c3b55;color:#9fe8ff;";
    var tabInactive = tabStyle + "background:rgba(255,255,255,0.08);color:#888;";

    var html =
      "<div style=\"display:flex;margin-bottom:10px;flex-shrink:0;\">" +
      "<div class=\"sectorTab\" data-mode=\"ranking\" style=\"" + (mode === "ranking" ? tabActive : tabInactive) + "\">日経225強弱</div>" +
      "<div class=\"sectorTab\" data-mode=\"sector\" style=\"" + (mode === "sector" ? tabActive : tabInactive) + "\">セクター資金</div>" +
      "</div>" +
      "<div id=\"sectorPanelBody\" style=\"flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;\"></div>";

    panel.innerHTML = html;

    // ① 表示日（market_full.json の data.date。innerHTML のたびに先頭へ差し込む）
    var prevDateEl = document.getElementById("sectorPanelDateLabel");
    if (prevDateEl) prevDateEl.remove();
    var dateLabel = document.createElement("div");
    dateLabel.id = "sectorPanelDateLabel";
    dateLabel.style.fontSize = "12px";
    dateLabel.style.color = "#aaa";
    dateLabel.style.padding = "4px 8px";
    dateLabel.style.borderBottom = "1px solid #333";
    dateLabel.style.background = "#111";
    dateLabel.style.flexShrink = "0";
    var md = typeof window !== "undefined" ? window.marketData : null;
    dateLabel.textContent = "表示日: " + (md && md.date != null && String(md.date) !== "" ? String(md.date) : "----");
    panel.insertBefore(dateLabel, panel.firstChild);

    panel.querySelectorAll(".sectorTab").forEach(function (el) {
      el.onclick = function () {
        var m = el.getAttribute("data-mode");
        renderSectorPanel(m);
      };
    });

    var body = document.getElementById("sectorPanelBody");
    if (!body) return;

    if (mode === "ranking") {
      renderRankingBody(body);
    } else {
      renderSectorBody(body);
    }
  }

  function renderRankingBody(container) {
    if (!ranking) {
      container.innerHTML = "<span style=\"color:#888;\">nikkei225_strength_ranking.json がありません。</span>";
      return;
    }
    var html = "";
    if (ranking.update) {
      html += "<span style=\"color:#666;font-size:10px;\">更新: " + String(ranking.update).replace("T", " ").slice(0, 19) + "</span><br><br>";
    }
    (ranking.ranking || []).slice(0, 20).forEach(function (s, i) {
      var sign = s.return >= 0 ? "+" : "";
      html +=
        "<div class=\"rankRow\" data-code=\"" + (s.code || "").replace(/"/g, "&quot;") + "\" " +
        "style=\"margin:6px 0;padding:6px;cursor:pointer;border-radius:6px;background:rgba(255,255,255,0.06);font-size:12px;\">" +
        (i + 1) + ". " + sign + (s.return != null ? s.return.toFixed(1) : "0") + "% " + (s.name || "?") +
        "</div>";
    });
    container.innerHTML = html;
    container.querySelectorAll(".rankRow").forEach(function (el) {
      el.onclick = function () {
        var code = el.getAttribute("data-code");
        if (code && (window.loadStock || window.loadChart)) (window.loadStock || window.loadChart)(code);
      };
      el.onmouseenter = function () { this.style.background = "rgba(79,227,255,0.15)"; };
      el.onmouseleave = function () { this.style.background = "rgba(255,255,255,0.06)"; };
    });
  }

  function renderSectorBody(container) {
    if (!heatmap) {
      container.innerHTML = "<span style=\"color:#888;\">sector_heatmap.json がありません。</span>";
      return;
    }
    var html = "";
    if (heatmap.update) {
      html += "<span style=\"color:#666;font-size:10px;\">更新: " + String(heatmap.update).replace("T", " ").slice(0, 19) + "</span><br><br>";
    }
    (heatmap.sectors || []).forEach(function (sec) {
      html +=
        "<div class=\"sectorRow\" data-sec=\"" + (sec.sector || "").replace(/"/g, "&quot;") + "\" " +
        "style=\"margin:6px 0;padding:8px;cursor:pointer;border-radius:6px;background:rgba(255,255,255,0.04);font-size:13px;\">" +
        (sec.color || "🟩") + " " + (sec.sector || "不明") + " (" + (sec.score != null ? sec.score.toFixed(1) : "0") + "%)" +
        "</div>";
    });
    html += "<hr style=\"border-color:#333;margin:12px 0;\"><div id=\"sectorDetail\"></div>";
    container.innerHTML = html;
    container.querySelectorAll(".sectorRow").forEach(function (el) {
      el.onclick = function () { renderSectorDetail(el.getAttribute("data-sec")); };
    });
  }

  function renderSectorDetail(secName) {
    if (!details) return;

    var sec = (details.sectors || []).filter(function (s) {
      return s.sector === secName;
    })[0];
    if (!sec) return;

    var html = "<br><b style=\"color:#9fe8ff;\">【" + secName + "（日経225）】</b><br>";

    (sec.stocks || []).slice(0, 20).forEach(function (s, i) {
      var width = Math.min(100, Math.max(10, Math.abs(s.return)));
      var sign = s.return >= 0 ? "+" : "";
      html +=
        "<div class=\"stockRow\" data-code=\"" +
        (s.code || "").replace(/"/g, "&quot;") +
        "\" style=\"margin:6px 0;padding:6px;cursor:pointer;border-radius:6px;background:rgba(255,255,255,0.06);font-size:12px;\">" +
        (i + 1) +
        ". " +
        "<span style=\"display:inline-block;width:" +
        width +
        "px;height:6px;background:#4fe3ff;margin-right:6px;vertical-align:middle;\"></span>" +
        sign +
        (s.return != null ? s.return.toFixed(1) : "0") +
        "% " +
        (s.name || "?") +
        "</div>";
    });

    var detailEl = document.getElementById("sectorDetail");
    if (detailEl) detailEl.innerHTML = html;

    document.querySelectorAll("#sectorPanel .stockRow").forEach(function (el) {
      el.onclick = function () {
        var code = el.getAttribute("data-code");
        if (code && (window.loadStock || window.loadChart)) {
          (window.loadStock || window.loadChart)(code);
        }
      };
      el.onmouseenter = function () {
        this.style.background = "rgba(79,227,255,0.15)";
      };
      el.onmouseleave = function () {
        this.style.background = "rgba(255,255,255,0.06)";
      };
    });
  }

  function renderRanking() {
    renderSectorPanel("ranking");
  }

  return {
    loadAll: loadAll,
    renderSectorPanel: renderSectorPanel,
    renderSectorDetail: renderSectorDetail,
    renderRanking: renderRanking,
    renderRankingBody: renderRankingBody,
    renderSectorBody: renderSectorBody,
  };
})();

window.addEventListener("load", function () {
  window.AI_SECTOR_FRONT.loadAll();
  setTimeout(function () {
    var sectorBtns = document.querySelectorAll("[id='sectorBtn']");
    var sectorBtn = sectorBtns[0];
    if (sectorBtn) {
      for (var i = 1; i < sectorBtns.length; i++) sectorBtns[i].remove();
      var s = sectorBtn.cloneNode(true);
      s.onclick = function () {
        var p = document.getElementById("sectorPanel");
        window.AI_SECTOR_FRONT.renderSectorPanel(p ? undefined : "sector");
      };
      sectorBtn.parentNode.replaceChild(s, sectorBtn);
    }
    // rankingBtn は clone しない（ima.html の click リスナーと二重登録・表示トグル競合のため）
  }, 0);
});
