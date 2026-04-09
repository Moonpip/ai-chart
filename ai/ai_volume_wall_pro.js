/* ======================================
   AI 出来高壁 Pro
   ゾーン（帯）として検出
====================================== */

(function(){

function detectVolumeWallsPro(data){
  if(!data || data.length < 100) return [];

  // 描画負荷軽減
  if(data.length > 3000){
    data = data.slice(-3000);
  }

  const bins = {};
  const BIN_SIZE = 50; // 調整可能
  let maxVol = 0;

  data.forEach(d=>{
    if(!d.close || !d.volume) return;

    const key = Math.floor(d.close / BIN_SIZE) * BIN_SIZE;

    bins[key] = (bins[key] || 0) + d.volume;

    if(bins[key] > maxVol) maxVol = bins[key];

  });

  // 配列化
  let arr = Object.keys(bins).map(k=>{
    return {
      price: Number(k),
      volume: bins[k],
      strength: maxVol > 0 ? bins[k] / maxVol : 0
    };
  });

  // 強い順
  arr.sort((a,b)=>b.volume-a.volume);

  // 上位抽出
  arr = arr.slice(0, 6);

  // ゾーン化（上下幅持たせる）
  const zones = arr.map(a=>{

    return {
      low: a.price - BIN_SIZE/2,
      high: a.price + BIN_SIZE/2,
      strength: a.strength
    };

  });

  return zones;
}

window.detectVolumeWallsPro = detectVolumeWallsPro;

})();
