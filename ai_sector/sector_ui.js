// ai_sector/sector_ui.js — セクター分析パネル（ランキングとは独立）

import { computeSectorStats } from "./sector_engine.js";

/** 古いキャッシュ（industry 無し）を避ける */
function sectorNeedsFreshStockData(data) {
  if (!Array.isArray(data) || data.length === 0) return true;
  if (typeof window !== "undefined") {
    const ver = window.allStockDataSchemaVersion;
    if (ver == null || Number(ver) < 2) return true;
  }
  const n = Math.min(30, data.length);
  let hasIndustryKey = 0;
  for (let i = 0; i < n; i++) {
    const s = data[i];
    if (s && Object.prototype.hasOwnProperty.call(s, "industry")) hasIndustryKey++;
  }
  return hasIndustryKey === 0;
}

function showSectorLoadingOverlay() {
  let el = document.getElementById("sectorAnalysisLoadingOverlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "sectorAnalysisLoadingOverlay";
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-busy", "true");
    el.style.cssText = `
      position:fixed;
      inset:0;
      display:flex;
      align-items:center;
      justify-content:center;
      z-index:100000;
      background:rgba(0,0,0,0.5);
      pointer-events:auto;
    `;
    const box = document.createElement("div");
    box.style.cssText = `
      background:#1a2330;
      color:#9fe8ff;
      border:1px solid #2c3b55;
      border-radius:12px;
      padding:22px 32px;
      font-size:14px;
      font-weight:600;
      box-shadow:0 8px 28px rgba(0,0,0,0.45);
      text-align:center;
      letter-spacing:0.02em;
    `;
    box.textContent = "セクター分析を読み込み中…";
    el.appendChild(box);
    document.body.appendChild(el);
  }
  el.style.display = "flex";
}

function hideSectorLoadingOverlay() {
  const el = document.getElementById("sectorAnalysisLoadingOverlay");
  if (el) {
    el.style.display = "none";
    el.setAttribute("aria-busy", "false");
  }
}

function rowStyleBase() {
  return "font-size:11px;padding:2px 0;border-bottom:1px solid #222;display:flex;justify-content:space-between;gap:6px;";
}

function sectionTitle(text) {
  const h = document.createElement("h4");
  h.textContent = text;
  h.style.cssText =
    "margin:10px 0 4px 0;font-size:12px;color:#9fe8ff;border-bottom:1px solid #333;padding-bottom:2px;";
  return h;
}

