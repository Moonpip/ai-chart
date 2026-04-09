// ai_ranking/ranking_controller.js

import { RANKING_TYPES } from "./ranking_types.js";
import { computeRanking } from "./ranking_engine.js";
import { renderRanking, renderRankingNav } from "./ranking_ui.js";

let cachedAllData = null;
let preloadPromise = null;

const RANKING_LOAD_LIMIT = 400;
const FETCH_CONCURRENCY = 6;

function sampleFromList(arr, limit) {
  if (!arr || arr.length === 0) return [];
  if (arr.length <= limit) return arr.slice();
  const step = arr.length / limit;
  const sampled = [];
  for (let i = 0; i < limit; i++) {
    const idx = Math.min(Math.floor(i * step), arr.length - 1);
    sampled.push(arr[idx]);
  }
  return sampled;
}

async function fetchWithConcurrency(items, concurrency, fetchFn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      const item = items[i];
      try {
        results[i] = await fetchFn(item, i);
      } catch (_) {
        results[i] = null;
      }
    }
  }
  const workers = Array(Math.min(concurrency, items.length)).fill(0).map(() => worker());
  await Promise.all(workers);
  return results;
}

async function fetchAllStockData() {
  let items = [];
  const list = window.STOCK_LIST || [];
  if (list.length > 0) {
    items = sampleFromList(list, RANKING_LOAD_LIMIT);
  } else {
    try {
      const res = await fetch("final_json/list.json");
      const listData = await res.json();
      const arr = Array.isArray(listData) ? listData : listData.history || [];
      items = sampleFromList(arr, RANKING_LOAD_LIMIT);
    } catch (e) {
      console.warn("ランキング: list.json 読込失敗", e);
      return [];
    }
  }
  const results = await fetchWithConcurrency(items, FETCH_CONCURRENCY, async (item) => {
    const code = item.symbol || item.code;
    if (!code) return null;
    try {
      const res = await fetch(`final_json/${code}.json`);
      if (!res.ok) return null;
      const json = await res.json();
      const h = json.history || [];
      return {
        code: String(code),
        name: json.name || item.name || code,
        symbol: String(code),
        industry: json.industry || null,
        history: h,
        indicators: json.indicators,
        AI: json.AI,
        anomaly: json.anomaly,
        relative: json.relative
      };
    } catch (_) {
      return null;
    }
  });

  const data = results.filter(Boolean);
  cachedAllData = data;
  return data;
}

function buildPanel(allData) {
  const panel = document.getElementById("rankingPanel");
  if (panel) {
    panel.innerHTML = "";
  }

  const container = panel || document.createElement("div");
  if (!panel) {
    container.id = "rankingPanel";
    container.style.cssText = `
      position:absolute;
      left:10px;
      top:80px;
      width:420px;
      max-height:70vh;
      overflow-y:auto;
      background:#111;
      color:#fff;
      padding-left:8px;
      z-index:9999;
      border:1px solid #2c3b55;
      border-radius:8px;
      box-shadow:0 4px 12px rgba(0,0,0,0.5);
      display:none;
    `;
    document.body.appendChild(container);
  }

  const header = document.createElement("div");
  const body = document.createElement("div");
  header.className = "ranking-header";
  body.className = "ranking-body";

  header.style.cssText = `
    position:sticky;
    top:0;
    z-index:10;
    background:#111;
    padding:10px;
    border-bottom:1px solid #333;
  `;

  body.style.cssText = `
    overflow:visible;
  `;

  header.appendChild(createPanelHeader());

  const allTypes = [];
  Object.keys(RANKING_TYPES).forEach((cat) => {
    RANKING_TYPES[cat].forEach((t) => allTypes.push(t));
  });
  renderRankingNav(header, allTypes);

  Object.keys(RANKING_TYPES).forEach((category) => {
    RANKING_TYPES[category].forEach((type) => {
      const list = computeRanking(allData, type.key);
      if (list.length > 0) {
        renderRanking(body, type.name, list, type.key);
      }
    });
  });

  container.appendChild(header);
  container.appendChild(body);

  setupRankingPanelDrag(container);
  setupRankingPanelMobile(container);

  return container;
}

