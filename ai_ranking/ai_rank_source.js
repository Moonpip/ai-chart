// ai_ranking/ai_rank_source.js — 銘柄オブジェクトから既存 AI フィールドを集約

export function getAIFields(stock) {
  const ai = stock?.AI || stock?.ai || stock?.analysis || {};

  return {
    probUp:
      ai.probUp ??
      ai.upProbability ??
      ai.riseProbability ??
      ai.breakout?.up ??
      ai.breakout?.upProb ??
      ai.forecast?.up ??
      null,

    expect:
      ai.expect ??
      ai.expectedReturn ??
      ai.ev ??
      ai.expectancy ??
      null,

    winrate:
      ai.winrate ??
      ai.winRate ??
      ai.successRate ??
      ai.hitRate ??
      ai.winrateMap?.winRate ??
      null,

    similarity:
      ai.similarity ??
      ai.patternSimilarity ??
      null
  };
}
