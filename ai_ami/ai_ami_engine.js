// ============================================
// AI Market Intelligence (AMI) Engine
// 資金流入(PRO正規化)・相場サイクル・機関・AIスコアを統合
// ============================================

window.AI_AMI = (function () {
  // PRO版：正規化資金流入（銘柄・期間を超えて比較可能）
  function calcMoneyFlowPro(data) {
    if (!data || data.length < 20) return null;
    let raw = 0;
    let total = 0;
    for (let i = 1; i < data.length; i++) {
      const diff = data[i].close - data[i - 1].close;
      const vol = data[i].volume || 0;
      raw += diff * vol;
      total += data[i].close * vol;
    }
    if (total === 0) return 0;
    return raw / total;
  }

  function analyze(data) {
    if (!data || data.length < 20) return { error: true };

    const priceData = Array.isArray(data) ? data : (data.history || data.data || []);
    if (priceData.length < 20) return { error: true };

    // ① 資金流入（PRO正規化）
    const mf = calcMoneyFlowPro(priceData);
    let flow = '中立';
    if (mf != null) {
      if (mf > 0.02) flow = '強い流入';
      else if (mf > 0.01) flow = '流入';
      else if (mf > 0) flow = 'やや流入';
      else if (mf < -0.02) flow = '強い流出';
      else if (mf < -0.01) flow = '流出';
      else if (mf < 0) flow = 'やや流出';
    }

    // ② 相場サイクル（既存 detectMarketCycle 優先）
    let cycle = 'レンジ';
    if (typeof window.detectMarketCycle === 'function') {
      const mc = window.detectMarketCycle(priceData);
      const labels = {
        markup: '上昇トレンド',
        markdown: '下落トレンド',
        accumulation: '蓄積',
        distribution: '分配'
      };
      cycle = labels[mc] || mc || cycle;
    } else {
      const last = priceData[priceData.length - 1];
      const prev = priceData[priceData.length - 2];
      if (last && prev) {
        if (last.close > prev.close) cycle = '上昇局面';
        else if (last.close < prev.close) cycle = '下降局面';
      }
    }

    // ③ 機関検出（既存 detectInstitution 優先）
    let inst = '通常';
    if (typeof window.detectInstitution === 'function') {
      const sigs = window.detectInstitution(priceData);
      const recent = sigs.filter(s => s.index >= priceData.length - 10);
      if (recent.length >= 2) inst = '機関動向あり';
      else if (recent.length === 1) inst = '機関シグナル';
      else {
        const last = priceData[priceData.length - 1];
        const prev = priceData[priceData.length - 2];
        const vol = last?.volume || 0;
        const prevVol = prev?.volume || 0;
        if (prevVol > 0) {
          if (vol > prevVol * 2) inst = '機関買い';
          else if (vol < prevVol * 0.5) inst = '機関売り';
        }
      }
    } else {
      const last = priceData[priceData.length - 1];
      const prev = priceData[priceData.length - 2];
      const vol = last?.volume || 0;
      const prevVol = prev?.volume || 0;
      if (prevVol > 0) {
        if (vol > prevVol * 2) inst = '機関買い';
        else if (vol < prevVol * 0.5) inst = '機関売り';
      }
    }

    // ④ スコア（PRO資金流入連動 + 既存 computeAIScore 併用）
    let score = 50;
    if (mf != null) {
      if (mf > 0.02) score += 25;
      else if (mf > 0.01) score += 15;
      else if (mf > 0) score += 5;
      else if (mf < -0.02) score -= 25;
      else if (mf < -0.01) score -= 15;
      else if (mf < 0) score -= 5;
    }
    if (typeof window.computeAIScore === 'function') {
      const existingScore = window.computeAIScore();
      score = Math.round((score + existingScore) / 2);
    }
    score = Math.max(0, Math.min(100, score));

    let rank = 'D';
    if (score >= 80) rank = 'A';
    else if (score >= 65) rank = 'B';
    else if (score >= 50) rank = 'C';

    // 強度（★）
    let strength = '★☆☆☆☆';
    if (mf != null && mf > 0) {
      if (mf > 0.02) strength = '★★★★★';
      else if (mf > 0.01) strength = '★★★★☆';
      else if (mf > 0.005) strength = '★★★☆☆';
      else strength = '★★☆☆☆';
    } else if (mf != null && mf < 0) {
      if (mf < -0.02) strength = '▼▼▼▼▼';
      else if (mf < -0.01) strength = '▼▼▼▼☆';
      else if (mf < -0.005) strength = '▼▼▼☆☆';
      else strength = '▼▼☆☆☆';
    }

    return {
      mf: mf != null ? mf : 0,
      flow,
      cycle,
      inst,
      score,
      rank,
      strength
    };
  }

  return {
    analyze,
    calcMoneyFlowPro
  };
})();
