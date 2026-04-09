export function computeBreakout(priceData, lines) {
  if (!priceData || priceData.length < 20) return null;
  const last = priceData[priceData.length - 1].close;
  const res = lines?.swingHighs?.slice(-1)[0];
  const sup = lines?.swingLows?.slice(-1)[0];
  if (!res || !sup) return null;
  const range = res.price - sup.price;
  const pos = (last - sup.price) / range;
  const upProb = Math.round(pos * 100);
  const downProb = 100 - upProb;
  return {
    resistance: res.price,
    support: sup.price,
    upProb,
    downProb
  };
}
