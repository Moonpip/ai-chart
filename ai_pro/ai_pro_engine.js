// ===============================
// AI PRO エンジン（依存ファイル方式）
// ===============================
window.AI_PRO = (function () {

  function safe(v, d) {
    if (d === undefined) d = 0;
    return isNaN(v) ? d : v;
  }

  function calcMA(arr, n) {
    if (arr.length < n) return null;
    let sum = 0;
    for (let i = arr.length - n; i < arr.length; i++) {
      sum += arr[i];
    }
    return sum / n;
  }

  function calcATR(data, period) {
    if (period === undefined) period = 14;
    if (data.length < period + 1) return 0;
    let trs = [];
    for (let i = 1; i < data.length; i++) {
      const h = data[i].high;
      const l = data[i].low;
      const pc = data[i - 1].close;
      const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
      trs.push(tr);
    }
    const slice = trs.slice(-period);
    return slice.reduce(function (a, b) {
      return a + b;
    }, 0) / slice.length;
  }

  function calcRSI(data, period) {
    if (period === undefined) period = 14;
    if (data.length < period + 1) return 50;
    var gains = 0, losses = 0;
    for (var i = data.length - period; i < data.length; i++) {
      var diff = data[i].close - data[i - 1].close;
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }
    if (losses === 0) return 100;
    var rs = gains / losses;
    return 100 - (100 / (1 + rs));
  }

  function analyze(data) {

    if (!data || !Array.isArray(data) || data.length < 50) {
      return { error: true };
    }

    // o,h,l,c,v 形式にも対応
    var normalized = data.map(function (d) {
      var c = Number(d.close);
      if (isNaN(c)) c = Number(d.c) || 0;
      var h = Number(d.high);
      if (isNaN(h)) h = Number(d.h) || c;
      var l = Number(d.low);
      if (isNaN(l)) l = Number(d.l) || c;
      var v = Number(d.volume);
      if (isNaN(v) || v < 0) v = Number(d.v) || 0;
      return { high: h, low: l, close: c, volume: v };
    });

    var closes = normalized.map(function (d) {
      return d.close;
    });
    var volumes = normalized.map(function (d) {
      return d.volume || 0;
    });

    var ma5 = calcMA(closes, 5);
    var ma25 = calcMA(closes, 25);
    var ma75 = calcMA(closes, 75);

    var last = closes[closes.length - 1];

    // =========================
    // トレンド判定
    // =========================
    var trendScore = 0;
    if (ma5 > ma25) trendScore += 10;
    if (ma25 > ma75) trendScore += 10;
    if (last > ma5) trendScore += 5;

    // =========================
    // 出来高評価
    // =========================
    var avgVol = volumes.slice(-20).reduce(function (a, b) {
      return a + b;
    }, 0) / 20;
    var lastVol = volumes[volumes.length - 1];

    var volumeScore = 0;
    if (lastVol > avgVol * 1.5) volumeScore = 15;
    else if (lastVol > avgVol) volumeScore = 10;
    else volumeScore = 5;

    // =========================
    // モメンタム
    // =========================
    var rsi = calcRSI(normalized);
    var momentumScore = 0;
    if (rsi > 60) momentumScore = 10;
    if (rsi > 70) momentumScore = 15;

    // =========================
    // 過熱・乖離
    // =========================
    var atr = calcATR(normalized);
    var deviation = ma25 > 0 ? (last - ma25) / ma25 : 0;
    var deviationPct = safe(deviation * 100, 0);

    var heatPenalty = 0;
    if (deviation > 0.1) heatPenalty = -10;
    if (deviation > 0.2) heatPenalty = -20;

    // 過熱度 0-100（RSI高 + 上方向乖離 = 過熱）
    var heatLevel = 0;
    if (rsi >= 70) heatLevel += 40;
    else if (rsi >= 60) heatLevel += 25;
    else if (rsi <= 30) heatLevel -= 20;
    if (deviation > 0.15) heatLevel += 35;
    else if (deviation > 0.1) heatLevel += 25;
    else if (deviation > 0.05) heatLevel += 15;
    else if (deviation < -0.1) heatLevel -= 15;
    heatLevel = Math.max(0, Math.min(100, 50 + heatLevel));

    // トレンド状態
    var trendState = "横ばい";
    if (ma5 > ma25 && ma25 > ma75) trendState = "上昇";
    else if (ma5 < ma25 && ma25 < ma75) trendState = "下落";
    else if (ma5 > ma25) trendState = "短期上昇";
    else if (ma5 < ma25) trendState = "短期下落";

    // ブレイク率（直近20本で前日の高値/安値をブレイクした本数の割合）
    var breakCount = 0;
    var lookback = Math.min(20, normalized.length - 2);
    for (var b = 0; b < lookback; b++) {
      var idx = normalized.length - 1 - b;
      if (idx < 1) break;
      var c = normalized[idx].close;
      var prevH = normalized[idx - 1].high;
      var prevL = normalized[idx - 1].low;
      if (c > prevH || c < prevL) breakCount++;
    }
    var breakRate = lookback > 0 ? (breakCount / lookback) * 100 : 0;

    // 暴落リスク（直近20本の最大単日下落率）
    var maxDrop = 0;
    for (var c = 0; c < Math.min(20, normalized.length - 1); c++) {
      var i = normalized.length - 1 - c;
      if (i < 1) break;
      var prevClose = normalized[i - 1].close;
      var currLow = normalized[i].low;
      if (prevClose > 0) {
        var drop = ((currLow - prevClose) / prevClose) * 100;
        if (drop < maxDrop) maxDrop = drop;
      }
    }
    var crashRisk = Math.abs(maxDrop);

    // =========================
    // 合計スコア
    // =========================
    var total =
      trendScore +
      volumeScore +
      momentumScore +
      heatPenalty;

    total = Math.max(0, Math.min(100, total));

    // =========================
    // 信頼度
    // =========================
    var rank = "D";
    if (total >= 80) rank = "A";
    else if (total >= 65) rank = "B";
    else if (total >= 50) rank = "C";

    // =========================
    // 確率
    // =========================
    var upProb = Math.min(90, total);
    var downProb = Math.max(5, 100 - upProb - 10);
    var flatProb = 100 - upProb - downProb;

    // =========================
    // 未来レンジ
    // =========================
    var upper = last + atr * 2;
    var lower = last - atr * 2;
    var mid = last;

    // =========================
    // コメント生成
    // =========================
    var reasons = [];

    if (ma5 > ma25) reasons.push("短期上昇トレンド");
    if (lastVol > avgVol) reasons.push("出来高増加");
    if (rsi > 70) reasons.push("短期過熱");
    if (deviation > 0.1) reasons.push("乖離拡大");

    var volumeLabel = lastVol > avgVol * 1.5 ? "増加" : (lastVol > avgVol ? "やや増" : "通常");
    if (avgVol <= 0) volumeLabel = "—";

    return {
      total: total,
      rank: rank,
      upProb: upProb,
      downProb: downProb,
      flatProb: flatProb,
      upper: upper,
      lower: lower,
      mid: mid,
      rsi: rsi,
      atr: atr,
      reasons: reasons,
      volumeScore: volumeScore,
      volumeLabel: volumeLabel,
      heatLevel: heatLevel,
      deviationPct: deviationPct,
      trendState: trendState,
      breakRate: breakRate,
      crashRisk: crashRisk
    };
  }

  return {
    analyze: analyze
  };

})();
