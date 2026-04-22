// ai_ranking/ranking_ui.js

/** ランキング行クリック → jumpToDate 用（YYYY-MM-DD に寄せる） */
function normalizeChartAnchorDate(d) {
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

function resolveRankingRowAnchorDate() {
  const r = typeof window.__RANKING_AS_OF_DATE__ === "string" ? window.__RANKING_AS_OF_DATE__.trim() : "";
  const fromRanking = r ? normalizeChartAnchorDate(r) : null;
  if (fromRanking) return fromRanking;
  const c =
    typeof window.CURRENT_DATE !== "undefined" && window.CURRENT_DATE != null
      ? String(window.CURRENT_DATE).trim()
      : "";
  return c ? normalizeChartAnchorDate(c) : null;
}

function getUnit(type) {
  switch (type) {
    case "gain":
      return "%";
    case "loss":
      return "%";
    case "volume":
      return "株";
    case "range":
      return "円";
    case "value":
      return "円";
    case "ai_prob_up":
      return "%";
    case "ai_expect":
      return "%";
    case "ai_winrate":
      return "%";
    case "nikkei_outperform":
      return "%";
    case "relative_strength":
      return "%";
    case "volatility":
      return "%";
    case "sector":
      return "%";
    case "money_flow":
      return "";
    case "crash":
      return "倍";
    case "spike":
      return "倍";
    default:
      return "";
  }
}

function getColor(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "#ffffff";
  if (n > 0) return "#ff4d4d";   // 赤（上昇）
  if (n < 0) return "#00ff66";   // 緑（下降）
  return "#ffffff";                  // 0
}

/** ランキング種別に応じた数値の色（下落率・出来高は意味に合わせ固定） */
function getRankingValueColor(value, typeKey) {
  if (typeKey === "volume") {
    return "#ffcc00"; // 出来高は黄色
  }
  if (typeKey === "loss") {
    return "#00ff66"; // 下落率は��
  }
  if (typeKey === "volatility") {
    return "#ffffff"; // ボラティリティは白
  }
  return getColor(value);
}

function formatPercentLike(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "";
  if (Math.abs(n) <= 1) return (n * 100).toFixed(2);
  return n.toFixed(2);
}

function formatValue(value, type) {
  if (value == null || value === "") return "";
  const n = Number(value);
  if (Number.isNaN(n)) return "";

  switch (type) {
    case "gain":
    case "loss":
    case "ai_prob_up":
    case "ai_expect":
    case "ai_winrate":
    case "nikkei_outperform":
    case "relative_strength":
    case "nikkei_strength":
      return formatPercentLike(n);

    case "volatility":
      return formatPercentLike(n);

    case "sector":
      return formatPercentLike(n);

    case "range":
      return n.toFixed(2);

    case "money_flow":
      if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(2) + "億円";
      if (Math.abs(n) >= 1e4) return (n / 1e4).toFixed(1) + "万円";
      return n.toFixed(0) + "円";

    case "crash":
    case "spike":
      return n.toFixed(2);

    default:
      return n.toFixed(2);
  }
}

/** 日経平均・TOPIX 等の指数コード（ランキングでは表示しない） */
const INDEX_STOCK_CODES = new Set(["1001", "1002"]);

function isIndexStockCode(code) {
  if (code == null || code === "") return false;
  return INDEX_STOCK_CODES.has(String(code).trim());
}

export function renderRankingNav(container, types) {
  const nav = document.createElement("div");
  nav.className = "ranking-nav";

  nav.style.cssText = `
    display:flex;
    flex-wrap:wrap;
    gap:6px;
    margin-bottom:10px;
  `;

  types.forEach((t) => {
    const btn = document.createElement("button");
    btn.textContent = t.name;

    btn.style.cssText = `
      background:#222;
      color:#0ff;
      border:1px solid #333;
      padding:4px 8px;
      cursor:pointer;
    `;

    btn.onclick = () => {
      const el = document.getElementById("rank_" + t.key);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    };

    nav.appendChild(btn);
  });

  container.appendChild(nav);
}

export function renderRanking(container, title, list, typeKey) {
  if (!container) return;

  const block = document.createElement("div");
  block.className = "ranking-block";
  block.id = "rank_" + (typeKey || "");

  const h = document.createElement("h3");
  h.textContent = title;
  h.style.cssText = "margin:0 0 6px 0;font-size:12px;color:#9fe8ff;";

  block.appendChild(h);

  let displayRank = 0;

  list.forEach((item) => {
    const value = item.value ?? item.score;

    if (value == null || !Number.isFinite(value)) return;

    const code = item.code || item.symbol;
    if (isIndexStockCode(code)) return;

    const codeStrKey = code != null && code !== "" ? String(code) : "";
    const fromCache = codeStrKey ? window.stockNamesCache?.[codeStrKey] : undefined;
    const fromList = codeStrKey
      ? window.STOCK_LIST?.find((s) => String(s.code || s.symbol) === codeStrKey)?.name
      : undefined;
    const fromItem = item.name != null && item.name !== "" ? String(item.name).trim() : "";

    let resolvedName = null;
    for (const raw of [fromCache, fromList, fromItem]) {
      if (raw == null || raw === "") continue;
      const n = String(raw).trim();
      if (n !== "" && n !== codeStrKey) {
        resolvedName = n;
        break;
      }
    }

    if (resolvedName == null) return;

    const displayName = `${code} ${resolvedName}`;

    const unit = getUnit(typeKey || "");
    const val = formatValue(value, typeKey || "");
    const color = getRankingValueColor(value, typeKey || "");
    const valueText = val === "" ? "" : `${val} ${unit}`.trim();

    displayRank += 1;

    const row = document.createElement("div");
    row.className = "ranking-row";
    row.style.cssText = `
      display:flex;
      align-items:center;
      gap:2px;
      height:26px;
      padding:0 4px;
      font-size:12px;
      border-bottom:1px solid #222;
      cursor:pointer;
    `;
    row.onmouseover = () => (row.style.background = "#1a1a1a");
    row.onmouseout = () => (row.style.background = "transparent");

    const codeStr = item.code != null && item.code !== "" ? String(item.code) : "";
    const nameStr = item.name != null && item.name !== "" ? String(item.name) : "";
    const sectorStr = item.sector != null && item.sector !== "" ? String(item.sector) : "";

    row.innerHTML = `
      <span style="width:24px;flex:0 0 24px;">${displayRank}</span>
      <span style="flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${displayName}</span>
      <span style="
        width:72px;
        flex:0 0 72px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
        letter-spacing:0;
      ">${nameStr}</span>
      <span style="
        width:56px;
        flex:0 0 56px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      ">${sectorStr}</span>
      <span style="
        width:68px;
        flex:0 0 68px;
        text-align:right;
        color:${color};
        font-weight:bold;
      ">${valueText}</span>
    `;

    row.onclick = () => {
      if (typeof window.loadChart !== "function" || code == null || code === "") return;
      const anchor = resolveRankingRowAnchorDate();
      if (anchor) window.loadChart(code, anchor);
      else window.loadChart(code);
    };

    block.appendChild(row);
  });

  block.style.marginBottom = "12px";
  container.appendChild(block);
}

/**
 * generated/sector/*.json の sector33 を、ima.html sectorPanel_AUTO
 * と同じ表（rank / sector / ai_score / win_rate / money_flow）で表示する。
 */
export function renderSectorRankingBlock(container, sector33, typeKey, acquireDateYmd) {
  if (!container || !Array.isArray(sector33) || sector33.length === 0) return;

  function resolveAcquireDate() {
    if (acquireDateYmd != null && String(acquireDateYmd).trim() !== "") {
      return String(acquireDateYmd).trim().slice(0, 10);
    }
    if (typeof window !== "undefined") {
      var w = window.__IMA_SECTOR_DISPLAY_DATE__;
      if (w != null && String(w).trim() !== "") return String(w).trim().slice(0, 10);
    }
    return "";
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtAiScore(n) {
    if (!Number.isFinite(n)) return "";
    const t = n.toFixed(3);
    return t.replace(/\.?0+$/, "");
  }

  const sorted = sector33
    .slice()
    .filter((s) => s && String(s.sector || "").trim() !== "")
    .sort((a, b) => {
      const ga = a.avg_gain != null ? Number(a.avg_gain) : 0;
      const gb = b.avg_gain != null ? Number(b.avg_gain) : 0;
      return gb - ga;
    });

  const block = document.createElement("div");
  block.className = "ranking-block";
  block.id = "rank_" + (typeKey || "sector");

  const header = document.createElement("div");
  header.style.cssText =
    "margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.12);padding-bottom:6px;";
  const title = document.createElement("div");
  title.textContent = "セクター分析";
  title.style.cssText = "font-weight:600;font-size:12px;color:#9fe8ff;";
  const acquire = document.createElement("div");
  const ad = resolveAcquireDate();
  acquire.textContent = "取得日付: " + (ad || "----");
  acquire.style.cssText = "font-size:10px;color:#7a9aac;margin-top:4px;";
  header.appendChild(title);
  header.appendChild(acquire);
  block.appendChild(header);

  if (sorted.length === 0) {
    const empty = document.createElement("div");
    empty.style.cssText = "opacity:0.6;padding:8px 0;";
    empty.textContent = "—";
    block.appendChild(empty);
    block.style.marginBottom = "12px";
    container.appendChild(block);
    return;
  }

  const table = document.createElement("table");
  table.style.cssText =
    "width:100%;border-collapse:collapse;font:11px/1.35 system-ui,sans-serif;";
  const thead = document.createElement("thead");
  thead.innerHTML =
    "<tr>" +
    '<th style="text-align:left;padding:2px 4px;font-weight:600;color:#ccc;">rank</th>' +
    '<th style="text-align:left;padding:2px 4px;font-weight:600;color:#ccc;">sector</th>' +
    '<th style="text-align:right;padding:2px 4px;font-weight:600;color:#ccc;">ai_score</th>' +
    '<th style="text-align:right;padding:2px 4px;font-weight:600;color:#ccc;">win_rate</th>' +
    '<th style="text-align:right;padding:2px 4px;font-weight:600;color:#ccc;">money_flow</th>' +
    "</tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  sorted.forEach((s, i) => {
    const rank = i + 1;
    const sector = s.sector != null ? String(s.sector) : "-";
    const aiN = s.avg_gain != null ? Number(s.avg_gain) : NaN;
    const ai = fmtAiScore(aiN);
    const aiColor =
      !Number.isFinite(aiN) || ai === ""
        ? "#ececf0"
        : aiN > 0
          ? "#ff4444"
          : aiN < 0
            ? "#4ade80"
            : "#9aa4b2";
    const wr =
      s.count != null && Number.isFinite(Number(s.count)) ? String(Number(s.count)) : "";
    const mfRaw = s.money_flow;
    const mf =
      mfRaw != null && mfRaw !== "" && String(mfRaw).trim() !== ""
        ? String(mfRaw)
        : "";

    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td style="padding:4px 4px;vertical-align:top;color:#ececf0;">' +
      escHtml(rank) +
      "</td>" +
      '<td style="padding:4px 4px;vertical-align:top;word-break:break-word;color:#ececf0;"></td>' +
      '<td style="padding:4px 4px;text-align:right;white-space:nowrap;color:' +
      aiColor +
      ';">' +
      escHtml(ai) +
      "</td>" +
      '<td style="padding:4px 4px;text-align:right;white-space:nowrap;color:#ececf0;">' +
      escHtml(wr) +
      "</td>" +
      '<td style="padding:4px 4px;text-align:right;white-space:nowrap;color:#ececf0;">' +
      escHtml(mf) +
      "</td>";
    const sectorTd = tr.children[1];
    sectorTd.textContent = sector;
    sectorTd.style.color = "#8ecfff";
    sectorTd.style.cursor = "pointer";
    sectorTd.style.textDecoration = "underline";
    sectorTd.style.textUnderlineOffset = "2px";
    sectorTd.title = "\u696d\u7a2e\u5185\u306e\u4e3b\u8981\u9298\u67c4\u3092\u8868\u793a";
    const leadersForRow = Array.isArray(s.leaders) ? s.leaders.slice() : [];
    sectorTd.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (typeof window.showSectorStockListPopup !== "function") return;
      window.showSectorStockListPopup(sector, leadersForRow, ad || null);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  block.appendChild(table);

  block.style.marginBottom = "12px";
  container.appendChild(block);
}
