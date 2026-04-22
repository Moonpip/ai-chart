/**
 * AI類似チャート計算 Web Worker（安全版）
 * ロジックは ai_similarity_core.js（importScripts）
 */
importScripts("ai_similarity_core.js");

self.onmessage = function (e) {
  const payload = e.data || {};
  const priceData = Array.isArray(payload.priceData) ? payload.priceData : [];
  const config = payload.config || {};

  const result = computeSimilarityWorker(priceData, config);
  self.postMessage(result);
};

function computeSimilarityWorker(priceData, config) {
  var windowSize = Number(config.windowSize != null && config.windowSize !== "" ? config.windowSize : (config.recent != null && config.recent !== "" ? config.recent : 60));
  var futureLen = Number(config.futureLen || 20);

  if (!Array.isArray(priceData) || priceData.length < windowSize + futureLen + 1) {
    return [];
  }

  var d0 = priceData[0] && priceData[0].date ? String(priceData[0].date) : "";
  var d1 = priceData[priceData.length - 1] && priceData[priceData.length - 1].date ? String(priceData[priceData.length - 1].date) : "";
  if (d0 && d1 && d0 > d1) {
    priceData = priceData.slice().reverse();
  }

  var currentIndex = priceData.length;

  return findMostSimilar(priceData, currentIndex, windowSize, config);
}
