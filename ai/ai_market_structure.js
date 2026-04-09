/* ===============================
   AI MARKET STRUCTURE
=============================== */

(function(){

window.detectMarketStructure = function(data){

  if(!data || data.length < 5) return [];

  const result = [];

  for(let i=2;i<data.length-2;i++){

    const c = data[i];

    if(
      c.high > data[i-1].high &&
      c.high > data[i-2].high &&
      c.high > data[i+1].high &&
      c.high > data[i+2].high
    ){
      result.push({index:i,type:"HH"});
    }

    if(
      c.low < data[i-1].low &&
      c.low < data[i-2].low &&
      c.low < data[i+1].low &&
      c.low < data[i+2].low
    ){
      result.push({index:i,type:"LL"});
    }

  }

  return result;

};

})();
