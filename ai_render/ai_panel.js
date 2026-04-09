// ===============================
// AI PANEL
// ドラッグ移動対応
// ===============================

(function () {
  if (window.AIPanel) return;

  window.AIPanel = {
    x: 120,
    y: 120,
    w: 240,
    h: 260,
    dragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0
  };
})();

// ===============================
// PANEL DRAW
// ===============================

window.drawAIPanel = function (ctx, AI) {
  const p = window.AIPanel;
  ctx.save();

  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeStyle = '#00eaff';
  ctx.lineWidth = 1;

  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.strokeRect(p.x, p.y, p.w, p.h);

  ctx.fillStyle = '#ffffff';
  ctx.font = '14px sans-serif';

  let y = p.y + 20;
  const line = 18;

  function draw(text) {
    ctx.fillText(text, p.x + 10, y);
    y += line;
  }

  draw('AI分析');
  const t = AI.trendInfo || {};
  const trendLabel = t.slopeTrend === 'UP' ? 'UP' : t.slopeTrend === 'DOWN' ? 'DOWN' : t.slopeTrend === 'SIDE' ? 'SIDE' : (t.direction || '-');
  ctx.fillStyle = '#00ffcc';
  draw('トレンド: ' + trendLabel);
  draw('強度: ' + (t.strength ?? '0') + '%');
  if (t.breakState === 'BREAK_DOWN' || t.breakState === 'BREAK_UP') {
    ctx.fillStyle = '#ffaa00';
    draw('ライン割れ検出');
  }
  let stateText = '';
  let color = '#aaa';
  if (t.breakState === 'BREAK_DOWN') {
    stateText = 'ブレイク（弱）';
    color = '#ff6666';
  } else if (t.breakState === 'BREAK_UP') {
    stateText = 'ブレイク（強）';
    color = '#66ff66';
  } else {
    stateText = '継続';
    color = '#00ffcc';
  }
  ctx.fillStyle = color;
  draw('状態: ' + stateText);
  let nextText = '';
  if (t.breakState === 'BREAK_DOWN') {
    nextText = '横ばい or 下げ注意';
  } else if (t.breakState === 'BREAK_UP') {
    nextText = '上昇転換の可能性';
  } else {
    nextText = 'トレンド継続';
  }
  ctx.fillStyle = '#ccc';
  draw('次: ' + nextText);
  ctx.fillStyle = '#ffffff';
  if (AI.breakout) draw('ブレイク ↑' + AI.breakout.upProb + '%');
  if (AI.winrateMap) draw('勝率 ' + AI.winrateMap.winRate + '%');
  if (AI.patternFuture) draw('未来 ' + AI.patternFuture.futureAvg.toFixed(0));
  if (AI.similar && AI.similar[0]) draw('類似距離 ' + AI.similar[0].distance);
  if (AI.crash) draw('暴落リスク ' + Math.abs(AI.crash.change) + '%');

  ctx.restore();
};

// ===============================
// DRAG SYSTEM
// ===============================

window.initAIPanelDrag = function (canvas) {
  const p = window.AIPanel;

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) {
      e.stopImmediatePropagation();
      e.preventDefault();
      p.dragging = true;
      p.dragOffsetX = x - p.x;
      p.dragOffsetY = y - p.y;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!p.dragging) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    p.x = x - p.dragOffsetX;
    p.y = y - p.dragOffsetY;
  });

  canvas.addEventListener('pointerup', (e) => {
    if (p.dragging) {
      e.stopImmediatePropagation();
      p.dragging = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  });

  canvas.addEventListener('pointercancel', (e) => {
    if (p.dragging) {
      e.stopImmediatePropagation();
      p.dragging = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  });

  // スマホ：pointer と別系統の touch イベントでもチャートへ伝播させない
  function hitPanelClient(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h;
  }

  let aiPanelTouchId = null;

  canvas.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (!hitPanelClient(t.clientX, t.clientY)) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      aiPanelTouchId = t.identifier;
      p.dragging = true;
      const rect = canvas.getBoundingClientRect();
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      p.dragOffsetX = x - p.x;
      p.dragOffsetY = y - p.y;
    },
    { passive: false }
  );

  canvas.addEventListener(
    'touchmove',
    (e) => {
      if (!p.dragging || aiPanelTouchId == null) return;
      const t = Array.from(e.touches).find((x) => x.identifier === aiPanelTouchId);
      if (!t) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      p.x = x - p.dragOffsetX;
      p.y = y - p.dragOffsetY;
    },
    { passive: false }
  );

  function endAiPanelTouch(e) {
    if (aiPanelTouchId == null) return;
    const ids = e.changedTouches ? Array.from(e.changedTouches).map((x) => x.identifier) : [];
    if (!ids.includes(aiPanelTouchId)) return;
    if (p.dragging) e.stopImmediatePropagation();
    p.dragging = false;
    aiPanelTouchId = null;
  }

  canvas.addEventListener('touchend', endAiPanelTouch, { passive: false });
  canvas.addEventListener('touchcancel', endAiPanelTouch, { passive: false });
};
