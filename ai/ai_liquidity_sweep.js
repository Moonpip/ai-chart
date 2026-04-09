/* ===============================
   AI LIQUIDITY SWEEP
=============================== */

(function(){

window.detectLiquiditySweep = function(data){

  const sweeps = [];

  if (!data || data.length < 2) return sweeps;

  let avgVol = 0;

  data.forEach(d => {
    avgVol += d.volume || 0;
  });

  avgVol /= data.length;

  for (let i = 1; i < data.length; i++) {

    const prev = data[i - 1];
    const curr = data[i];

    const vol = curr.volume || 0;

    if (
      curr.high > prev.high &&
      curr.close < curr.open &&
      vol > avgVol * 1.5
    ) {

      sweeps.push({
        index: i,
        price: curr.high,
        type: "up"
      });

    }

    if (
      curr.low < prev.low &&
      curr.close > curr.open &&
      vol > avgVol * 1.5
    ) {

      sweeps.push({
        index: i,
        price: curr.low,
        type: "down"
      });

    }

  }

  return sweeps;

};

})();
