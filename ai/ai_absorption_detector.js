/* ===============================
   AI ABSORPTION DETECTOR
=============================== */

(function(){

window.detectAbsorption = function(data){

  if(!data || data.length < 20) return [];

  const signals = [];

  let avgVol = 0;

  for(let i=0;i<data.length;i++){
    avgVol += data[i].volume || 0;
  }

  avgVol = avgVol / data.length;

  for(let i=0;i<data.length;i++){

    const d = data[i];

    const range = Math.abs(d.high - d.low);
    const vol = d.volume || 0;

    if(vol > avgVol * 2 && range < (d.close * 0.01)){
      signals.push({
        index:i,
        price:d.close
      });
    }

  }

  return signals;

};

})();
