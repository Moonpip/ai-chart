/**
 * AI類似チャート（プロ仕様）
 * 類似計算は Web Worker (ai_similarity_worker.js) で実行。銘柄変更時のみ計算。
 *
 * ※ findSimilarPatternPro は Worker 未使用時のフォールバック用に残す（非推奨）
 */
let similarityWorker = null;
let similarityCache = {};
let _lastSimilaritySymbol = null;
let _pendingSimilarityData = {};

if (typeof window !== "undefined") {
  window.similarPatterns = window.similarPatterns || [];
  window.similarityStats = window.similarityStats || { upRate: 0, avgReturn: 0, worst: 0, best: 0 };
}

function runSimilarityWorker(symbol, priceData) {
  if (!priceData || !Array.isArray(priceData) || priceData.length < 100) {
    if (typeof window !== "undefined") {
      window.similarPatterns = [];
      if (window.AI) window.AI.similarity = [];
    }
    return;
  }

  if (similarityCache[symbol]) {
    if (typeof window !== "undefined") {
      window.similarPatterns = similarityCache[symbol];
      if (window.AI) window.AI.similarity = similarityCache[symbol];
    }
    return;
  }

  if (typeof window !== "undefined") {
    window.similarPatterns = [];
    if (window.AI) window.AI.similarity = [];
  }

  if (!similarityWorker) {
    console.log("Worker起動");
    try {
      similarityWorker = new Worker("ai/ai_similarity_worker.js");
    } catch (e) {
      console.warn("Worker作成失敗、findSimilarPatternProにフォールバック:", e);
      const fallback = window.findSimilarPatternPro(priceData);
      similarityCache[symbol] = fallback;
      if (typeof window !== "undefined") {
        window.similarPatterns = fallback;
        if (window.AI) window.AI.similarity = fallback;
      }
      return;
    }
  }

  _lastSimilaritySymbol = symbol;
  _pendingSimilarityData[symbol] = priceData;
  similarityWorker.postMessage({ symbol, priceData });

  similarityWorker.onmessage = function (e) {
    const { symbol: recvSymbol, result: raw } = e.data || {};
    const recvPriceData = _pendingSimilarityData[recvSymbol];
    if (!recvSymbol || !recvPriceData) return;
    delete _pendingSimilarityData[recvSymbol];
    if (!Array.isArray(raw) || raw.length === 0) {
      similarityCache[recvSymbol] = [];
      if (typeof window !== "undefined") {
        window.similarPatterns = [];
        if (window.AI) window.AI.similarity = [];
      }
      console.log("Worker完了");
      if (typeof window !== "undefined" && typeof window.draw === "function") {
        window.draw();
      }
      return;
    }

    const pd = recvPriceData || [];
    const baseIdx = pd.length - 2000;
    const maxScore = Math.max(...raw.map((r) => r.score), 0.001);
    const display = raw.map((r) => {
      const startIdx = baseIdx + r.index;
      const endBar = pd[startIdx + 39];
      const future = pd.slice(startIdx + 40, startIdx + 50);
      const futureReturn =
        future.length >= 10 && endBar
          ? ((future[future.length - 1].close - endBar.close) / endBar.close) *
          100
          : 0;
      const pastDate =
        endBar && endBar.date ? String(endBar.date).slice(0, 10) : "";
      const normScore = Math.max(0, 1 - r.score / maxScore);
      return {
        index: startIdx,
        score: normScore,
        similarity: Math.round((1 - r.score / maxScore) * 100),
        pastDate,
        future,
        futureReturn
      };
    });

    similarityCache[recvSymbol] = display;
    if (typeof window !== "undefined") {
      window.similarPatterns = display;
      if (window.AI) window.AI.similarity = display;
    }
    console.log("Worker完了");
    if (typeof window !== "undefined" && typeof window.draw === "function") {
      window.draw();
    }
  };
}

