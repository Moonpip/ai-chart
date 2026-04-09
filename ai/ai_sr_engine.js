/* ======================================
   AI サポレジ統合エンジン
   サポレジ・ブレイク・出来高壁を統合
====================================== */

(function(){

function computeSR(data){
  const sr = window.detectSupportResistance(data);

  const allLevels = [
    ...(sr.supports || []).map(x=>({...x, type:"support"})),
    ...(sr.resistances || []).map(x=>({...x, type:"resistance"}))
  ];

  const breaks = window.detectBreak ? window.detectBreak(data, allLevels) : [];
  const walls = window.detectVolumeWalls ? window.detectVolumeWalls(data) : [];

  return {
    supports: sr.supports || [],
    resistances: sr.resistances || [],
    breaks,
    walls
  };
}

window.computeSR = computeSR;

})();
