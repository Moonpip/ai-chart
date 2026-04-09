// ============================================
// AI Market Intelligence (AMI) Renderer
// 統合パネル・ドラッグ可能・スマホ対応
// ============================================

const AMI_PANEL_STORAGE_KEY = 'amiPanelPos';

function setupAMIPanelDrag(panel) {
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
      localStorage.setItem(AMI_PANEL_STORAGE_KEY, JSON.stringify({ left, top }));
    } catch (e) {}
  }

  function loadPos() {
    try {
      const s = localStorage.getItem(AMI_PANEL_STORAGE_KEY);
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
    startLeft = parseFloat(panel.style.left) || 20;
    startTop = parseFloat(panel.style.top) || 100;

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

  panel.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    window.__aiDomPanelPointerActive = true;
  }, { passive: true });
}

window.renderAMI = function (res) {
  if (!res || res.error) {
    const old = document.getElementById('amiPanel');
    if (old) old.style.display = 'none';
    return;
  }

  let panel = document.getElementById('amiPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'amiPanel';
    document.body.appendChild(panel);

    panel.style.position = 'fixed';
    panel.style.left = '20px';
    panel.style.top = '100px';
    panel.style.zIndex = '9000';
    panel.style.width = '220px';
    panel.style.minWidth = '160px';
    panel.style.maxWidth = '85vw';
    panel.style.padding = '10px 12px';
    panel.style.background = 'rgba(0,0,0,0.92)';
    panel.style.color = '#fff';
    panel.style.borderRadius = '10px';
    panel.style.border = '1px solid rgba(79, 227, 255, 0.3)';
    panel.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
    panel.style.pointerEvents = 'auto';
    panel.style.cursor = 'grab';
    panel.style.userSelect = 'none';
    panel.style.fontSize = '12px';
    panel.style.lineHeight = '1.5';
    panel.style.touchAction = 'none';

    setupAMIPanelDrag(panel);
  }

  const mfVal = res.mf != null ? (res.mf >= 0 ? '+' : '') + res.mf.toFixed(4) : '—';
  const scoreColor = res.score >= 70 ? '#00ff88' : res.score >= 50 ? '#00e0ff' : res.score >= 40 ? '#ffaa00' : '#ff6666';

  panel.innerHTML = `
    <div style="font-weight:bold;font-size:13px;margin-bottom:8px;color:#9fe8ff;border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:6px;">
      🧠 AI Market Intelligence
    </div>
    <div style="margin-bottom:6px;">
      <span style="color:#888">資金流入</span> ${res.flow}<br>
      <span style="font-size:10px;color:#666">値: ${mfVal}</span> 強度: ${res.strength}
    </div>
    <div style="margin-bottom:6px;">
      <span style="color:#888">相場</span> ${res.cycle}
    </div>
    <div style="margin-bottom:6px;">
      <span style="color:#888">機関</span> ${res.inst}
    </div>
    <div style="margin-top:8px;font-weight:bold;font-size:14px;color:${scoreColor};">
      AIスコア: ${res.score} (${res.rank})
    </div>
  `;

  panel.style.display = 'block';
};