function setupRankingPanelMobile(panel) {
  const header = panel.querySelector(".ranking-panel-header");
  if (!header) return;

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  header.addEventListener("touchstart", (e) => {
    const touch = e.touches[0];
    isDragging = true;
    offsetX = touch.clientX - panel.getBoundingClientRect().left;
    offsetY = touch.clientY - panel.getBoundingClientRect().top;
  }, { passive: true });

  header.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    panel.style.left = (touch.clientX - offsetX) + "px";
    panel.style.top = (touch.clientY - offsetY) + "px";
    panel.style.right = "auto";
  }, { passive: false });

  header.addEventListener("touchend", () => {
    isDragging = false;
  }, { passive: true });

  const resizeHandle = document.createElement("div");
  resizeHandle.style.cssText = `
    position:absolute;
    right:0;
    bottom:0;
    width:20px;
    height:20px;
    background:#00ffff;
    cursor:se-resize;
  `;
  panel.appendChild(resizeHandle);

  let isResizing = false;

  function onResizeMove(e) {
    if (!isResizing) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = panel.getBoundingClientRect();
    panel.style.width = Math.max(280, touch.clientX - rect.left) + "px";
    panel.style.height = Math.max(200, touch.clientY - rect.top) + "px";
  }

  function onResizeEnd() {
    isResizing = false;
    window.removeEventListener("touchmove", onResizeMove);
    window.removeEventListener("touchend", onResizeEnd);
    window.removeEventListener("touchcancel", onResizeEnd);
  }

  resizeHandle.addEventListener("touchstart", (e) => {
    e.preventDefault();
    isResizing = true;
    window.addEventListener("touchmove", onResizeMove, { passive: false });
    window.addEventListener("touchend", onResizeEnd);
    window.addEventListener("touchcancel", onResizeEnd);
  }, { passive: false });

  resizeHandle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    isResizing = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = panel.offsetWidth;
    const startH = panel.offsetHeight;

    function onMouseMove(ev) {
      const w = Math.max(280, startW + (ev.clientX - startX));
      const h = Math.max(200, startH + (ev.clientY - startY));
      panel.style.width = w + "px";
      panel.style.height = h + "px";
    }

    function onMouseUp() {
      isResizing = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}

function setupRankingPanelDrag(panel) {
  const header = panel.querySelector(".ranking-panel-header");
  if (!header) return;

  let dragTimer = null;
  const LONG_MS = 450;
  let startX = 0;
  let startY = 0;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let isDragging = false;

  function onMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const left = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, e.clientX - dragOffsetX));
    const top = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffsetY));
    panel.style.left = left + "px";
    panel.style.top = top + "px";
    panel.style.right = "auto";
  }

  function onUp() {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onUp);
    if (isDragging && navigator.vibrate) navigator.vibrate(30);
    isDragging = false;
  }

  header.addEventListener("pointerdown", (e) => {
    if (e.target && e.target.id === "rankingPanelClose") return;
    e.stopPropagation();
    const rect = panel.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    if (dragTimer) clearTimeout(dragTimer);
    dragTimer = setTimeout(() => {
      dragTimer = null;
      isDragging = true;
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      panel.style.left = rect.left + "px";
      panel.style.top = rect.top + "px";
      panel.style.right = "auto";
      if (navigator.vibrate) navigator.vibrate(50);
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
      try {
        header.setPointerCapture(e.pointerId);
      } catch (_) {}
    }, LONG_MS);
  });

  header.addEventListener("pointermove", (e) => {
    if (dragTimer && Math.hypot(e.clientX - startX, e.clientY - startY) > 12) {
      clearTimeout(dragTimer);
      dragTimer = null;
    }
  });

  header.addEventListener("pointerup", () => {
    if (dragTimer) {
      clearTimeout(dragTimer);
      dragTimer = null;
    }
  });
}

