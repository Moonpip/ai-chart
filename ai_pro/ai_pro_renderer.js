// ===============================
// AI PRO パネル描画（依存ファイル方式）
// ===============================
var AI_PRO_PANEL_STORAGE_KEY = "aiProPanelPos";

function setupAiProPanelDrag(panel) {
  if (panel.__aiProDragBound) return;
  panel.__aiProDragBound = true;

  var longPressTimer = null;
  var isDragging = false;
  var startX = 0, startY = 0, startLeft = 0, startTop = 0;
  var activePointerId = null;
  var LONG_PRESS_MS = 400;

  function savePos(left, top) {
    try {
      localStorage.setItem(AI_PRO_PANEL_STORAGE_KEY, JSON.stringify({ left: left, top: top }));
    } catch (e) {}
  }

  function loadPos() {
    try {
      var s = localStorage.getItem(AI_PRO_PANEL_STORAGE_KEY);
      if (s) {
        var p = JSON.parse(s);
        if (Number.isFinite(p.left) && Number.isFinite(p.top)) {
          panel.style.left = p.left + "px";
          panel.style.top = p.top + "px";
          panel.style.right = "auto";
        }
      }
    } catch (e) {}
  }

  loadPos();

  function onDown(e) {
    if (e.target && e.target.closest("input, button, select, textarea")) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.stopPropagation();
    window.__aiDomPanelPointerActive = true;
    activePointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseFloat(panel.style.left) || (window.innerWidth - 260);
    startTop = parseFloat(panel.style.top) || 200;

    longPressTimer = setTimeout(function () {
      longPressTimer = null;
      isDragging = true;
      panel.style.cursor = "grabbing";
      try {
        panel.setPointerCapture(activePointerId);
      } catch (_) {}
      if (navigator.vibrate) navigator.vibrate(50);
    }, LONG_PRESS_MS);
  }

  function onMove(e) {
    if (!isDragging) return;
    if (e.pointerId !== activePointerId) return;
    e.stopPropagation();
    e.preventDefault();
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    var left = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, startLeft + dx));
    var top = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, startTop + dy));
    panel.style.left = left + "px";
    panel.style.top = top + "px";
    panel.style.right = "auto";
    startX = e.clientX;
    startY = e.clientY;
    startLeft = left;
    startTop = top;
    savePos(left, top);
  }

  function onUp(e) {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    window.__aiDomPanelPointerActive = false;
    if (isDragging) {
      if (e && typeof e.stopPropagation === "function") e.stopPropagation();
      isDragging = false;
      activePointerId = null;
      panel.style.cursor = "";
      savePos(parseFloat(panel.style.left), parseFloat(panel.style.top));
    }
  }

  panel.style.cursor = "grab";
  panel.style.userSelect = "none";
  panel.addEventListener("pointerdown", onDown, { passive: false });
  document.addEventListener("pointermove", onMove, { passive: false });
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onUp);
  panel.addEventListener("touchstart", function (e) {
    e.stopPropagation();
    window.__aiDomPanelPointerActive = true;
  }, { passive: true });
}

window.renderAIProPanel = function (result) {

  if (!result || result.error) return;
  if (window.aiDisplayFlags && window.aiDisplayFlags.aiProPanel === false) return;

  var panel = document.getElementById("aiProPanel");

  if (!panel) {
    panel = document.createElement("div");
    panel.id = "aiProPanel";
    panel.className = "ai-panel";
    panel.style.position = "fixed";
    panel.style.top = "200px";
    panel.style.right = "8px";
    panel.style.zIndex = "9000";
    panel.style.background = "rgba(0,0,0,0.85)";
    panel.style.border = "1px solid rgba(255,255,255,0.2)";
    panel.style.color = "#fff";
    panel.style.fontFamily = "monospace";
    panel.style.touchAction = "none";
    document.body.appendChild(panel);
    setupAiProPanelDrag(panel);
  }

  panel.style.display = (window.aiDisplayFlags && window.aiDisplayFlags.aiProPanel !== false) ? "" : "none";

  var reasonsHtml = result.reasons && result.reasons.length
    ? result.reasons.map(function (r) {
      return "・" + r;
    }).join("<br>")
    : "（なし）";

  var fmt = function (v) {
    if (v == null || v === undefined) return "—";
    if (typeof v === "number" && !isNaN(v)) return v;
    return String(v);
  };
  var pct = function (v) {
    if (v == null || v === undefined || isNaN(v)) return "—";
    return v.toFixed(1) + "%";
  };

  panel.innerHTML =
    "<div class=\"ai-panel-title\">AI分析 Pro</div>" +
    "<div class=\"ai-panel-body\">" +
    "総合: " + fmt(result.total) + " (" + fmt(result.rank) + ")<br>" +
    "上昇: " + pct(result.upProb) + " / 下落: " + pct(result.downProb) + " / 横ばい: " + pct(result.flatProb) + "<br><br>" +
    "<b>出来高:</b> " + fmt(result.volumeLabel) + " (スコア:" + fmt(result.volumeScore) + ")<br>" +
    "<b>過熱度:</b> " + (result.heatLevel != null ? Math.round(result.heatLevel) : "—") + "<br>" +
    "<b>乖離率:</b> " + (result.deviationPct != null ? result.deviationPct.toFixed(2) + "%" : "—") + "<br>" +
    "<b>トレンド:</b> " + fmt(result.trendState) + "<br>" +
    "<b>ブレイク率:</b> " + (result.breakRate != null ? result.breakRate.toFixed(1) + "%" : "—") + "<br>" +
    "<b>暴落リスク:</b> " + (result.crashRisk != null ? result.crashRisk.toFixed(2) + "%" : "—") + "<br><br>" +
    "上値: " + (result.upper != null ? Math.round(result.upper) : "—") + " / " +
    "中央: " + (result.mid != null ? Math.round(result.mid) : "—") + " / " +
    "下値: " + (result.lower != null ? Math.round(result.lower) : "—") + "<br>" +
    "RSI: " + (result.rsi != null ? Math.round(result.rsi) : "—") + " / " +
    "ATR: " + (result.atr != null ? result.atr.toFixed(2) : "—") + "<br><br>" +
    "根拠:<br>" + reasonsHtml +
    "</div>";
};
