window.computeAIScore = function(){
  let score = 50; // 基準

  /* =====================
     Money Flow
  ===================== */
  if(typeof window.moneyFlow === "number"){
    if(window.moneyFlow > 0) score += 15;
    if(window.moneyFlow > 1000000) score += 10;
    if(window.moneyFlow < 0) score -= 15;
  }

  /* =====================
     Market Cycle
  ===================== */
  if(window.marketCycle === "markup") score += 15;
  if(window.marketCycle === "accumulation") score += 5;
  if(window.marketCycle === "distribution") score -= 10;
  if(window.marketCycle === "markdown") score -= 20;

  /* =====================
     Institution
  ===================== */
  if(Array.isArray(window.institutionSignals)){
    const count = window.institutionSignals.length;
    if(count > 5) score += 10;
    if(count > 10) score += 10;
  }

  /* =====================
     Order Block（簡易）
  ===================== */
  if(Array.isArray(window.orderBlocks)){
    const last = window.orderBlocks.slice(-1)[0];
    if(last){
      if(last.type === "buy") score += 10;
      if(last.type === "sell") score -= 10;
    }
  }

  /* =====================
     clamp
  ===================== */
  if(score > 100) score = 100;
  if(score < 0) score = 0;

  return score;
};
