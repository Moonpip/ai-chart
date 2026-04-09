/* ======================================
   AI 暴落検出 Pro
   強弱判定・パニック検出
====================================== */

(function(){

function detectCrashPro(data){

  if(!data || data.length < 20) return [];

  // 分析本数は呼び出し元（ima.html）で crashProAnalysisBars により制御

  const crashes = [];

  for(let i=2; i<data.length; i++){

    const d = data[i];
    const prev = data[i-1];
    const prev2 = data[i-2];

    if(!d.close || !prev.close) continue;

    const change = (d.close - prev.close) / prev.close;

    // 出来高平均
    let avgVol = 0;
    let volCount = 0;
    for(let j = Math.max(0, i-10); j < i; j++){
      if(data[j] && data[j].volume) {
        avgVol += data[j].volume;
        volCount++;
      }
    }
    avgVol = volCount > 0 ? avgVol / volCount : 0;

    const volSpike = avgVol > 0 && d.volume > avgVol * 1.5;

    // 連続下げ
    const down3 =
      prev2 && d.close < prev.close && prev.close < prev2.close;

    // 実体サイズ
    const body = Math.abs(d.close - (d.open || d.close));
    const range = (d.high || d.close) - (d.low || d.close);

    const panic = range > 0 && body > range * 0.6;

    // 判定
    if(change < -0.05 && volSpike){

      crashes.push({
        index: i,
        price: d.close,
        date: d.date,
        type: change < -0.08 ? "CRASH_STRONG" : "CRASH",
        change: (change * 100).toFixed(2)
      });

    } else if(change < -0.04 && down3 && panic){

      crashes.push({
        index: i,
        price: d.close,
        date: d.date,
        type: "CRASH_PANIC",
        change: (change * 100).toFixed(2)
      });

    }

  }

  return crashes;
}

window.detectCrashPro = detectCrashPro;

})();