function createPanelHeader() {
  const header = document.createElement("div");
  header.className = "ranking-panel-header";
  header.style.cssText =
    "display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #333;cursor:move;user-select:none;touch-action:none;";
  header.innerHTML = `
    <span style="font-weight:bold;color:#9fe8ff;">🏆 ランキング</span>
    <button id="rankingPanelClose" style="background:#2c3b55;color:#9fe8ff;border:1px solid #3b4b6a;border-radius:4px;cursor:pointer;padding:4px 8px;font-size:11px;">閉じる</button>
  `;
  header.querySelector("#rankingPanelClose").onclick = () => hideRankingPanel();
  return header;
}

function showRankingPanel() {
  const panel = document.getElementById("rankingPanel");
  if (panel) {
    panel.style.display = "block";
    return;
  }
}

function hideRankingPanel() {
  const panel = document.getElementById("rankingPanel");
  if (panel) panel.style.display = "none";
}

export function initRankingSystem(allData) {
  const panel = buildPanel(allData);
  panel.style.display = "none";
}

export function preloadRankingData() {
  if (cachedAllData || preloadPromise) return preloadPromise;
  preloadPromise = fetchAllStockData();
  return preloadPromise;
}

export async function openRankingPanel() {
  let panel = document.getElementById("rankingPanel");
  if (!panel || !panel.querySelector(".ranking-panel-body")) {
    const status = document.createElement("div");
    status.id = "rankingPanel";
    status.style.cssText = `
      position:fixed;
      left:50%;
      top:50%;
      transform:translate(-50%,-50%);
      width:260px;
      padding:24px;
      background:#1e2635;
      color:#9fe8ff;
      border:1px solid #2c3b55;
      border-radius:12px;
      box-shadow:0 4px 20px rgba(0,0,0,0.5);
      text-align:center;
      z-index:99999;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:12px;
    `;
    status.innerHTML = `
      <span style="display:inline-block;width:24px;height:24px;border:3px solid #2c3b55;border-top-color:#9fe8ff;border-radius:50%;animation:rankingSpin 0.8s linear infinite;"></span>
      <span>読み込み中...</span>
    `;
    if (!document.getElementById("rankingSpinStyle")) {
      const style = document.createElement("style");
      style.id = "rankingSpinStyle";
      style.textContent = "@keyframes rankingSpin{to{transform:rotate(360deg)}}";
      document.head.appendChild(style);
    }
    document.body.appendChild(status);

    let allData = cachedAllData;
    if (!allData) {
      if (preloadPromise) {
        allData = await preloadPromise;
      } else {
        allData = await fetchAllStockData();
      }
    }
    status.remove();
    if (allData.length === 0) {
      const err = document.createElement("div");
      err.id = "rankingPanel";
      err.style.cssText = status.style.cssText;
      err.textContent = "銘柄データが取得できませんでした";
      document.body.appendChild(err);
      setTimeout(() => err.remove(), 3000);
      return;
    }
    initRankingSystem(allData);
  }

  showRankingPanel();
}

export function createRankingButton() {
  const btn = document.createElement("div");
  btn.id = "rankingBtn";
  btn.innerHTML = "🏆 ランキング";
  btn.style.cssText = `
    background:#1e2635;
    color:#9fe8ff;
    border:1px solid #2c3b55;
    border-radius:8px;
    padding:6px 10px;
    cursor:pointer;
    user-select:none;
    font-size:12px;
    width:100%;
    text-align:center;
    margin-bottom:8px;
  `;
  btn.onmouseenter = () => {
    btn.style.background = "#2a334a";
  };
  btn.onmouseleave = () => {
    btn.style.background = "#1e2635";
  };
  btn.onclick = () => {
    openRankingPanel();
  };

  const aiBtn = document.getElementById("aiBtn");
  if (aiBtn && aiBtn.nextElementSibling) {
    aiBtn.parentNode.insertBefore(btn, aiBtn.nextElementSibling);
  } else if (aiBtn) {
    aiBtn.parentNode.appendChild(btn);
  } else {
    document.getElementById("sidebar")?.appendChild(btn);
  }
}
