window.computeMoneyFlow = function(data){
if(!data || data.length<2) return 0;

let flow=0;

for(let i=1;i<data.length;i++){
const prev=data[i-1];
const cur=data[i];

const diff = cur.close - prev.close;
flow += diff * cur.volume;

}

return flow;
};
