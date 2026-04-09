// indicators.js
// ===============================
// AI×チャート用 インジケーター計算まとめ
// 全部「純粋計算関数」だけ。描画は ima.html 側が担当。
// candles = [{date, open, high, low, close, volume}, ...] を基本に計算。
// ===============================
(function (global) {
  "use strict";

  // -------- 共通ユーティリティ --------
  function toNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }

  function makeArray(length, fill) {
    const arr = new Array(length);
    for (let i = 0; i < length; i++) arr[i] = fill;
    return arr;
  }

  // true range 用
  function trueRange(highs, lows, closes, i) {
    if (i === 0) return highs[0] - lows[0];
    const h = highs[i];
    const l = lows[i];
    const pc = closes[i - 1];
    return Math.max(
      h - l,
      Math.abs(h - pc),
      Math.abs(l - pc)
    );
  }

  // ========= 基本系 =========
  function sma(values, period) {
    const n = values.length;
    const res = makeArray(n, null);
    if (period <= 0 || period > n) return res;

    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = toNum(values[i]);
      if (Number.isFinite(v)) sum += v;
      if (i >= period) {
        const old = toNum(values[i - period]);
        if (Number.isFinite(old)) sum -= old;
      }
      if (i >= period - 1) {
        res[i] = sum / period;
      }
    }
    return res;
  }

  function ema(values, period) {
    const n = values.length;
    const res = makeArray(n, null);
    if (period <= 0 || period > n) return res;
    const k = 2 / (period + 1);

    let emaPrev = null;
    for (let i = 0; i < n; i++) {
      const v = toNum(values[i]);
      if (!Number.isFinite(v)) {
        res[i] = emaPrev;
        continue;
      }
      if (emaPrev == null) {
        // 最初は単純移動平均で初期化
        if (i === period - 1) {
          let sum = 0;
          for (let j = 0; j < period; j++) {
            sum += toNum(values[j]) || 0;
          }
          emaPrev = sum / period;
        }
        res[i] = emaPrev;
      } else {
        emaPrev = v * k + emaPrev * (1 - k);
        res[i] = emaPrev;
      }
    }
    return res;
  }

  function wma(values, period) {
    const n = values.length;
    const res = makeArray(n, null);
    if (period <= 0 || period > n) return res;
    const denom = (period * (period + 1)) / 2;

    for (let i = period - 1; i < n; i++) {
      let sum = 0;
      let w = 1;
      for (let j = i - period + 1; j <= i; j++) {
        const v = toNum(values[j]);
        if (Number.isFinite(v)) sum += v * w;
        w++;
      }
      res[i] = sum / denom;
    }
    return res;
  }

  function dema(values, period) {
    // DEMA = 2*EMA - EMA(EMA)
    const ema1 = ema(values, period);
    const ema2 = ema(ema1.map(v => v == null ? NaN : v), period);
    const n = values.length;
    const res = makeArray(n, null);
    for (let i = 0; i < n; i++) {
      if (ema1[i] == null || ema2[i] == null) continue;
      res[i] = 2 * ema1[i] - ema2[i];
    }
    return res;
  }

  function tema(values, period) {
    // TEMA = 3*EMA1 - 3*EMA2 + EMA3
    const ema1 = ema(values, period);
    const ema2 = ema(ema1.map(v => v == null ? NaN : v), period);
    const ema3 = ema(ema2.map(v => v == null ? NaN : v), period);
    const n = values.length;
    const res = makeArray(n, null);
    for (let i = 0; i < n; i++) {
      if (ema1[i] == null || ema2[i] == null || ema3[i] == null) continue;
      res[i] = 3 * ema1[i] - 3 * ema2[i] + ema3[i];
    }
    return res;
  }

  // ========= トレンド系 =========

  // 一目均衡表
  function calcIchimoku(candles, conversionPeriod = 9, basePeriod = 26, spanBPeriod = 52, displacement = 26) {
    const n = candles.length;
    const highs = candles.map(c => toNum(c.high));
    const lows = candles.map(c => toNum(c.low));
    const res = {
      tenkan: makeArray(n, null),
      kijun: makeArray(n, null),
      senkouA: makeArray(n, null),
      senkouB: makeArray(n, null),
      chikou: makeArray(n, null)
    };

    function mid(i, period) {
      let maxH = -Infinity;
      let minL = Infinity;
      for (let j = i - period + 1; j <= i; j++) {
        if (j < 0) return null;
        const h = highs[j];
        const l = lows[j];
        if (!Number.isFinite(h) || !Number.isFinite(l)) return null;
        if (h > maxH) maxH = h;
        if (l < minL) minL = l;
      }
      return (maxH + minL) / 2;
    }

    for (let i = 0; i < n; i++) {
      const tenkan = mid(i, conversionPeriod);
      const kijun = mid(i, basePeriod);
      res.tenkan[i] = tenkan;
      res.kijun[i] = kijun;
      if (tenkan != null && kijun != null && i + displacement < n) {
        res.senkouA[i + displacement] = (tenkan + kijun) / 2;
      }
      const spanB = mid(i, spanBPeriod);
      if (spanB != null && i + displacement < n) {
        res.senkouB[i + displacement] = spanB;
      }
      if (i - displacement >= 0) {
        const c = toNum(candles[i].close);
        res.chikou[i - displacement] = Number.isFinite(c) ? c : null;
      }
    }
    return res;
  }

  // ボリンジャーバンド
  function calcBollinger(values, period = 20, multiplier = 2) {
    const n = values.length;
    const middle = sma(values, period);
    const upper = makeArray(n, null);
    const lower = makeArray(n, null);

    for (let i = 0; i < n; i++) {
      if (i < period - 1 || middle[i] == null) continue;
      let sumSq = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const v = toNum(values[j]);
        if (!Number.isFinite(v)) continue;
        const diff = v - middle[i];
        sumSq += diff * diff;
      }
      const variance = sumSq / period;
      const std = Math.sqrt(variance);
      upper[i] = middle[i] + multiplier * std;
      lower[i] = middle[i] - multiplier * std;
    }

    return { upper, middle, lower };
  }

  // MACD
  function calcMACD(values, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
    const emaShort = ema(values, shortPeriod);
    const emaLong = ema(values, longPeriod);
    const n = values.length;
    const macd = makeArray(n, null);
    for (let i = 0; i < n; i++) {
      if (emaShort[i] == null || emaLong[i] == null) continue;
      macd[i] = emaShort[i] - emaLong[i];
    }
    const signal = ema(macd.map(v => v == null ? NaN : v), signalPeriod);
    const hist = makeArray(n, null);
    for (let i = 0; i < n; i++) {
      if (macd[i] == null || signal[i] == null) continue;
      hist[i] = macd[i] - signal[i];
    }
    return { macd, signal, hist };
  }

  // ADX
  function calcADX(candles, period = 14) {
    const n = candles.length;
    const highs = candles.map(c => toNum(c.high));
    const lows = candles.map(c => toNum(c.low));
    const closes = candles.map(c => toNum(c.close));

    const trArr = makeArray(n, null);
    const plusDM = makeArray(n, null);
    const minusDM = makeArray(n, null);

    for (let i = 0; i < n; i++) {
      trArr[i] = trueRange(highs, lows, closes, i);
      if (i === 0) {
        plusDM[i] = 0;
        minusDM[i] = 0;
      } else {
        const upMove = highs[i] - highs[i - 1];
        const downMove = lows[i - 1] - lows[i];
        plusDM[i] = (upMove > downMove && upMove > 0) ? upMove : 0;
        minusDM[i] = (downMove > upMove && downMove > 0) ? downMove : 0;
      }
    }

    function smoothed(arr) {
      const res = makeArray(n, null);
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const v = arr[i];
        if (i < period) {
          sum += v;
          if (i === period - 1) {
            res[i] = sum;
          }
        } else {
          res[i] = res[i - 1] - (res[i - 1] / period) + v;
        }
      }
      return res;
    }

    const tr14 = smoothed(trArr);
    const plusDM14 = smoothed(plusDM);
    const minusDM14 = smoothed(minusDM);

    const plusDI = makeArray(n, null);
    const minusDI = makeArray(n, null);
    const dx = makeArray(n, null);
    const adx = makeArray(n, null);

    for (let i = 0; i < n; i++) {
      if (!tr14[i]) continue;
      plusDI[i] = 100 * (plusDM14[i] / tr14[i]);
      minusDI[i] = 100 * (minusDM14[i] / tr14[i]);
      const sum = plusDI[i] + minusDI[i];
      if (sum === 0) continue;
      dx[i] = 100 * Math.abs(plusDI[i] - minusDI[i]) / sum;
    }

    // ADX = DX のEMA
    const adxRaw = ema(dx.map(v => v == null ? NaN : v), period);
    for (let i = 0; i < n; i++) adx[i] = adxRaw[i];

    return { plusDI, minusDI, adx };
  }

  // Parabolic SAR（シンプル実装）
  function calcParabolicSAR(candles, step = 0.02, maxStep = 0.2) {
    const n = candles.length;
    const highs = candles.map(c => toNum(c.high));
    const lows = candles.map(c => toNum(c.low));
    const res = makeArray(n, null);
    if (n === 0) return res;

    // 初期トレンド: 最初の2本から推定
    let isUp = closesUp(candles);
    let af = step;
    let ep = isUp ? highs[0] : lows[0];
    let sar = isUp ? lows[0] : highs[0];

    function closesUp(cds) {
      if (cds.length < 2) return true;
      return cds[1].close >= cds[0].close;
    }

    for (let i = 0; i < n; i++) {
      if (i === 0) {
        res[i] = sar;
        continue;
      }
      sar = sar + af * (ep - sar);

      // 直近2本の高値・安値を超えないよう調整
      if (isUp) {
        sar = Math.min(sar, lows[i - 1], lows[Math.max(0, i - 2)]);
      } else {
        sar = Math.max(sar, highs[i - 1], highs[Math.max(0, i - 2)]);
      }

      // トレンド継続 or 反転
      if (isUp) {
        if (highs[i] > ep) {
          ep = highs[i];
          af = Math.min(af + step, maxStep);
        }
        if (lows[i] < sar) {
          // 反転
          isUp = false;
          sar = ep;
          ep = lows[i];
          af = step;
        }
      } else {
        if (lows[i] < ep) {
          ep = lows[i];
          af = Math.min(af + step, maxStep);
        }
        if (highs[i] > sar) {
          isUp = true;
          sar = ep;
          ep = highs[i];
          af = step;
        }
      }

      res[i] = sar;
    }

    return res;
  }

  // ========= オシレーター =========
  function calcRSI(values, period = 14) {
    const n = values.length;
    const res = makeArray(n, null);
    if (period <= 0 || period >= n) return res;
    let gain = 0;
    let loss = 0;

    for (let i = 1; i <= period; i++) {
      const diff = toNum(values[i]) - toNum(values[i - 1]);
      if (!Number.isFinite(diff)) continue;
      if (diff >= 0) gain += diff;
      else loss -= diff;
    }
    let avgGain = gain / period;
    let avgLoss = loss / period;

    for (let i = period + 1; i < n; i++) {
      const diff = toNum(values[i]) - toNum(values[i - 1]);
      let g = 0, l = 0;
      if (Number.isFinite(diff)) {
        if (diff >= 0) g = diff;
        else l = -diff;
      }
      avgGain = (avgGain * (period - 1) + g) / period;
      avgLoss = (avgLoss * (period - 1) + l) / period;

      if (avgLoss === 0) {
        res[i] = 100;
      } else {
        const rs = avgGain / avgLoss;
        res[i] = 100 - 100 / (1 + rs);
      }
    }
    return res;
  }

  function calcStochastic(candles, kPeriod = 14, dPeriod = 3) {
    const n = candles.length;
    const highs = candles.map(c => toNum(c.high));
    const lows = candles.map(c => toNum(c.low));
    const closes = candles.map(c => toNum(c.close));
    const k = makeArray(n, null);
    const d = makeArray(n, null);

    for (let i = 0; i < n; i++) {
      if (i < kPeriod - 1) continue;
      let highest = -Infinity;
      let lowest = Infinity;
      for (let j = i - kPeriod + 1; j <= i; j++) {
        if (highs[j] > highest) highest = highs[j];
        if (lows[j] < lowest) lowest = lows[j];
      }
      const c = closes[i];
      if (!Number.isFinite(c) || !Number.isFinite(highest) || !Number.isFinite(lowest) || highest === lowest) continue;
      k[i] = ((c - lowest) / (highest - lowest)) * 100;
    }

    const dArr = sma(k.map(v => v == null ? NaN : v), dPeriod);
    for (let i = 0; i < n; i++) d[i] = dArr[i];

    return { k, d };
  }

  function calcStochRSI(values, rsiPeriod = 14, stochPeriod = 14, dPeriod = 3) {
    const rsiVals = calcRSI(values, rsiPeriod);
    const n = values.length;
    const k = makeArray(n, null);
    const d = makeArray(n, null);

    for (let i = 0; i < n; i++) {
      if (i < stochPeriod - 1) continue;
      let hi = -Infinity;
      let lo = Infinity;
      for (let j = i - stochPeriod + 1; j <= i; j++) {
        const v = rsiVals[j];
        if (v == null) continue;
        if (v > hi) hi = v;
        if (v < lo) lo = v;
      }
      const r = rsiVals[i];
      if (r == null || hi === lo || hi === -Infinity || lo === Infinity) continue;
      k[i] = ((r - lo) / (hi - lo)) * 100;
    }

    const dArr = sma(k.map(v => v == null ? NaN : v), dPeriod);
    for (let i = 0; i < n; i++) d[i] = dArr[i];

    return { k, d, rsi: rsiVals };
  }

  function calcCCI(candles, period = 20) {
    const n = candles.length;
    const tp = candles.map(c => (toNum(c.high) + toNum(c.low) + toNum(c.close)) / 3);
    const smaTp = sma(tp, period);
    const res = makeArray(n, null);

    for (let i = period - 1; i < n; i++) {
      const ma = smaTp[i];
      if (ma == null) continue;
      let sumDev = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumDev += Math.abs(tp[j] - ma);
      }
      const md = sumDev / period;
      if (md === 0) continue;
      res[i] = (tp[i] - ma) / (0.015 * md);
    }
    return res;
  }

  function calcROC(values, period = 10) {
    const n = values.length;
    const res = makeArray(n, null);
    for (let i = period; i < n; i++) {
      const past = toNum(values[i - period]);
      const current = toNum(values[i]);
      if (!Number.isFinite(past) || !Number.isFinite(current) || past === 0) continue;
      res[i] = ((current / past) - 1) * 100;
    }
    return res;
  }

  function calcMFI(candles, period = 14) {
    const n = candles.length;
    const tp = candles.map(c => (toNum(c.high) + toNum(c.low) + toNum(c.close)) / 3);
    const vol = candles.map(c => toNum(c.volume));
    const pmf = makeArray(n, 0);
    const nmf = makeArray(n, 0);

    for (let i = 1; i < n; i++) {
      if (!Number.isFinite(tp[i]) || !Number.isFinite(tp[i - 1]) || !Number.isFinite(vol[i])) continue;
      if (tp[i] > tp[i - 1]) pmf[i] = tp[i] * vol[i];
      else if (tp[i] < tp[i - 1]) nmf[i] = tp[i] * vol[i];
    }

    const res = makeArray(n, null);
    for (let i = period; i < n; i++) {
      let pos = 0, neg = 0;
      for (let j = i - period + 1; j <= i; j++) {
        pos += pmf[j];
        neg += nmf[j];
      }
      if (neg === 0) {
        res[i] = 100;
      } else {
        const mr = pos / neg;
        res[i] = 100 - (100 / (1 + mr));
      }
    }
    return res;
  }

  function calcWilliamsR(candles, period = 14) {
    const n = candles.length;
    const highs = candles.map(c => toNum(c.high));
    const lows = candles.map(c => toNum(c.low));
    const closes = candles.map(c => toNum(c.close));
    const res = makeArray(n, null);

    for (let i = 0; i < n; i++) {
      if (i < period - 1) continue;
      let hi = -Infinity;
      let lo = Infinity;
      for (let j = i - period + 1; j <= i; j++) {
        if (highs[j] > hi) hi = highs[j];
        if (lows[j] < lo) lo = lows[j];
      }
      const c = closes[i];
      if (!Number.isFinite(c) || hi === lo || hi === -Infinity || lo === Infinity) continue;
      res[i] = ((hi - c) / (hi - lo)) * -100;
    }
    return res;
  }

  // ========= ボリューム系 =========
  function calcVWAP(candles) {
    const n = candles.length;
    const res = makeArray(n, null);
    let cumPV = 0;
    let cumVol = 0;

    for (let i = 0; i < n; i++) {
      const c = toNum(candles[i].close);
      const v = toNum(candles[i].volume);
      if (!Number.isFinite(c) || !Number.isFinite(v) || v <= 0) {
        res[i] = cumVol > 0 ? cumPV / cumVol : null;
        continue;
      }
      cumPV += c * v;
      cumVol += v;
      res[i] = cumPV / cumVol;
    }
    return res;
  }

  function calcOBV(candles) {
    const n = candles.length;
    const res = makeArray(n, null);
    let obv = 0;
    res[0] = 0;

    for (let i = 1; i < n; i++) {
      const c = toNum(candles[i].close);
      const pc = toNum(candles[i - 1].close);
      const v = toNum(candles[i].volume);
      if (!Number.isFinite(c) || !Number.isFinite(pc) || !Number.isFinite(v)) {
        res[i] = obv;
        continue;
      }
      if (c > pc) obv += v;
      else if (c < pc) obv -= v;
      res[i] = obv;
    }
    return res;
  }

  function calcVPT(candles) {
    const n = candles.length;
    const res = makeArray(n, null);
    let vpt = 0;
    res[0] = 0;

    for (let i = 1; i < n; i++) {
      const c = toNum(candles[i].close);
      const pc = toNum(candles[i - 1].close);
      const v = toNum(candles[i].volume);
      if (!Number.isFinite(c) || !Number.isFinite(pc) || !Number.isFinite(v) || pc === 0) {
        res[i] = vpt;
        continue;
      }
      vpt += v * (c - pc) / pc;
      res[i] = vpt;
    }
    return res;
  }

  function calcCMF(candles, period = 20) {
    const n = candles.length;
    const mfm = makeArray(n, 0); // money flow multiplier
    const mfv = makeArray(n, 0); // money flow volume

    for (let i = 0; i < n; i++) {
      const h = toNum(candles[i].high);
      const l = toNum(candles[i].low);
      const c = toNum(candles[i].close);
      const v = toNum(candles[i].volume);
      const denom = (h - l);
      if (!Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(v) || denom === 0) {
        mfm[i] = 0;
        mfv[i] = 0;
      } else {
        mfm[i] = ((c - l) - (h - c)) / denom;
        mfv[i] = mfm[i] * v;
      }
    }

    const res = makeArray(n, null);
    for (let i = period - 1; i < n; i++) {
      let sumMFV = 0;
      let sumVol = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumMFV += mfv[j];
        sumVol += toNum(candles[j].volume) || 0;
      }
      if (sumVol === 0) continue;
      res[i] = sumMFV / sumVol;
    }
    return res;
  }

  // ========= ボラティリティ系 =========
  function calcATR(candles, period = 14) {
    const n = candles.length;
    const highs = candles.map(c => toNum(c.high));
    const lows = candles.map(c => toNum(c.low));
    const closes = candles.map(c => toNum(c.close));
    const trArr = makeArray(n, null);

    for (let i = 0; i < n; i++) {
      trArr[i] = trueRange(highs, lows, closes, i);
    }
    // 通常はWilder平滑 (EMAに近い)
    const atr = ema(trArr.map(v => v == null ? NaN : v), period);
    return atr;
  }

  function calcATRBand(values, candles, period = 14, multiplier = 2) {
    const atr = calcATR(candles, period);
    const n = values.length;
    const upper = makeArray(n, null);
    const lower = makeArray(n, null);
    for (let i = 0; i < n; i++) {
      if (atr[i] == null || values[i] == null) continue;
      upper[i] = values[i] + multiplier * atr[i];
      lower[i] = values[i] - multiplier * atr[i];
    }
    return { atr, upper, lower };
  }

  function calcKeltnerChannel(candles, emaPeriod = 20, atrPeriod = 10, multiplier = 2) {
    const closes = candles.map(c => toNum(c.close));
    const basis = ema(closes, emaPeriod);
    const atr = calcATR(candles, atrPeriod);
    const n = candles.length;
    const upper = makeArray(n, null);
    const lower = makeArray(n, null);
    for (let i = 0; i < n; i++) {
      if (basis[i] == null || atr[i] == null) continue;
      upper[i] = basis[i] + multiplier * atr[i];
      lower[i] = basis[i] - multiplier * atr[i];
    }
    return { basis, upper, lower, atr };
  }

  // ========= その他 =========
  function calcDeviationRate(values, baseMa, asPercent = true) {
    const n = values.length;
    const res = makeArray(n, null);
    for (let i = 0; i < n; i++) {
      const p = toNum(values[i]);
      const ma = toNum(baseMa[i]);
      if (!Number.isFinite(p) || !Number.isFinite(ma) || ma === 0) continue;
      const ratio = (p - ma) / ma;
      res[i] = asPercent ? ratio * 100 : ratio;
    }
    return res;
  }

  // Pivotポイント (前日データから)
  function calcPivotPoints(candles) {
    const n = candles.length;
    const pp = makeArray(n, null);
    const r1 = makeArray(n, null);
    const r2 = makeArray(n, null);
    const s1 = makeArray(n, null);
    const s2 = makeArray(n, null);

    for (let i = 1; i < n; i++) {
      const prev = candles[i - 1];
      const h = toNum(prev.high);
      const l = toNum(prev.low);
      const c = toNum(prev.close);
      if (!Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c)) continue;
      const p = (h + l + c) / 3;
      pp[i] = p;
      r1[i] = 2 * p - l;
      s1[i] = 2 * p - h;
      r2[i] = p + (h - l);
      s2[i] = p - (h - l);
    }

    return { pp, r1, r2, s1, s2 };
  }

  // 移動平均クロス検出（ゴールデン/デッド）
  function detectMaCross(shortMa, longMa) {
    const n = shortMa.length;
    const signals = makeArray(n, null); // "golden" / "dead" / null
    for (let i = 1; i < n; i++) {
      const prevShort = shortMa[i - 1];
      const prevLong = longMa[i - 1];
      const curShort = shortMa[i];
      const curLong = longMa[i];
      if (prevShort == null || prevLong == null || curShort == null || curLong == null) continue;

      if (prevShort <= prevLong && curShort > curLong) {
        signals[i] = "golden";
      } else if (prevShort >= prevLong && curShort < curLong) {
        signals[i] = "dead";
      }
    }
    return signals;
  }

  // 期間中の高値・安値取得
  function calcHighestLowest(candles, period = 20) {
    const n = candles.length;
    const highs = candles.map(c => toNum(c.high));
    const lows = candles.map(c => toNum(c.low));
    const highest = makeArray(n, null);
    const lowest = makeArray(n, null);

    for (let i = 0; i < n; i++) {
      if (i < period - 1) continue;
      let hi = -Infinity;
      let lo = Infinity;
      for (let j = i - period + 1; j <= i; j++) {
        if (highs[j] > hi) hi = highs[j];
        if (lows[j] < lo) lo = lows[j];
      }
      highest[i] = hi;
      lowest[i] = lo;
    }
    return { highest, lowest };
  }

  // レンジブレイク判定
  function detectRangeBreakout(candles, period = 20) {
    const n = candles.length;
    const { highest, lowest } = calcHighestLowest(candles, period);
    const closes = candles.map(c => toNum(c.close));
    const signals = makeArray(n, null); // "up" / "down" / null
    for (let i = 0; i < n; i++) {
      const c = closes[i];
      if (!Number.isFinite(c) || highest[i] == null || lowest[i] == null) continue;
      if (c > highest[i]) signals[i] = "up";
      else if (c < lowest[i]) signals[i] = "down";
    }
    return { highest, lowest, signals };
  }

  // ========= エクスポート =========
  const Indicators = {
    // 基本
    sma,
    ema,
    wma,
    dema,
    tema,

    // トレンド系
    calcIchimoku,
    calcBollinger,
    calcMACD,
    calcADX,
    calcParabolicSAR,

    // オシレーター
    calcRSI,
    calcStochastic,
    calcStochRSI,
    calcCCI,
    calcROC,
    calcMFI,
    calcWilliamsR,

    // ボリューム
    calcVWAP,
    calcOBV,
    calcVPT,
    calcCMF,

    // ボラティリティ
    calcATR,
    calcATRBand,
    calcKeltnerChannel,

    // その他
    calcDeviationRate,
    calcPivotPoints,
    detectMaCross,
    calcHighestLowest,
    detectRangeBreakout
  };

  global.Indicators = Indicators;
})(this);