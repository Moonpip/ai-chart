window.detectMarketCycle = function(data){

if(!data || data.length<20) return "unknown";

const recent = data.slice(-20);

const start = recent[0].close;
const end = recent[recent.length-1].close;

const change = (end-start)/start;

if(change > 0.05) return "markup";
if(change < -0.05) return "markdown";

const highs = recent.map(d=>d.high);
const lows = recent.map(d=>d.low);

const maxHigh = Math.max(...highs);
const minLow = Math.min(...lows);

if((maxHigh-minLow)/minLow < 0.05){
return "accumulation";
}

return "distribution";
};