function onSymbolChange(symbol, priceData) {
  runSimilarityWorker(symbol, priceData);
}

if (typeof window !== "undefined") {
  window.runSimilarityWorker = runSimilarityWorker;
  window.onSymbolChange = onSymbolChange;
}

window.findSimilarPatternPro = function (data) {
  if (!data || data.length < 120) return [];

  const lookback = 30;
  const futureBars = 10;
  const results = [];

  function safeDiv(a, b) {
    return b === 0 ? 0 : a / b;
  }

  function normalize(arr) {
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    const d = max - min || 1;
    return arr.map((v) => (v - min) / d);
  }

  function ema(arr, p) {
    const k = 2 / (p + 1);
    let out = [],
      prev = arr[0];
    for (let i = 0; i < arr.length; i++) {
      prev = i === 0 ? arr[i] : arr[i] * k + prev * (1 - k);
      out.push(prev);
    }
    return out;
  }

  function rsi(close, p = 14) {
    let out = new Array(close.length).fill(50);
    for (let i = p; i < close.length; i++) {
      let up = 0,
        down = 0;
      for (let j = i - p + 1; j <= i; j++) {
        let d = close[j] - close[j - 1];
        if (d > 0) up += d;
        else down += Math.abs(d);
      }
      let rs = safeDiv(up, down || 1);
      out[i] = 100 - 100 / (1 + rs);
    }
    return out;
  }

  function macd(close) {
    let e12 = ema(close, 12);
    let e26 = ema(close, 26);
    return close.map((_, i) => e12[i] - e26[i]);
  }

  function ma(close, p = 25) {
    let out = [];
    for (let i = 0; i < close.length; i++) {
      let s = Math.max(0, i - p + 1);
      let arr = close.slice(s, i + 1);
      out.push(arr.reduce((a, b) => a + b, 0) / arr.length);
    }
    return out;
  }

  function feature(seg) {
    let c = seg.map((d) => d.close);
    let h = seg.map((d) => d.high);
    let l = seg.map((d) => d.low);
    let o = seg.map((d) => d.open);
    let v = seg.map((d) => d.volume || 0);

    let r = rsi(c);
    let m = macd(c);
    let mavg = ma(c, 25);

    let body = seg.map((d) => Math.abs(d.close - d.open));
    let range = seg.map((d) => Math.max(0.0001, d.high - d.low));

    let bodyR = body.map((x, i) => safeDiv(x, range[i]));
    let volN = normalize(v);
    let volat = range.map((x, i) => safeDiv(x, c[i] || 1));
    let dev = c.map((x, i) => safeDiv(x - mavg[i], mavg[i] || 1));

    let trend = [];
    for (let i = 1; i < seg.length; i++) {
      let ph = h[i - 1],
        pl = l[i - 1];
      let ch = h[i],
        cl = l[i];
      let code = 0;
      if (ch > ph && cl > pl) code = 1;
      else if (ch < ph && cl < pl) code = -1;
      trend.push(code);
    }
    trend.unshift(trend[0] || 0);

    return {
      c: normalize(c),
      bodyR,
      volN,
      volat,
      trend,
      r: normalize(r),
      m: normalize(m),
      dev: normalize(dev),
    };
  }

  function diff(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs((a[i] || 0) - (b[i] || 0));
    return s / a.length;
  }

  function score(f1, f2) {
    let s = 0;
    s += diff(f1.c, f2.c) * 0.2;
    s += diff(f1.bodyR, f2.bodyR) * 0.1;
    s += diff(f1.volN, f2.volN) * 0.15;
    s += diff(f1.volat, f2.volat) * 0.15;
    s += diff(f1.trend, f2.trend) * 0.2;
    s += diff(f1.r, f2.r) * 0.05;
    s += diff(f1.m, f2.m) * 0.05;
    s += diff(f1.dev, f2.dev) * 0.1;
    return s;
  }

  let current = data.slice(-lookback);
  let fcur = feature(current);

  for (let i = lookback; i < data.length - lookback - futureBars; i++) {
    let past = data.slice(i - lookback, i);
    let fp = feature(past);
    let sc = score(fcur, fp);

    let base = data[i - 1].close;
    let fut = data.slice(i, i + futureBars);
    let ret = ((fut[fut.length - 1].close - base) / base) * 100;

    const bar = data[i - 1];
    const pastDate = bar && bar.date ? String(bar.date).slice(0, 10) : "";

    results.push({
      index: i,
      score: sc,
      similarity: Math.round((1 - Math.min(sc, 1)) * 100),
      pastDate: pastDate,
      future: fut,
      futureReturn: ret,
    });
  }

  return results.sort((a, b) => a.score - b.score).slice(0, 5);
};

