// ai_ranking/ranking_controller.js

import { renderRanking, renderRankingNav, renderSectorRankingBlock } from "./ranking_ui.js";
import { loadRankingFast } from "../js/ranking_controller_fast.js";

let cachedAllData = null;

const RANKING_LOAD_LIMIT = 400;
const FETCH_CONCURRENCY = 6;

/** loadRankingFast が返すセクション（final_json 由来の [code, name, score][]）と対応 */
const rankingTypes = [
  { key: "gain", name: "上昇率" },
  { key: "loss", name: "下落率" },
  { key: "volume", name: "出来高" },
  { key: "range", name: "値幅" },
  { key: "volatility", name: "ボラ" },
  { key: "sector", name: "セクター分析" }
];

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

/** ima.html の getCurrentDateForSector と同等（window 未定義時はローカル解決） */
function getCurrentDateForSector() {
  if (typeof window !== "undefined" && typeof window.getCurrentDateForSector === "function") {
    return window.getCurrentDateForSector();
  }
  const candidates =
    typeof window !== "undefined"
      ? [window.STOCK_DATA, window.currentData, window.priceData]
      : [];
  for (let i = 0; i < candidates.length; i++) {
    const d = candidates[i];
    if (!Array.isArray(d) || !d.length) continue;
    const last = d[d.length - 1];
    if (!last || last.date == null) continue;
    return String(last.date).slice(0, 10);
  }
  return null;
}

/** ランキング JSON ファイル名用 YYYY-MM-DD（YYYYMMDD / ISO 混在を統一） */
function normalizeRankingDateKey(d) {
  if (d == null || d === "") return null;
  const raw = String(d).trim().replace(/T.*/, "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  const t = Date.parse(raw);
  if (!Number.isNaN(t)) {
    const dt = new Date(t);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return raw.length >= 10 ? raw.slice(0, 10) : null;
}

/** チャートと同じ基準日（ima の window.CURRENT_DATE を最優先） */
function getDesiredRankingDate() {
  if (typeof window !== "undefined" && window.CURRENT_DATE != null && String(window.CURRENT_DATE).trim() !== "") {
    return normalizeRankingDateKey(window.CURRENT_DATE);
  }
  return normalizeRankingDateKey(getCurrentDateForSector());
}

let lastRankingBuiltDate = null;

/** 同一パネルの initRanking を直列化（二重フェッチ防止） */
let rankingLoadChain = Promise.resolve();

/** 旧 DOM や組み立て順のずれでも日付行を確実に置く */
function ensureRankingAsOfDateEl(panel) {
  if (!panel) return null;
  let el = panel.querySelector("#rankingAsOfDate");
  if (el) return el;
  const header = panel.querySelector(".ranking-header");
  if (!header) return null;
  el = document.createElement("div");
  el.id = "rankingAsOfDate";
  el.style.cssText =
    "font-size:11px;line-height:1.45;color:#9cc3d8;margin:0 0 10px 2px;white-space:pre-line;";
  const titleRow = header.querySelector(".ranking-panel-header");
  if (titleRow && titleRow.nextSibling) {
    header.insertBefore(el, titleRow.nextSibling);
  } else {
    header.insertBefore(el, header.firstChild);
  }
  return el;
}

function updateRankingDateLabel(panel, dataResolvedDate, options) {
  const opt = options || {};
  const el = ensureRankingAsOfDateEl(panel) || panel?.querySelector("#rankingAsOfDate");
  const want = lastRankingBuiltDate || getDesiredRankingDate();
  const resolved =
    dataResolvedDate != null && String(dataResolvedDate).trim() !== ""
      ? normalizeRankingDateKey(dataResolvedDate)
      : null;
  let labelDate = resolved || want;
  if (opt.dataBasisUnknown) {
    labelDate = null;
  }
  if (typeof window !== "undefined") {
    window.__RANKING_AS_OF_DATE__ = labelDate ? labelDate : "";
  }
  if (!el) return;
  el.textContent = labelDate ? `取得日（データ基準）: ${labelDate}` : "";
}

/**
 * 様々なランキング JSON を { items: [{ code, name, sector, score }] } に統一する
 */
function normalizeRankingJson(raw) {
  if (raw == null || typeof raw !== "object") return null;
  let items;
  if (Array.isArray(raw)) {
    items = raw;
  } else {
    items =
      raw.data?.items ??
      raw.items ??
      raw.results ??
      raw.list ??
      raw.rows ??
      raw.entries ??
      null;
  }
  if (!Array.isArray(items)) return null;

  const mapped = items.map((item) => {
    if (item == null) {
      return { code: "", name: "", sector: "", score: null };
    }
    if (typeof item !== "object") {
      return { code: String(item), name: "", sector: "", score: null };
    }
    const code =
      item.code ??
      item.symbol ??
      item.ticker ??
      item.stockCode ??
      item.stock_code ??
      item.id ??
      "";
    const name = item.name ?? item.nm ?? item.company ?? item.title ?? item.stockName ?? "";
    const sector = item.sector ?? item.industry ?? item.sectorName ?? item.industryName ?? "";
    const scoreRaw =
      item.score ??
      item.value ??
      item.rate ??
      item.changePct ??
      item.change_pct ??
      item.pct ??
      item.gain ??
      item.change ??
      item.val ??
      item.percent ??
      item.diff;
    let score = null;
    if (scoreRaw !== undefined && scoreRaw !== null && scoreRaw !== "") {
      const n = Number(scoreRaw);
      score = Number.isNaN(n) ? null : n;
    }
    return {
      code: code !== undefined && code !== null ? String(code) : "",
      name: name !== undefined && name !== null ? String(name) : "",
      sector: sector !== undefined && sector !== null ? String(sector) : "",
      score
    };
  });

  return { items: mapped };
}


/** 日次 bundle のセクションを renderRanking 用 items に変換（[code, name, score][] 対応） */
function dailySectionToItems(raw) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    const n = normalizeRankingJson(raw);
    return n?.items ?? [];
  }
  if (raw.length && raw[0] != null && typeof raw[0] === "object" && !Array.isArray(raw[0])) {
    const n = normalizeRankingJson({ items: raw });
    return n?.items ?? [];
  }
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!Array.isArray(row) || row.length < 3) continue;
    const code = row[0];
    const name = row[1];
    const scoreN = Number(row[2]);
    out.push({
      code: code != null ? String(code) : "",
      name: name != null ? String(name) : "",
      sector: "",
      score: Number.isFinite(scoreN) ? scoreN : null
    });
  }
  return out;
}

