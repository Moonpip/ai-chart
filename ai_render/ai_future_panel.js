/**
 * AI未来予測パネル
 * AI未来価格ゾーンの数値をパネル表示、ドラッグ移動可能
 */
(function () {
  if (typeof window === 'undefined') return;

  const STORAGE_KEY = 'aiFuturePanelPosition';

  function wrapFuturePanelHtml(body) {
    return (
      '<div class="ai-panel-title">AI未来予測</div><div class="ai-panel-body">' +
      body +
      '</div>'
    );
  }

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

  function setupDrag(panel) {
    let dragTimer = null;
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    // 既存: pointer イベント
    panel.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.stopPropagation();
      window.__aiDomPanelPointerActive = true;
      dragTimer = setTimeout(() => {
        dragTimer = null;
        dragging = true;
        const rect = panel.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
      }, 400);
    }, { passive: false });

    const onMove = (e) => {
      if (!dragging) return;
      e.stopPropagation();
      e.preventDefault();
      let left = e.clientX - offsetX;
      let top = e.clientY - offsetY;
      const maxL = window.innerWidth - panel.offsetWidth;
      const maxT = window.innerHeight - panel.offsetHeight;
      left = Math.max(0, Math.min(maxL, left));
      top = Math.max(0, Math.min(maxT, top));
      panel.style.left = left + 'px';
      panel.style.top = top + 'px';
      panel.style.right = 'auto';
      savePosition(top, left);
      offsetX = e.clientX - left;
      offsetY = e.clientY - top;
    };

    const onUp = () => {
      if (dragTimer) clearTimeout(dragTimer);
      dragTimer = null;
      dragging = false;
      window.__aiDomPanelPointerActive = false;
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    // 追加: touch イベント（スマホ対応）
    function startDrag(x, y, p) {
      dragTimer = setTimeout(() => {
        dragging = true;
        const rect = p.getBoundingClientRect();
        offsetX = x - rect.left;
        offsetY = y - rect.top;
      }, 400);
    }

    function moveDrag(x, y, p) {
      if (!dragging) return;
      let left = x - offsetX;
      let top = y - offsetY;
      const maxL = window.innerWidth - p.offsetWidth;
      const maxT = window.innerHeight - p.offsetHeight;
      left = Math.max(0, Math.min(maxL, left));
      top = Math.max(0, Math.min(maxT, top));
      p.style.left = left + 'px';
      p.style.top = top + 'px';
      p.style.right = 'auto';
      savePosition(top, left);
      offsetX = x - left;
      offsetY = y - top;
    }

    function endDrag() {
      dragging = false;
      clearTimeout(dragTimer);
      dragTimer = null;
      window.__aiDomPanelPointerActive = false;
    }

    panel.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      window.__aiDomPanelPointerActive = true;
      startDrag(e.clientX, e.clientY, panel);
    });

    document.addEventListener('pointermove', (e) => {
      moveDrag(e.clientX, e.clientY, panel);
    });

    document.addEventListener('pointerup', endDrag);

    panel.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      if (t) {
        e.stopPropagation();
        window.__aiDomPanelPointerActive = true;
        startDrag(t.clientX, t.clientY, panel);
      }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (t) {
        if (dragging) {
          e.stopPropagation();
          e.preventDefault();
        }
        moveDrag(t.clientX, t.clientY, panel);
      }
    }, { passive: false });

    document.addEventListener('touchend', endDrag);
    document.addEventListener('touchcancel', endDrag);
  }

  function createPanel() {
    let panel = document.getElementById('aiFuturePanel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'aiFuturePanel';
    panel.classList.add('ai-panel');
    panel.style.position = 'fixed';
    panel.style.top = '120px';
    panel.style.right = '8px';
    panel.style.background = 'rgba(0,0,0,0.85)';
    panel.style.border = '1px solid rgba(255,255,255,0.2)';
    panel.style.fontFamily = 'monospace';
    panel.style.color = '#fff';
    panel.style.zIndex = '9000';

    document.body.appendChild(panel);

    setupDrag(panel);

    // パネル生成後に追加（スマホ・PC両対応、位置保存）
    let dragTimer = null;
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const savedX = localStorage.getItem('aiFuturePanelX');
    const savedY = localStorage.getItem('aiFuturePanelY');
    if (savedX && savedY) {
      panel.style.left = savedX;
      panel.style.top = savedY;
      panel.style.right = 'auto';
    }

    function startDrag(x, y) {
      dragTimer = setTimeout(() => {
        dragging = true;
        const rect = panel.getBoundingClientRect();
        offsetX = x - rect.left;
        offsetY = y - rect.top;
      }, 400);
    }

    function moveDrag(x, y) {
      if (!dragging) return;
      panel.style.left = (x - offsetX) + 'px';
      panel.style.top = (y - offsetY) + 'px';
      panel.style.right = 'auto';
    }

    function endDrag() {
      if (dragging) {
        localStorage.setItem('aiFuturePanelX', panel.style.left);
        localStorage.setItem('aiFuturePanelY', panel.style.top);
      }
      dragging = false;
      clearTimeout(dragTimer);
      window.__aiDomPanelPointerActive = false;
    }

    panel.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      window.__aiDomPanelPointerActive = true;
      startDrag(e.clientX, e.clientY);
    });

    document.addEventListener('pointermove', (e) => {
      moveDrag(e.clientX, e.clientY);
    });

    document.addEventListener('pointerup', endDrag);

    panel.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      if (t) {
        e.stopPropagation();
        window.__aiDomPanelPointerActive = true;
        startDrag(t.clientX, t.clientY);
      }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (t) {
        if (dragging) {
          e.stopPropagation();
          e.preventDefault();
        }
        moveDrag(t.clientX, t.clientY);
      }
    }, { passive: false });

    document.addEventListener('touchend', endDrag);
    document.addEventListener('touchcancel', endDrag);

    return panel;
  }

  function addForecastRow(day, upper, mid, lower) {
    return `${day}日 上値 ${Number(upper).toFixed(0)} 中央値 ${Number(mid).toFixed(0)} 下値 ${Number(lower).toFixed(0)}<br>`;
  }

  window.drawAIFuturePanel = function () {
    const panel = createPanel();

    const forecast = window.aiUnifiedForecast;
    const risingDays = forecast?.risingDays;
    const fallingDays = forecast?.fallingDays;

    if (!risingDays || !fallingDays || !Array.isArray(risingDays) || !Array.isArray(fallingDays)) {
      // 上昇・下降シナリオが無い場合は従来の days で表示
      const days = forecast?.days;
      if (days && Array.isArray(days) && days.length > 0) {
        let html = '';
        days.forEach((d) => {
          html += addForecastRow(d.day, d.upper, d.mid, d.lower);
        });
        if (Number.isFinite(forecast?.volatility)) {
          html += `<br>ボラ ${forecast.volatility.toFixed(0)}%`;
        }
        panel.innerHTML = wrapFuturePanelHtml(html);
        return;
      }
      panel.innerHTML = wrapFuturePanelHtml('計算中…');
      return;
    }

    const pos = loadPosition();
    if (pos) {
      panel.style.left = pos.left + 'px';
      panel.style.top = pos.top + 'px';
      panel.style.right = 'auto';
    }

    let html = '';

    html += '<span style="color:#55ff99;">▲ 上昇シナリオ（3日間）</span><br>';
    risingDays.forEach((d) => {
      html += addForecastRow(d.day, d.upper, d.mid, d.lower);
    });

    html += '<br><span style="color:#ff6b6b;">▼ 下降シナリオ（3日間）</span><br>';
    fallingDays.forEach((d) => {
      html += addForecastRow(d.day, d.upper, d.mid, d.lower);
    });

    if (Number.isFinite(forecast?.volatility)) {
      html += `<br>ボラ ${forecast.volatility.toFixed(0)}%`;
    }
    panel.innerHTML = wrapFuturePanelHtml(html);

    return;
  };

  // legacy drawAIFuturePanel with forecast param (後方互換)
  const _drawAIFuturePanelLegacy = function (forecast) {
    const panel = createPanel();

    if (!forecast) {
      panel.innerHTML = wrapFuturePanelHtml('計算中…');
      return;
    }

    const pos = loadPosition();
    if (pos) {
      panel.style.left = pos.left + 'px';
      panel.style.top = pos.top + 'px';
      panel.style.right = 'auto';
    }

    // legacy format (d1, d2, d3)
    panel.innerHTML = wrapFuturePanelHtml(`
1日<br>
上値 ${forecast.d1.upper.toFixed(0)}<br>
中央値 ${forecast.d1.mid.toFixed(0)}<br>
下値 ${forecast.d1.lower.toFixed(0)}<br><br>

2日<br>
上値 ${forecast.d2.upper.toFixed(0)}<br>
中央値 ${forecast.d2.mid.toFixed(0)}<br>
下値 ${forecast.d2.lower.toFixed(0)}<br><br>

3日<br>
上値 ${forecast.d3.upper.toFixed(0)}<br>
中央値 ${forecast.d3.mid.toFixed(0)}<br>
下値 ${forecast.d3.lower.toFixed(0)}<br><br>

確率 ${forecast.d1.probability}%<br>
ボラティリティ ${(forecast.d1.volatility * 100).toFixed(2)}%
`);
  };
})();
