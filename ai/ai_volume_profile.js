/* ======================================
   AI 出来高壁検出
   価格帯別出来高で壁（高出来高帯）を検出
====================================== */

(function(){

function detectVolumeWalls(data){
  if(!data || data.length < 50) return [];

  const bins = {};
  const step = 50; // 価格帯

  data.forEach(d=>{
    const key = Math.floor(d.close / step) * step;
    bins[key] = (bins[key] || 0) + (d.volume || 0);
  });

  const arr = Object.keys(bins).map(k=>{
    return {price:Number(k), volume:bins[k]};
  });

  arr.sort((a,b)=>b.volume-a.volume);

  return arr.slice(0,5);
}

window.detectVolumeWalls = detectVolumeWalls;

})();