function buildRankedRows(container, sorted, limit, valueKey, pctScale) {
  sorted.slice(0, limit).forEach((s, i) => {
    const row = document.createElement("div");
    const v = s[valueKey];
    const pct = pctScale ? (v * 100).toFixed(2) + "%" : Number(v).toFixed(4);
    row.style.cssText = rowStyleBase();
    row.style.color = valueKey === "change" || valueKey === "trend"
      ? v > 0
        ? "#ff4d4d"
        : v < 0
          ? "#00ff66"
          : "#ccc"
      : "#ccc";
    row.innerHTML = `<span>${i + 1}. ${escapeHtml(s.sector)}</span><span>${pct}</span>`;
    container.appendChild(row);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getOrCreatePanelShell() {
  let panel = document.getElementById("sectorAnalysisPanel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "sectorAnalysisPanel";
    panel.style.cssText = `
      position:absolute;
      left:10px;
      top:100px;
      width:340px;
      max-height:70vh;
      overflow:auto;
      background:#111;
      color:#fff;
      padding:10px;
      z-index:9998;
      border-radius:10px;
      border:1px solid #2c3b55;
      box-shadow:0 4px 12px rgba(0,0,0,0.45);
      display:none;
    `;
    document.body.appendChild(panel);
  }
  return panel;
}

/**
 * @param {Array} allData — { history, industry, sector, name, code }[]
 */
export function initSectorPanel(allData) {
  const panel = getOrCreatePanelShell();
  panel.innerHTML = "";

  const head = document.createElement("div");
  head.style.cssText =
    "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;";
  const title = document.createElement("h3");
  title.textContent = "📊 セクター分析";
  title.style.cssText = "margin:0;font-size:14px;color:#9fe8ff;";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "閉じる";
  closeBtn.style.cssText =
    "background:#2c3b55;color:#9fe8ff;border:1px solid #3b4b6a;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer;";
  closeBtn.onclick = () => {
    panel.style.display = "none";
  };
  head.appendChild(title);
  head.appendChild(closeBtn);
  panel.appendChild(head);

  if (!Array.isArray(allData) || allData.length === 0) {
    const p = document.createElement("p");
    p.textContent = "銘柄データがありません。";
    p.style.cssText = "font-size:11px;color:#888;";
    panel.appendChild(p);
    panel.style.display = "block";
    return;
  }

  const stats = computeSectorStats(allData);
  const sub = document.createElement("div");
  sub.textContent = `${stats.length} 業種（平均値）`;
  sub.style.cssText = "font-size:10px;color:#888;margin-bottom:6px;";
  panel.appendChild(sub);

  if (stats.length === 0) {
    const p = document.createElement("p");
    p.textContent = "集計可能なセクターがありません（履歴25本以上が必要）。";
    p.style.cssText = "font-size:11px;color:#888;";
    panel.appendChild(p);
    panel.style.display = "block";
    return;
  }

  // 上昇率（前日比平均）
  panel.appendChild(sectionTitle("上昇率ランキング（前日比・平均）"));
  const upBox = document.createElement("div");
  buildRankedRows(
    upBox,
    [...(stats || [])].sort((a, b) => (b.change || 0) - (a.change || 0)),
    10,
    "change",
    true
  );
  panel.appendChild(upBox);

  // 下降率（最もマイナスが大きい順）
  panel.appendChild(sectionTitle("下降率ランキング（前日比・平均）"));
  const downBox = document.createElement("div");
  buildRankedRows(
    downBox,
    [...(stats || [])].sort((a, b) => (a.change || 0) - (b.change || 0)),
    10,
    "change",
    true
  );
  panel.appendChild(downBox);

  // トレンド（20日比平均）
  panel.appendChild(sectionTitle("トレンド強（20日騰落率・平均）"));
  const trUp = document.createElement("div");
  buildRankedRows(
    trUp,
    [...(stats || [])].sort((a, b) => (b.trend || 0) - (a.trend || 0)),
    10,
    "trend",
    true
  );
  panel.appendChild(trUp);

  panel.appendChild(sectionTitle("トレンド弱（20日騰落率・平均）"));
  const trDn = document.createElement("div");
  buildRankedRows(
    trDn,
    [...(stats || [])].sort((a, b) => (a.trend || 0) - (b.trend || 0)),
    10,
    "trend",
    true
  );
  panel.appendChild(trDn);

  // 弱さ（前日比・20日の合成が最も低い）
  panel.appendChild(sectionTitle("弱さランキング（前日比+20日の合成が低い順）"));
  const weakBox = document.createElement("div");
  buildRankedRows(
    weakBox,
    [...(stats || [])].sort((a, b) => (a.weakness || 0) - (b.weakness || 0)),
    10,
    "weakness",
    true
  );
  panel.appendChild(weakBox);

  // ヒートマップ（前日比の強さをバーで表示）
  panel.appendChild(sectionTitle("ヒートマップ（前日比平均の強さ）"));
  const heatWrap = document.createElement("div");
  heatWrap.style.cssText = "margin-top:4px;";
  const byHeat = [...(stats || [])]
    .sort((a, b) => Math.abs(b.change || 0) - Math.abs(a.change || 0));
  byHeat.forEach((s) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:6px;margin:3px 0;";
    const lab = document.createElement("span");
    lab.textContent = s.sector.length > 8 ? s.sector.slice(0, 8) + "…" : s.sector;
    lab.style.cssText =
      "flex:0 0 72px;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#aaa;";
    const bar = document.createElement("div");
    const strength = Math.min(1, Math.abs(s.change) * 20);
    bar.style.cssText = `
      flex:1;
      height:12px;
      border-radius:2px;
      overflow:hidden;
      background:linear-gradient(to right,
        ${s.change > 0 ? "#ff4d4d" : "#00ff66"} ${(strength * 100).toFixed(1)}%,
        #222 ${(strength * 100).toFixed(1)}%);
    `;
    row.appendChild(lab);
    row.appendChild(bar);
    heatWrap.appendChild(row);
  });
  panel.appendChild(heatWrap);

  if (typeof window !== "undefined" && allData && stats.length > 0) {
    console.log("📈 sectorStatsReady 発火: allData", allData?.length, "件, stats", stats?.length);
    window.dispatchEvent(
      new CustomEvent("sectorStatsReady", { detail: { allData } })
    );
  } else {
    console.warn("📈 sectorStatsReady 未発火:", { allDataLen: allData?.length, statsLen: stats?.length });
  }

  panel.style.display = "block";
}

export async function openSectorAnalysisPanel() {
  console.log("📈 openSectorAnalysisPanel: 開始");
  let loadingShown = false;
  try {
    let data = window.allStockData;
    const needFetch =
      !Array.isArray(data) ||
      data.length === 0 ||
      sectorNeedsFreshStockData(data);

    if (needFetch) {
      showSectorLoadingOverlay();
      loadingShown = true;
    }

    const mod = await import("../ai_ranking/ranking_controller.js");
    if (typeof mod.fetchAllStockData !== "function") {
      throw new Error("fetchAllStockData が利用できません");
    }
    if (needFetch) {
      console.log("SECTOR_DATA_REFRESH", {
        reason: !Array.isArray(data)
          ? "empty"
          : data.length === 0
            ? "len0"
            : "stale_or_no_industry"
      });
      data = await mod.fetchAllStockData();
      window.allStockData = data;
    }
    console.log("📈 セクター分析: データ取得完了", data?.length, "件");
    initSectorPanel(data);
  } catch (e) {
    console.error("openSectorAnalysisPanel", e);
    const panel = getOrCreatePanelShell();
    panel.innerHTML = "";
    const p = document.createElement("p");
    p.style.cssText = "color:#f66;font-size:11px;padding:8px;margin:0;";
    p.textContent =
      "セクター分析の読み込みに失敗しました。コンソールを確認するか、HTTPサーバ経由で開いているか確認してください。" +
      (e && e.message ? " (" + String(e.message) + ")" : "");
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "閉じる";
    closeBtn.style.cssText =
      "margin:8px;background:#2c3b55;color:#9fe8ff;border:1px solid #3b4b6a;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer;";
    closeBtn.onclick = () => {
      panel.style.display = "none";
    };
    panel.appendChild(p);
    panel.appendChild(closeBtn);
    panel.style.display = "block";
  } finally {
    if (loadingShown) hideSectorLoadingOverlay();
  }
}

/** ima.html の load で allStockData がある場合に表示 */
export function initSectorPanelIfData(allData) {
  if (!Array.isArray(allData) || allData.length === 0) return;
  if (sectorNeedsFreshStockData(allData)) return;
  initSectorPanel(allData);
}

/** サイドバーボタン等の配線 */
export function initSectorPanelFromWindow() {
  const btn = document.getElementById("sectorAnalysisBtn");
  if (!btn) return;
  if (btn.dataset.sectorBound === "1") return;
  btn.dataset.sectorBound = "1";
  btn.setAttribute("role", "button");
  btn.setAttribute("tabindex", "0");
  const onActivate = (ev) => {
    ev.preventDefault();
    console.log("📈 セクター分析ボタンクリック");
    openSectorAnalysisPanel();
  };
  btn.addEventListener("click", onActivate);
  btn.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") onActivate(ev);
  });
}

if (typeof window !== "undefined") {
  window.openSectorAnalysisPanel = openSectorAnalysisPanel;
}
