(function(global){
"use strict";

global.computeAIWinRate=function(priceData){

  if(!priceData||priceData.length<200)return null;

  let up=0;
  let total=0;

  for(let i=1;i<priceData.length;i++){

    const prev=Number(priceData[i-1].close);
    const curr=Number(priceData[i].close);

    if(curr>prev)up++;

    total++;

  }

  const winRate=(up/total)*100;

  return{

    up:winRate,
    down:100-winRate

  };

};

})(window);
