(function(global){
"use strict";

function normalize(arr){

  const min=Math.min(...arr);
  const max=Math.max(...arr);

  return arr.map(v=>(v-min)/(max-min));

}

function distance(a,b){

  let sum=0;

  for(let i=0;i<a.length;i++){

    sum+=Math.pow(a[i]-b[i],2);

  }

  return Math.sqrt(sum);

}

global.computeTransformerSimilarity=function(priceData,windowSize=40){

  const closes=priceData.map(d=>Number(d.close));

  const current=normalize(closes.slice(-windowSize));

  let bestScore=Infinity;
  let bestIndex=-1;

  for(let i=windowSize;i<closes.length-windowSize;i++){

    const past=normalize(closes.slice(i-windowSize,i));

    const score=distance(current,past);

    if(score<bestScore){

      bestScore=score;
      bestIndex=i;

    }

  }

  return{

    index:bestIndex,
    score:bestScore

  };

};

})(window);
