export function computeTrend(priceData) {
  if (priceData.length < 50) return null;
  const closes = priceData.map((d) => d.close);
  const ma20 = closes.slice(-20).reduce((a, b) => a + b) / 20;
  const ma50 = closes.slice(-50).reduce((a, b) => a + b) / 50;
  if (ma20 > ma50) return 'UPTREND';
  if (ma20 < ma50) return 'DOWNTREND';
  return 'SIDEWAYS';
}

/**
 * トレンド強度を計算（方向と0-100%の強度）
 * @param {Array} priceData
 * @returns {{direction:string, strength:number}}
 */
export function computeTrendStrength(priceData) {
  if (!Array.isArray(priceData) || priceData.length < 50) {
    return { direction: '-', strength: 0 };
  }
  const closes = priceData.map((d) => d.close);
  const ma20 = closes.slice(-20).reduce((a, b) => a + b) / 20;
  const ma50 = closes.slice(-50).reduce((a, b) => a + b) / 50;
  const ma200 = priceData.length >= 200
    ? closes.slice(-200).reduce((a, b) => a + b) / 200
    : ma50;
  const lastClose = closes[closes.length - 1];
  const diff20_50 = ma20 - ma50;
  const range = Math.max(1e-9, Math.abs(ma50 - ma200) || ma50 * 0.01);
  const strength = Math.min(100, Math.round(Math.abs(diff20_50) / range * 50));
  if (ma20 > ma50) return { direction: '上昇', strength };
  if (ma20 < ma50) return { direction: '下降', strength };
  return { direction: '横ばい', strength: 0 };
}

const RECENT_LIMIT = 80;
const MAX_SPAN = 100;

/**
 * 2点間のラインにタッチする足数をカウント
 */
function countTouches(priceData, p1, p2, type) {
  if (p2.index <= p1.index) return 0;
  const slope = (p2.price - p1.price) / (p2.index - p1.index);
  let touches = 0;
  const basePrice = (p1.price + p2.price) / 2;
  const tolerance = Math.max(basePrice * 0.003, 0.01);
  for (let k = p1.index; k <= p2.index; k++) {
    const d = priceData[k];
    if (!d) continue;
    const expected = p1.price + slope * (k - p1.index);
    const price = type === 'up' ? Number(d?.low) : Number(d?.high);
    if (!Number.isFinite(price)) continue;
    if (Math.abs(price - expected) <= tolerance) touches++;
  }
  return touches;
}

/**
 * 直近ベースで最良トレンドラインを選択（最新点を強制使用・スコアリング）
 */
function selectBestLine(priceData, points, type) {
  if (!points || points.length < 2) return null;
  points = points.slice(-RECENT_LIMIT);
  const lastIndex = points.length - 1;
  const p2 = points[lastIndex];
  let best = null;
  let bestScore = -Infinity;

  for (let i = 0; i < lastIndex; i++) {
    const p1 = points[i];
    if (p2.index - p1.index > MAX_SPAN) continue;
    const slope = (p2.price - p1.price) / (p2.index - p1.index);
    const touches = countTouches(priceData, p1, p2, type);
    const recencyBonus = (p2.index - p1.index) * 0.01;
    const score = touches + recencyBonus - Math.abs(slope) * 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = { p1, p2, type };
    }
  }
  return best;
}

/**
 * ラインの始点を「最初の有効接触点」に再調整
 */
function refineTrendLine(line, points) {
  if (!line || !points || points.length === 0) return line;
  const dx = line.x2 - line.x1;
  if (Math.abs(dx) < 1e-9) return line;
  const slope = (line.y2 - line.y1) / dx;
  let bestStart = null;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const expected = line.y1 + slope * (p.index - line.x1);
    const diff = Math.abs(p.price - expected);
    if (diff < p.price * 0.01) {
      if (!bestStart || p.index < bestStart.index) {
        bestStart = p;
      }
    }
  }
  if (bestStart) {
    line = { ...line, x1: bestStart.index, y1: bestStart.price };
  }
  return line;
}

/**
 * サポート/レジスタンスラインからトレンド方向を判定
 */
export function detectTrend(supportLine, resistanceLine) {
  if (!supportLine) return 'NONE';
  const dx = supportLine.x2 - supportLine.x1;
  if (Math.abs(dx) < 1e-9) return 'NONE';
  const slope = (supportLine.y2 - supportLine.y1) / dx;
  if (slope > 0) return 'UP';
  if (slope < 0) return 'DOWN';
  return 'SIDE';
}

/**
 * AIトレンドライン（サポート/レジスタンス分離・直近ベース）
 * @param {Array} priceData
 * @param {Object} linesResult - computeLines の戻り値 {resistances,supports}
 * @returns {{supportLine:Object|null, resistanceLine:Object|null}}
 */
export function computeAITrendLines(priceData, linesResult) {
  if (!linesResult || priceData.length < 10) {
    return { supportLine: null, resistanceLine: null };
  }
  const lowPoints = linesResult.supports;
  const highPoints = linesResult.resistances;
  let supportLine = null;
  let resistanceLine = null;
  if (lowPoints && lowPoints.length >= 2) {
    const best = selectBestLine(priceData, lowPoints, 'up');
    if (best) {
      supportLine = refineTrendLine({
        x1: best.p1.index,
        y1: best.p1.price,
        x2: best.p2.index,
        y2: best.p2.price,
        type: 'up'
      }, lowPoints);
    }
  }
  if (highPoints && highPoints.length >= 2) {
    const best = selectBestLine(priceData, highPoints, 'down');
    if (best) {
      resistanceLine = refineTrendLine({
        x1: best.p1.index,
        y1: best.p1.price,
        x2: best.p2.index,
        y2: best.p2.price,
        type: 'down'
      }, highPoints);
    }
  }
  return { supportLine, resistanceLine };
}

/**
 * トレンドラインのブレイク検知
 * @param {Array} priceData
 * @param {Object} line - {x1,y1,x2,y2,type}
 * @returns {"BREAK_DOWN"|"BREAK_UP"|"NO_BREAK"|"NONE"}
 */
export function detectTrendBreak(priceData, line) {
  if (!line || !Array.isArray(priceData) || priceData.length < 5) return 'NONE';
  const lastIndex = priceData.length - 1;
  const last = priceData[lastIndex];
  if (!last || !Number.isFinite(last.close)) return 'NONE';
  const dx = line.x2 - line.x1;
  if (Math.abs(dx) < 1e-9) return 'NONE';
  const slope = (line.y2 - line.y1) / dx;
  const expected = line.y2 + slope * (lastIndex - line.x2);
  const diff = last.close - expected;
  if (line.type === 'up') {
    if (diff < 0) return 'BREAK_DOWN';
  }
  if (line.type === 'down') {
    if (diff > 0) return 'BREAK_UP';
  }
  return 'NO_BREAK';
}

/**
 * トレンドラインを未来方向に延長
 * @param {Object} line
 * @param {number} length - 延長するインデックス数
 * @returns {Object|null}
 */
export function extendLine(line, length = 50) {
  if (!line) return null;
  const dx = line.x2 - line.x1;
  if (Math.abs(dx) < 1e-9) return { ...line };
  const slope = (line.y2 - line.y1) / dx;
  return {
    ...line,
    x2: line.x2 + length,
    y2: line.y2 + slope * length
  };
}
