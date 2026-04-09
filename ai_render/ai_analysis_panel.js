/**
 * TradingView風 AI分析パネル
 * チャート右側にフローティング表示、ドラッグ移動可能
 */

const STORAGE_KEY = 'aiPanelPosition';
const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];
const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function loadPosition() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      const p = JSON.parse(s);
      if (Number.isFinite(p.top) && Number.isFinite(p.left)) return p;
    }
  } catch (_) {}
  return null;
}

function savePosition(top, left) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ top, left }));
  } catch (_) {}
}

/**
 * heatmap配列をweekdayStats形式に変換（月〜金のみ）
 * @param {Array<{day:number,upRate:number}>} heatmap
 * @returns {{mon:number,tue:number,wed:number,thu:number,fri:number}}
 */
function heatmapToWeekdayStats(heatmap) {
  const map = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri' };
  const stats = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0 };
  if (!Array.isArray(heatmap)) return stats;
  heatmap.forEach((d) => {
    const key = map[d.day];
    if (key) stats[key] = Number(d?.upRate ?? 0);
  });
  return stats;
}

function computeFromHeatmap(heatmap) {
  if (!Array.isArray(heatmap) || heatmap.length === 0) {
    return {
      bestDayBuy: ['―', '―'],
      bestDaySell: ['―', '―']
    };
  }
  const filtered = heatmap.filter((d) => {
    const day = d.day;
    if (day === 0 || day === 6) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => (b.upRate ?? 0) - (a.upRate ?? 0));
  const bestDayBuy = sorted.slice(0, 2).map((d) => DAY_NAMES[d.day] ?? '―');
  const worst = [...filtered].sort((a, b) => (a.upRate ?? 0) - (b.upRate ?? 0));
  const bestDaySell = worst.slice(0, 2).map((d) => DAY_NAMES[d.day] ?? '―');
  return {
    bestDayBuy,
    bestDaySell
  };
}

function computeMonthFromDataset(dataset) {
  if (!Array.isArray(dataset) || dataset.length < 2) {
    return { bestBuy: ['―', '―'], bestSell: ['―', '―'] };
  }
  const monthStats = new Array(12).fill(0).map(() => ({ count: 0, gain: 0 }));
  for (let i = 1; i < dataset.length; i++) {
    const prev = dataset[i - 1];
    const curr = dataset[i];
    const close = Number(curr?.close ?? curr?.c);
    const prevClose = Number(prev?.close ?? prev?.c);
    if (!Number.isFinite(close) || !Number.isFinite(prevClose) || prevClose === 0) continue;
    const date = new Date(curr?.date ?? curr?.time);
    if (isNaN(date.getTime())) continue;
    const month = date.getMonth();
    const ret = (close - prevClose) / prevClose;
    monthStats[month].count++;
    monthStats[month].gain += ret;
  }
  const withAvg = monthStats.map((s, m) => ({
    month: m,
    avg: s.count > 0 ? s.gain / s.count : null,
    name: MONTH_NAMES[m]
  }));
  const valid = withAvg.filter((w) => w.avg !== null);
  const buySort = [...valid].sort((a, b) => (b.avg ?? -Infinity) - (a.avg ?? -Infinity));
  const sellSort = [...valid].sort((a, b) => (a.avg ?? Infinity) - (b.avg ?? Infinity));
  return {
    bestBuy: [buySort[0]?.name ?? '―', buySort[1]?.name ?? '―'],
    bestSell: [sellSort[0]?.name ?? '―', sellSort[1]?.name ?? '―']
  };
}

function computeMonthFromWindow() {
  const data = window.data || window.priceData || [];
  if (!Array.isArray(data) || data.length < 2) {
    return { bestBuy: ['―', '―'], bestSell: ['―', '―'] };
  }
  const byMonth = Array.from({ length: 12 }, () => ({ up: 0, down: 0 }));
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    const prevClose = Number(prev?.close);
    const currClose = Number(curr?.close);
    if (!Number.isFinite(prevClose) || !Number.isFinite(currClose)) continue;
    const d = new Date(curr.date);
    if (isNaN(d.getTime())) continue;
    const m = d.getMonth();
    if (currClose >= prevClose) byMonth[m].up++;
    else byMonth[m].down++;
  }
  const withRate = byMonth.map((d, m) => {
    const total = d.up + d.down;
    const upRate = total > 0 ? (d.up / total) * 100 : 50;
    return { month: m, upRate, name: MONTH_NAMES[m] };
  });
  const buySort = [...withRate].sort((a, b) => b.upRate - a.upRate);
  const sellSort = [...withRate].sort((a, b) => a.upRate - b.upRate);
  return {
    bestBuy: buySort.slice(0, 2).map((x) => x.name),
    bestSell: sellSort.slice(0, 2).map((x) => x.name)
  };
}

