// ============================================
// AI逆張りパネル（実用レベル・ドラッグ対応）
// ============================================

const REV_PANEL_STORAGE_KEY = 'revPanelPos';

function setupReversalPanelDrag(panel) {
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
      localStorage.setItem(REV_PANEL_STORAGE_KEY, JSON.stringify({ left, top }));
    } catch (e) {}
  }

  function loadPos() {
    try {
      const s = localStorage.getItem(REV_PANEL_STORAGE_KEY);
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
    startTop = parseFloat(panel.style.top) || 80;

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

window.updateReversalPanel = function (data) {
  let panel = document.getElementById('revPanel');

  if (!data) {
    if (panel) panel.style.display = 'none';
    return;
  }

  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'revPanel';
    panel.classList.add('ai-panel');
    document.body.appendChild(panel);

    panel.style.position = 'fixed';
    panel.style.left = '10px';
    panel.style.top = '80px';
    panel.style.background = 'rgba(0,0,0,0.9)';
    panel.style.color = '#fff';
    panel.style.borderRadius = '12px';
    panel.style.zIndex = '9000';
    panel.style.pointerEvents = 'auto';
    panel.style.cursor = 'grab';
    panel.style.userSelect = 'none';
    panel.style.webkitUserSelect = 'none';
    panel.style.webkitTouchCallout = 'none';

    setupReversalPanelDrag(panel);
  }

  panel.style.display = 'block';

  // 状態
  let stateText = '通常';
  if (data.state === 'OVERHEAT') stateText = '🟥 過熱ゾーン';
  if (data.state === 'OVERSOLD') stateText = '🟩 売られすぎ';

  // 行動判定
  let action = '様子見';
  if (data.score > 70 && data.state === 'OVERSOLD') action = '🟢 買い検討';
  if (data.score > 70 && data.state === 'OVERHEAT') action = '🔴 売り検討';

  // 勝率補正
  let winRate = data.winRate || 50;
  if (winRate === 0) winRate = 50;

  // 出来高
  const volText = data.volumeSpike ? '急増' : '通常';

  // 期待値
  const expect =
    data.meanReversion != null && Number.isFinite(data.meanReversion)
      ? data.meanReversion.toFixed(2)
      : '—';

  const dev =
    data.deviationPct != null && Number.isFinite(data.deviationPct)
      ? data.deviationPct
      : 0;
  const rsiStr =
    data.rsi != null && Number.isFinite(data.rsi) ? data.rsi.toFixed(1) : '—';

  panel.innerHTML = `
  <div class="ai-panel-title">📊 AI逆張り分析</div>
  <div class="ai-panel-body">
  <b>${action}</b><br><br>

  状態：${stateText}<br>
  確率：${data.score}%<br><br>

  根拠：<br>
  ・乖離率：${dev >= 0 ? '+' : ''}${Number(dev).toFixed(2)}%<br>
  ・RSI：${rsiStr}<br>
  ・位置：${data.position || '中間'}<br>
  ・出来高：${volText}<br><br>

  期待値：${expect}%<br><br>

  👉 平均 ${expect}%戻り<br>
  👉 成功率 ${winRate}%<br>
  </div>
  `;
};