async function loadSectorRankingJson(dateKey) {
  try {
    const res = await fetch(`generated/sector/${dateKey}.json?v=${Date.now()}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

async function initRanking(body, currentDate) {
  console.log("🔥 新ランキング処理:", currentDate);
  const container = body ?? document.querySelector(".ranking-body");
  if (!container) return;

  const dateKey = normalizeRankingDateKey(currentDate) || getDesiredRankingDate();
  if (!dateKey) {
    container.innerHTML = `
      <div style="color:#aaa;padding:10px;">
        ランキングデータが取得できませんでした
      </div>
    `;
    const panelEarly =
      container.closest("#rankingPanel") ||
      (typeof document !== "undefined" ? document.getElementById("rankingPanel") : null);
    updateRankingDateLabel(panelEarly, null, { dataBasisUnknown: true });
    return;
  }

  container.innerHTML = "";

  const [ranking, sectorPayload] = await Promise.all([
    loadRankingFast(dateKey),
    loadSectorRankingJson(dateKey)
  ]);

  if (!ranking) {
    if (sectorPayload && Array.isArray(sectorPayload.sector33) && sectorPayload.sector33.length) {
      const sectorAcquire =
        sectorPayload.date != null
          ? normalizeRankingDateKey(sectorPayload.date)
          : dateKey;
      renderSectorRankingBlock(container, sectorPayload.sector33, "sector", sectorAcquire);
      lastRankingBuiltDate = dateKey;
      const panel =
        container.closest("#rankingPanel") ||
        (typeof document !== "undefined" ? document.getElementById("rankingPanel") : null);
      const resolved =
        sectorPayload.date != null
          ? normalizeRankingDateKey(sectorPayload.date)
          : dateKey;
      updateRankingDateLabel(panel, resolved);
      return;
    }
    container.innerHTML = `
      <div style="color:#aaa;padding:10px;">
        ランキングデータが取得できませんでした
      </div>
    `;
    lastRankingBuiltDate = dateKey;
    const panel =
      container.closest("#rankingPanel") ||
      (typeof document !== "undefined" ? document.getElementById("rankingPanel") : null);
    updateRankingDateLabel(panel, dateKey);
    return;
  }

  let rendered = 0;
  for (const t of rankingTypes) {
    if (t.key === "sector") continue;
    const items = dailySectionToItems(ranking[t.key]);
    if (!items.length) continue;
    renderRanking(container, t.name, items, t.key);
    rendered++;
  }

  if (sectorPayload && Array.isArray(sectorPayload.sector33) && sectorPayload.sector33.length) {
    const sectorAcquire =
      sectorPayload.date != null
        ? normalizeRankingDateKey(sectorPayload.date)
        : dateKey;
    renderSectorRankingBlock(container, sectorPayload.sector33, "sector", sectorAcquire);
    rendered++;
  }

  if (rendered === 0) {
    container.innerHTML = `
      <div style="color:#aaa;padding:10px;">
        ランキングデータが取得できませんでした
      </div>
    `;
  }

  const resolved = ranking.date != null ? normalizeRankingDateKey(ranking.date) : dateKey;
  lastRankingBuiltDate = dateKey;
  const panel =
    container.closest("#rankingPanel") ||
    (typeof document !== "undefined" ? document.getElementById("rankingPanel") : null);
  updateRankingDateLabel(panel, resolved);
}

async function runInitRanking(body) {
  const currentDate = getDesiredRankingDate();
  const job = rankingLoadChain.then(() => initRanking(body, currentDate));
  rankingLoadChain = job.catch(() => {});
  await job;
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

export async function fetchAllStockData() {
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

async function buildPanel() {
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
  const dateRow = document.createElement("div");
  dateRow.id = "rankingAsOfDate";
  dateRow.style.cssText =
    "font-size:11px;line-height:1.45;color:#9cc3d8;margin:0 0 10px 2px;white-space:pre-line;";
  header.appendChild(dateRow);

  renderRankingNav(header, rankingTypes);
  // header を先に DOM に載せないと #rankingAsOfDate が panel 配下に無く、ラベル更新が無視される
  container.appendChild(header);
  container.appendChild(body);
  await runInitRanking(body);

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

/**
 * チャートの表示終端日（CURRENT_DATE）が変わったあと、パネル本文だけ再取得する
 */
export async function refreshRankingPanelBodyIfNeeded(force = false) {
  const panel = typeof document !== "undefined" ? document.getElementById("rankingPanel") : null;
  if (!panel) return;
  const body = panel.querySelector(".ranking-body");
  if (!body) return;
  const want = getDesiredRankingDate();
  if (!force && want === lastRankingBuiltDate) {
    updateRankingDateLabel(panel, window.__RANKING_AS_OF_DATE__ || want || null);
    return;
  }
  await runInitRanking(body);
}

export async function initRankingSystem() {
  const panel = await buildPanel();
  panel.style.display = "none";
  if (typeof window !== "undefined") {
    window.RANKING_INITIALIZED = true;
  }
}

export function preloadRankingData() {
  /* ランキングは initRanking 内の loadRankingFast（final_json 集計）で取得 */
}

export async function openRankingPanel() {
  let panel = document.getElementById("rankingPanel");
  if (!panel || !panel.querySelector(".ranking-body")) {
    const status = document.createElement("div");
    status.id = "rankingPanelLoading";
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

    await initRankingSystem();
    document.getElementById("rankingPanelLoading")?.remove();
    const built = document.getElementById("rankingPanel");
    const bodyEl = built?.querySelector(".ranking-body");
    if (!bodyEl || !bodyEl.querySelector(".ranking-block")) {
      const err = document.createElement("div");
      err.id = "rankingPanelErr";
      err.style.cssText = status.style.cssText;
      err.textContent =
        "ランキングを表示できませんでした（final_json の銘柄JSONと STOCK_LIST / list.json を確認してください）";
      document.body.appendChild(err);
      setTimeout(() => err.remove(), 4000);
      return;
    }
  }

  await refreshRankingPanelBodyIfNeeded();
  showRankingPanel();
  if (typeof window !== "undefined") {
    window.RANKING_INITIALIZED = true;
  }
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
