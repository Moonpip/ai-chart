/* ======================================
   AI ブレイク検出
   サポレジ水準のブレイクを検出
====================================== */

(function(){

function detectBreak(data, levels){
  if(!data || data.length < 2) return [];

  const last = data[data.length-1];
  const prev = data[data.length-2];

  const results = [];

  levels.forEach(l=>{

    if(l.type==="resistance"){
      if(prev.close <= l.price && last.close > l.price){
        results.push({type:"break_up", price:l.price});
      }
    }

    if(l.type==="support"){
      if(prev.close >= l.price && last.close < l.price){
        results.push({type:"break_down", price:l.price});
      }
    }

  });

  return results;
}

window.detectBreak = detectBreak;

})();
