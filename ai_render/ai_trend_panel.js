// ============================================
// AI順張りパネル（トレンドフォロー・ドラッグ対応）
// ============================================

const TREND_PANEL_STORAGE_KEY = 'trendPanelPos';

function setupTrendPanelDrag(panel) {
  if (panel.__dragBound) return;
  panel.__dragBound = true;

  let longPressTimer = null;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let activePointerId = null;
  const LONG_PRESS_MS = 500;

  function savePos(left, top) {
    try {
      localStorage.setItem(TREND_PANEL_STORAGE_KEY, JSON.stringify({ left, top }));
    } catch (e) {}
  }

  function loadPos() {
    try {
      const s = localStorage.getItem(TREND_PANEL_STORAGE_KEY);
      if (s) {
        const { left, top } = JSON.parse(s);
        if (Number.isFinite(left) && Number.isFinite(top)) {
          panel.style.left = left + 'px';
          panel.style.top = top + 'px';
        }
      }
    } catch (e) {}
  }

  loadPos();

  function onDown(e) {
    if (isDragging) return;
    e.stopPropagation();
    window.__aiDomPanelPointerActive = true;
    activePointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseFloat(panel.style.left) || 10;
    startTop = parseFloat(panel.style.top) || 180;

    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      isDragging = true;
      panel.style.cursor = 'grabbing';
      try {
        panel.setPointerCapture(activePointerId);
      } catch (_) {}
    }, LONG_PRESS_MS);
  }

  function onMove(e) {
    if (!isDragging) return;
    if (e.pointerId !== activePointerId) return;
    e.stopPropagation();
    e.preventDefault();
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    panel.style.left = Math.max(0, startLeft + dx) + 'px';
    panel.style.top = Math.max(0, startTop + dy) + 'px';
  }

  function onUp(e) {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    window.__aiDomPanelPointerActive = false;
    if (isDragging) {
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      isDragging = false;
      activePointerId = null;
      panel.style.cursor = '';
      savePos(parseFloat(panel.style.left), parseFloat(panel.style.top));
    }
  }

  panel.addEventListener('pointerdown', onDown);
  document.addEventListener('pointermove', onMove, { passive: false });
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);

  panel.addEventListener(
    'touchstart',
    (e) => {
      e.stopPropagation();
      window.__aiDomPanelPointerActive = true;
    },
    { passive: true }
  );
}

window.updateTrendPanel = function (data) {
  let panel = document.getElementById('trendPanel');

  if (!data) {
    if (panel) panel.style.display = 'none';
    return;
  }

  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'trendPanel';
    panel.classList.add('ai-panel');
    const chartWrap = document.getElementById('chartWrap');
    (chartWrap || document.body).appendChild(panel);

    panel.style.position = 'absolute';
    panel.style.left = '10px';
    panel.style.top = '180px';
    panel.style.background = 'rgba(0,0,0,0.9)';
    panel.style.color = '#fff';
    panel.style.borderRadius = '12px';
    panel.style.zIndex = '9000';
    panel.style.pointerEvents = 'auto';
    panel.style.cursor = 'grab';
    panel.style.userSelect = 'none';
    panel.style.webkitUserSelect = 'none';
    panel.style.webkitTouchCallout = 'none';

    setupTrendPanelDrag(panel);
  }

  panel.style.display = 'block';

  const slopeStr =
    data.slope != null && Number.isFinite(data.slope)
      ? (data.slope >= 0 ? '+' : '') + data.slope.toFixed(2)
      : '—';

  panel.innerHTML = `
  <div class="ai-panel-title">📈 AI順張り分析</div>
  <div class="ai-panel-body">
  <b>${data.action}</b><br><br>

  状態：${data.label}<br>
  確率：${data.score}%<br><br>

  根拠：<br>
  ・傾き：${slopeStr}%<br>
  ・上昇ポイント：${data.upPoints}<br>
  ・下降ポイント：${data.downPoints}<br><br>

  👉 トレンドに沿った取引を推奨<br>
  </div>
  `;
};
