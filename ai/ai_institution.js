window.detectInstitution = function(data){

if(!data || data.length<10) return [];

const result=[];

for(let i=5;i<data.length;i++){

const cur=data[i];

const avgVol = data.slice(i-5,i)
  .reduce((a,b)=>a+b.volume,0)/5;

const volSpike = cur.volume > avgVol*2;

const range = cur.high - cur.low;
const body = Math.abs(cur.close - cur.open);

if(range===0) continue;

const smallMove = body < range*0.3;

if(volSpike && smallMove){

  result.push({
    index:i,
    price:cur.close
  });

}
}

return result;
};
