(function(global){
"use strict";

function randn(){
  let u=0,v=0;
  while(u===0)u=Math.random();
  while(v===0)v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}

global.computeMonteCarloForecast=function(priceData,days=3,simulations=2000){

  if(!priceData||priceData.length<50)return null;

  const closes=priceData.map(d=>Number(d.close));
  const last=closes[closes.length-1];

  const returns=[];

  for(let i=1;i<closes.length;i++){
    returns.push((closes[i]-closes[i-1])/closes[i-1]);
  }

  const mean=returns.reduce((a,b)=>a+b,0)/returns.length;

  const variance=returns.reduce((a,b)=>a+Math.pow(b-mean,2),0)/returns.length;

  const vol=Math.sqrt(variance);

  const paths=[];

  for(let s=0;s<simulations;s++){

    let price=last;

    for(let d=0;d<days;d++){

      const shock=randn()*vol+mean;

      price=price*(1+shock);

    }

    paths.push(price);

  }

  paths.sort((a,b)=>a-b);

  const p10=paths[Math.floor(paths.length*0.1)];
  const p50=paths[Math.floor(paths.length*0.5)];
  const p90=paths[Math.floor(paths.length*0.9)];

  return{

    upper:p90,
    mid:p50,
    lower:p10,
    probability:50,
    volatility:vol*100

  };

};

})(window);
