// ai_ranking/ranking_ui.js

function getUnit(type) {
  switch (type) {
    case "gain":
      return "%";
    case "loss":
      return "%";
    case "volume":
      return "株";
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
    case "crash":
      return "倍";
    case "spike":
      return "倍";
    default:
      return "";
  }
}

function getColor(value) {
  if (value > 0) return "#ff4d4d";   // 赤（上昇）
  if (value < 0) return "#00ff66";   // 緑（下降）
  return "#ffffff";                  // 0
}

function formatValue(value, type) {
  if (value == null) return "-";

  switch (type) {
    case "gain":
    case "loss":
    case "ai_prob_up":
    case "ai_expect":
    case "ai_winrate":
    case "nikkei_outperform":
    case "relative_strength":
      return (value * 100).toFixed(2);

    case "crash":
    case "spike":
      return value.toFixed(2);

    default:
      return value.toFixed(2);
  }
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

  list.forEach((item, i) => {
    const unit = getUnit(typeKey || "");
    const val = formatValue(item.score, typeKey || "");
    const color = getColor(item.score);

    console.log("RANKING_UI_ITEM", item);

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

    row.innerHTML = `
      <span style="width:24px;flex:0 0 24px;">${i + 1}</span>
      <span style="width:48px;flex:0 0 48px;">${item.code || "-"}</span>
      <span style="
        width:130px;
        flex:0 0 130px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
        letter-spacing:0;
      ">${item.name || "-"}</span>
      <span style="
        width:60px;
        flex:0 0 60px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      ">${item.sector || "-"}</span>
      <span style="
        width:70px;
        flex:0 0 70px;
        text-align:right;
        color:${color};
        font-weight:bold;
      ">${val} ${unit}</span>
    `;

    row.onclick = () => {
      if (typeof window.loadChart === "function") {
        window.loadChart(item.code);
      }
    };

    block.appendChild(row);
  });

  block.style.marginBottom = "12px";
  container.appendChild(block);
}
