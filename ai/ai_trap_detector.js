/* ===============================
   AI TRAP DETECTOR
=============================== */

(function(){

window.detectTrap = function(data){

  if(!data || data.length < 5) return [];

  const traps = [];

  let avgVol = 0;

  data.forEach(d => {
    avgVol += d.volume || 0;
  });

  avgVol /= data.length;

  for(let i=1;i<data.length;i++){

    const prev = data[i-1];
    const curr = data[i];

    const vol = curr.volume || 0;

    // 上ブレイク騙し
    if(
      curr.high > prev.high &&
      curr.close < curr.open &&
      vol > avgVol * 1.5
    ){

      traps.push({
        index:i,
        price:curr.high,
        type:"up"
      });

    }

    // 下ブレイク騙し
    if(
      curr.low < prev.low &&
      curr.close > curr.open &&
      vol > avgVol * 1.5
    ){

      traps.push({
        index:i,
        price:curr.low,
        type:"down"
      });

    }

  }

  return traps;

};

})();
