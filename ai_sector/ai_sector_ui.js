// ai_sector/ai_sector_ui.js — セクターボタン

window.initSectorButton = function () {
  var rankingBtn = document.querySelector("#rankingBtn");
  if (!rankingBtn) return;

  var btn = document.createElement("div");
  btn.id = "sectorBtn";
  btn.innerText = "📊 セクター";
  btn.setAttribute("role", "button");

  rankingBtn.parentNode.insertBefore(btn, rankingBtn.nextSibling);

  btn.addEventListener("click", function () {
    if (typeof window.toggleSectorPanel === "function") {
      window.toggleSectorPanel();
    }
  });
};