function renderWeekdayStats(stats) {
  const el = document.getElementById('weekdayStatsPanel');
  if (!el) return;

  const days = [
    { key: 'mon', label: '月' },
    { key: 'tue', label: '火' },
    { key: 'wed', label: '水' },
    { key: 'thu', label: '木' },
    { key: 'fri', label: '金' }
  ];

  let html = '';

  days.forEach((d) => {
    const value = stats?.[d.key] ?? 0;
    html += `
    <div class="weekday-row">
        <span class="weekday-name">${d.label}</span>
        <div class="weekday-bar">
            <div class="weekday-bar-fill" style="width:${value}%"></div>
        </div>
        <span class="weekday-percent">${value}%</span>
    </div>
    `;
  });

  el.innerHTML = html;
}

function bindAiPeriodInput(inputEl, dataset, symbol) {
  if (!inputEl) return;

  const applyPeriod = () => {
    const raw = String(inputEl.value || '').replace(/[^\d]/g, '');
    const v = parseInt(raw, 10);
    if (isNaN(v) || v <= 0) return;

    window.aiAnalysisPeriod = v;
    inputEl.value = String(v);

    const sourceData = Array.isArray(dataset) ? dataset : [];
    const analysisData =
      sourceData.length > v ? sourceData.slice(-v) : sourceData.slice();

    if (typeof window.runAIEngineModule === 'function') {
      window.AI = window.runAIEngineModule(analysisData);
    } else if (typeof window.runAIEngine === 'function') {
      window.AI = window.runAIEngine(analysisData);
    }

    if (typeof window.drawAIAnalysisPanel === 'function') {
      window.drawAIAnalysisPanel(window.AI, symbol, sourceData);
    }

    if (typeof window.requestAnimationFrame === 'function' && typeof window.draw === 'function') {
      requestAnimationFrame(() => window.draw());
    }
  };

  inputEl.addEventListener('input', () => {
    inputEl.value = String(inputEl.value || '').replace(/[^\d]/g, '');
  });

  inputEl.addEventListener('change', applyPeriod);
  inputEl.addEventListener('blur', applyPeriod);
  inputEl.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      applyPeriod();
      inputEl.blur();
    }
  });

  inputEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  inputEl.addEventListener('click', (e) => e.stopPropagation());
  inputEl.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
}

function setupDrag(el) {
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;
  let longPressTimer = null;
  let dragging = false;

  const onDown = (e) => {
    if (e.target && e.target.closest('#aiPeriodInput')) return;
    if (e.target && e.target.closest('input, button, select, textarea')) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    e.preventDefault();
    window.__aiDomPanelPointerActive = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = el.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      dragging = true;
    }, 400);
  };

  const onMove = (e) => {
    if (longPressTimer) return;
    if (!dragging) return;
    e.stopPropagation();
    e.preventDefault();
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let left = startLeft + dx;
    let top = startTop + dy;
    const maxL = window.innerWidth - el.offsetWidth;
    const maxT = window.innerHeight - el.offsetHeight;
    left = Math.max(0, Math.min(maxL, left));
    top = Math.max(0, Math.min(maxT, top));
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.style.right = 'auto';
    savePosition(top, left);
    startX = e.clientX;
    startY = e.clientY;
    startLeft = left;
    startTop = top;
  };

  const onUp = (e) => {
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = null;
    if (dragging && e && typeof e.stopPropagation === 'function') e.stopPropagation();
    dragging = false;
    window.__aiDomPanelPointerActive = false;
  };

  const onTouchStart = (e) => {
    if (e.target && e.target.closest('#aiPeriodInput')) return;
    if (e.target && e.target.closest('input, button, select, textarea')) return;
    e.stopPropagation();
    window.__aiDomPanelPointerActive = true;
  };

  el.addEventListener('pointerdown', onDown, { passive: false });
  el.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

/**
 * AI分析パネルを描画・更新
 * @param {{heatmap?:Array, futureZone?:object}} AI
 * @param {string} [symbol] - 銘柄コード
 * @param {Array} [dataset] - 分析対象データ（data / originalData など）
 */
