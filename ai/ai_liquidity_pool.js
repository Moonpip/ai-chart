/* ===============================
   AI LIQUIDITY POOL
=============================== */

(function(){

window.detectLiquidityPool = function(data){

  if(!data || data.length < 5) return [];

  const pools = [];

  for(let i=2;i<data.length-2;i++){

    const h1 = data[i-2].high;
    const h2 = data[i-1].high;
    const h3 = data[i].high;

    const l1 = data[i-2].low;
    const l2 = data[i-1].low;
    const l3 = data[i].low;

    const tolerance = data[i].close * 0.002;

    // 上の流動性
    if(
      Math.abs(h1-h2)<tolerance &&
      Math.abs(h2-h3)<tolerance
    ){

      pools.push({
        index:i,
        price:h3,
        type:"up"
      });

    }

    // 下の流動性
    if(
      Math.abs(l1-l2)<tolerance &&
      Math.abs(l2-l3)<tolerance
    ){

      pools.push({
        index:i,
        price:l3,
        type:"down"
      });

    }

  }

  return pools;

};

})();