window.nextSimilar = function () {
  if (!window.similarPatterns || !window.similarPatterns.length) return;
  const len = window.similarPatterns.length;
  window.simIndex = ((window.simIndex || 0) + 1) % len;
  if (typeof window.draw === 'function') window.draw();
};

window.prevSimilar = function () {
  if (!window.similarPatterns || !window.similarPatterns.length) return;
  const len = window.similarPatterns.length;
  window.simIndex = ((window.simIndex || 0) - 1 + len) % len;
  if (typeof window.draw === 'function') window.draw();
};

(function initSimilarProClick() {
  function getCanvasCoords(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }
  function handleClick(e) {
    if (window._aiSimProIgnoreNextClick) {
      window._aiSimProIgnoreNextClick = false;
      return;
    }
    const canvas = document.getElementById('cv');
    if (!canvas) return;
    const { x, y } = getCanvasCoords(canvas, e);
    const prev = window._aiSimProBtnPrev;
    const next = window._aiSimProBtnNext;
    if (prev && x >= prev.x && x <= prev.x + prev.w && y >= prev.y && y <= prev.y + prev.h) {
      e.preventDefault();
      e.stopPropagation();
      window.prevSimilar();
      return;
    }
    if (next && x >= next.x && x <= next.x + next.w && y >= next.y && y <= next.y + next.h) {
      e.preventDefault();
      e.stopPropagation();
      window.nextSimilar();
      return;
    }
    const a = window._simClickArea;
    if (a && x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.jumpToDate === 'function') window.jumpToDate(a.date);
      return;
    }
  }
  function handleMouseMove(e) {
    const canvas = document.getElementById('cv');
    if (!canvas) return;
    const { x, y } = getCanvasCoords(canvas, e);
    const prev = window._aiSimProBtnPrev;
    const next = window._aiSimProBtnNext;
    const a = window._simClickArea;
    const rect = window._aiSimProPanelRect;
    const overPrev = prev && x >= prev.x && x <= prev.x + prev.w && y >= prev.y && y <= prev.y + prev.h;
    const overNext = next && x >= next.x && x <= next.x + next.w && y >= next.y && y <= next.y + next.h;
    const overDate = a && x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h;
    const overPanel = rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
    if (overPrev || overNext || overDate) canvas.style.cursor = 'pointer';
    else if (overPanel) canvas.style.cursor = 'move';
    else canvas.style.cursor = 'default';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      const cv = document.getElementById('cv');
      if (cv) {
        cv.addEventListener('click', handleClick);
        cv.addEventListener('mousemove', handleMouseMove);
      }
    });
  } else {
    const cv = document.getElementById('cv');
    if (cv) {
      cv.addEventListener('click', handleClick);
      cv.addEventListener('mousemove', handleMouseMove);
    }
  }
})();