export function drawAIAnalysisPanel(AI, symbol, dataset) {
  let el = document.getElementById('aiAnalysisPanel');
  if (!el) {
    el = document.createElement('div');
    el.id = 'aiAnalysisPanel';
    el.className = 'ai-analysis-panel ai-panel';
    document.body.appendChild(el);
  }
  el.classList.add('ai-analysis-panel', 'ai-panel');

  el.style.position = 'fixed';
  const pos = loadPosition();
  if (pos) {
    el.style.left = pos.left + 'px';
    el.style.top = pos.top + 'px';
    el.style.right = 'auto';
  } else {
    el.style.top = '56px';
    el.style.right = '8px';
    el.style.left = 'auto';
  }
  el.style.display = 'block';
  el.style.zIndex = '999';

  const sym = symbol || window.currentSymbol || window.stockSelect?.value || '―';
  const { bestDayBuy, bestDaySell } = computeFromHeatmap(AI?.heatmap ?? []);
  const arr = Array.isArray(dataset) ? dataset : [];
  const { bestBuy: bestMonthBuy, bestSell: bestMonthSell } = computeMonthFromDataset(arr);
  const periodVal = Math.max(10, parseInt(window.aiAnalysisPeriod, 10) || 100);

  // 分析期間入力にフォーカスがある場合は innerHTML をスキップ（キーボードが消えるのを防ぐ）
  const curInput = el.querySelector('#aiPeriodInput');
  if (curInput && document.activeElement === curInput) {
    return;
  }

  el.innerHTML = `
    <div class="ai-panel-title">分析: ${sym}</div>
    <div class="ai-panel-body">
    <div id="aiPeriodBox" class="aiPeriodRow">
      分析期間
      <input id="aiPeriodInput" type="text" inputmode="numeric" pattern="[0-9]*" value="${periodVal}">
      日
    </div>
    <div style="font-size:10px; color:#888; margin-bottom:6px;">最適タイミング</div>
    <table class="ai-panel-table">
      <tr><td class="ai-buy" style="color:#f87171">買いに最適な月</td><td>${bestMonthBuy[0] ?? '―'}</td></tr>
      <tr><td class="ai-buy" style="color:#f87171">2番目に良い買い月</td><td>${bestMonthBuy[1] ?? '―'}</td></tr>
      <tr><td class="ai-sell" style="color:#4ade80">売りに最適な月</td><td>${bestMonthSell[0] ?? '―'}</td></tr>
      <tr><td class="ai-sell" style="color:#4ade80">2番目に良い売り月</td><td>${bestMonthSell[1] ?? '―'}</td></tr>
      <tr><td class="ai-buy" style="color:#f87171">買いに良い曜日</td><td>${bestDayBuy[0] ?? '―'}</td></tr>
      <tr><td class="ai-buy" style="color:#f87171">2番目に良い買い曜日</td><td>${bestDayBuy[1] ?? '―'}</td></tr>
      <tr><td class="ai-sell" style="color:#4ade80">売りに良い曜日</td><td>${bestDaySell[0] ?? '―'}</td></tr>
      <tr><td class="ai-sell" style="color:#4ade80">2番目に良い売り曜日</td><td>${bestDaySell[1] ?? '―'}</td></tr>
    </table>
    <div class="ai-weekday-panel">
      <div class="ai-panel-title">曜日勝率</div>
      <div id="weekdayStatsPanel"></div>
    </div>
    </div>
  `;

  const inputEl = el.querySelector('#aiPeriodInput');
  bindAiPeriodInput(inputEl, arr, sym);

  const weekdayStats = heatmapToWeekdayStats(AI?.heatmap ?? []);
  renderWeekdayStats(weekdayStats);

  if (typeof window.updateSimilarityPanel === 'function') {
    window.updateSimilarityPanel(AI, arr);
  }

  if (!el.dataset.dragSetup) {
    setupDrag(el);
    el.dataset.dragSetup = '1';
  }

  const input = el.querySelector('#aiPeriodInput');
  if (input && !input.dataset.bound) {
    input.dataset.bound = '1';
    input.addEventListener('change', () => {
      const v = parseInt(input.value);
      if (isNaN(v) || v <= 0) return;
      window.aiAnalysisPeriod = v;
      if (Array.isArray(window.data)) {
        const dataset = window.data;
        const analysisData =
          dataset.length > v
            ? dataset.slice(-v)
            : dataset;

        if (typeof window.runAIEngineModule === 'function') {
          window.AI = window.runAIEngineModule(analysisData);
        }

        if (typeof window.runAIEngine === 'function') {
          window.AI = window.runAIEngine(analysisData);
        }
      }

      if (typeof window.draw === 'function') {
        window.draw();
      }
    });
  }
}

if (typeof window !== 'undefined') {
  window.drawAIAnalysisPanel = drawAIAnalysisPanel;
}

document.addEventListener('change', function (e) {
  if (!e.target) return;
  if (e.target.id !== 'aiPeriodInput') return;
  const raw = String(e.target.value || '').replace(/[^\d]/g, '');
  const v = parseInt(raw, 10);
  if (isNaN(v) || v <= 0) return;
  window.aiAnalysisPeriod = v;
  e.target.value = String(v);
  if (Array.isArray(window.data)) {
    const dataset = window.data;
    const analysisData =
      dataset.length > v ? dataset.slice(-v) : dataset.slice();
    if (typeof window.runAIEngineModule === 'function') {
      window.AI = window.runAIEngineModule(analysisData);
    }
    if (typeof window.runAIEngine === 'function') {
      window.AI = window.runAIEngine(analysisData);
    }
  }
  if (typeof window.draw === 'function') {
    window.draw();
  }
});
