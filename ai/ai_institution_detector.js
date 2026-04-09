/* ===============================
   AI INSTITUTION DETECTOR
=============================== */

(function(){

window.detectInstitutionActivity = function(data){

  if(!data || data.length < 20) return null;

  const avgVolume =
    data.reduce((s,c)=>s+(c.volume||0),0)
    / data.length;

  const signals = [];

  data.forEach((c,i)=>{

    if(c.volume > avgVolume * 3){

      signals.push({
        index:i,
        price:c.close,
        volume:c.volume
      });

    }

  });

  return signals;

};

})();
