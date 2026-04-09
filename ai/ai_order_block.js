window.detectOrderBlocks = function(data){

if(!data || data.length < 5) return [];

const raw=[];

for(let i=2;i<data.length-2;i++){

const cur=data[i];
const next=data[i+1];

if(cur.close < cur.open && next.high > cur.high){

raw.push({
type:"buy",
index:i,
high:cur.high,
low:cur.low
});

}

if(cur.close > cur.open && next.low < cur.low){

raw.push({
type:"sell",
index:i,
high:cur.high,
low:cur.low
});

}

}

/* ===== OB統合 ===== */

const merged=[];

raw.forEach(ob=>{

const exist = merged.find(m =>
Math.abs(m.high-ob.high) < ob.high*0.005 &&
Math.abs(m.low-ob.low) < ob.low*0.005
);

if(!exist){

merged.push(ob);

}

});

return merged.slice(-4);

};
