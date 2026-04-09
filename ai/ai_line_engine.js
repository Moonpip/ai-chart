/**
 * AIサポートレジスタンスライン
 * スイング高値・スイング安値を算出
 */

/**
 * @param {Array} priceData - [{date,open,high,low,close,volume}]
 * @param {number} [swingLen=5] - スイング判定の左右本数
 * @returns {{resistances:Array<{price:number,index:number}>,supports:Array<{price:number,index:number}>}}
 */
export function computeLines(priceData, swingLen = 5) {
  const resistances = [];
  const supports = [];

  if (!Array.isArray(priceData) || priceData.length < swingLen * 2 + 1) {
    return { resistances, supports };
  }

  for (let i = swingLen; i < priceData.length - swingLen; i++) {
    const curr = priceData[i];
    const high = Number(curr?.high);
    const low = Number(curr?.low);
    if (!Number.isFinite(high) || !Number.isFinite(low)) continue;

    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = 1; j <= swingLen; j++) {
      const left = priceData[i - j];
      const right = priceData[i + j];
      if (Number(left?.high) >= high || Number(right?.high) >= high) isSwingHigh = false;
      if (Number(left?.low) <= low || Number(right?.low) <= low) isSwingLow = false;
    }

    if (isSwingHigh) {
      resistances.push({ price: high, index: i });
    }
    if (isSwingLow) {
      supports.push({ price: low, index: i });
    }
  }

  return {
    resistances: resistances.slice(-20),
    supports: supports.slice(-20)
  };
}