(function () {
  if (typeof window === "undefined") return;

  window.AI = window.AI || {};

  const SIM_WORKER_STATE = {
    worker: null,
    cache: {},
    lastRequestKey: "",
    busy: false
  };

  window.similarityConfigSafe = window.similarityConfigSafe || {
    recent: 40,
    lookback: 2000,
    step: 5,
    futureLen: 20
  };

  function computeSimilarityStats(patterns) {
    if (!patterns || patterns.length === 0) {
      return {
        upRate: 0,
        avgReturn: 0,
        worst: 0,
        best: 0
      };
    }
    var up = 0;
    var total = 0;
    var worst = Infinity;
    var best = -Infinity;
    patterns.forEach(function (p) {
      var r = Number(p.futureReturn || 0);
      if (r > 0) up++;
      total += r;
      if (r < worst) worst = r;
      if (r > best) best = r;
    });
    return {
      upRate: (up / patterns.length) * 100,
      avgReturn: total / patterns.length,
      worst: worst === Infinity ? 0 : worst,
      best: best === -Infinity ? 0 : best
    };
  }

  function normalizeSimilarityResult(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function (item) {
      var sim = item.similarity ?? 0;
      return {
        index: item.index ?? 0,
        score: 1 - sim / 100,
        similarity: sim,
        pastDate: item.pastDate ?? "",
        future: Array.isArray(item.future) ? item.future : [],
        futureReturn: item.futureReturn ?? 0
      };
    });
  }

  function ensureSimilarityWorker() {
    if (SIM_WORKER_STATE.worker) return SIM_WORKER_STATE.worker;
    try {
      SIM_WORKER_STATE.worker = new Worker("ai/ai_similarity_worker.js");
      console.log("類似Worker起動");
      return SIM_WORKER_STATE.worker;
    } catch (err) {
      console.error("類似Worker生成失敗", err);
      return null;
    }
  }

  window.clearSimilarityCache = function () {
    SIM_WORKER_STATE.cache = {};
  };

  window.runSimilarityWorkerSafe = function (symbol, priceData, config) {
    try {
      window.AI = window.AI || {};

      if (!symbol || !Array.isArray(priceData) || priceData.length < 80) {
        window.similarPatterns = [];
        if (window.AI) window.AI.similarity = [];
        window.similarityStats = { upRate: 0, avgReturn: 0, worst: 0, best: 0 };
        return;
      }

      window.__similaritySymbol = symbol;
      window.__similarityPriceData = priceData;

      const finalConfig = Object.assign({}, window.similarityConfigSafe || {}, config || {});
      const cacheKey = String(symbol) + "::" + JSON.stringify(finalConfig);

      if (SIM_WORKER_STATE.cache[cacheKey]) {
        var cached = SIM_WORKER_STATE.cache[cacheKey];
        window.similarPatterns = cached;
        if (window.AI) window.AI.similarity = cached;
        window.similarityStats = computeSimilarityStats(cached);
        return;
      }

      const worker = ensureSimilarityWorker();
      if (!worker) {
        console.warn("Workerが使えないため類似チャート計算をスキップ");
        return;
      }

      SIM_WORKER_STATE.lastRequestKey = cacheKey;
      SIM_WORKER_STATE.busy = true;

      worker.onmessage = function (e) {
        try {
          var result = normalizeSimilarityResult(e.data);
          SIM_WORKER_STATE.cache[cacheKey] = result;
          var stats = computeSimilarityStats(result);
          window.similarityStats = stats;

          if (SIM_WORKER_STATE.lastRequestKey === cacheKey) {
            window.similarPatterns = result;
            if (window.AI) window.AI.similarity = result;
          }

          SIM_WORKER_STATE.busy = false;
          console.log("類似Worker完了");
          if (typeof window.draw === "function") window.draw();
        } catch (err) {
          SIM_WORKER_STATE.busy = false;
          console.error("類似Worker受信処理失敗", err);
        }
      };

      worker.onerror = function () {
        SIM_WORKER_STATE.busy = false;
        console.error("類似Workerエラー");
      };

      worker.postMessage({
        priceData: priceData,
        config: finalConfig
      });
    } catch (err) {
      console.error("runSimilarityWorkerSafe失敗", err);
    }
  };
})();
