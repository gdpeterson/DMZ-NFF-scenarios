console.log("[explore.js] loaded");

// --- Simple i18n state ---
let LANG = localStorage.getItem("dmz-lang") || "en";
const I18N = {
  en: {
    axes: ["Nature for Nature (A)", "Nature for Society (B)", "Nature as Culture (C)"],
    seeds: "Seeds",
    stories: "Stories",
    source: "Source"
  },
  kr: {
    axes: ["자연을 위한 자연 (A)", "사회를 위한 자연 (B)", "자연으로서의 문화 (C)"],
    seeds: "시드",
    stories: "이야기",
    source: "출처"
  }
};
function setLang(lang) {
  LANG = lang;
  localStorage.setItem("dmz-lang", LANG);
  document.getElementById("btn-en").classList.toggle("active", LANG === "en");
  document.getElementById("btn-kr").classList.toggle("active", LANG === "kr");
}

// will be set after init
let CURRENT_VISION = null;
let AXIS_LABEL_NODES = [];

window.addEventListener("DOMContentLoaded", async () => {
  // Wire language buttons
  document.getElementById("btn-en").addEventListener("click", () => {
    setLang("en"); renderAxes(); if (CURRENT_VISION) showCard(CURRENT_VISION);
  });
  document.getElementById("btn-kr").addEventListener("click", () => {
    setLang("kr"); renderAxes(); if (CURRENT_VISION) showCard(CURRENT_VISION);
  });
  setLang(LANG);

  try {
    const [visions, seeds, stories] = await Promise.all([
      fetch("data/visions.json").then(r => { if(!r.ok) throw new Error("visions.json missing"); return r.json(); }),
      fetch("data/seeds.json").then(r => { if(!r.ok) throw new Error("seeds.json missing"); return r.json(); }),
      fetch("data/stories.json").then(r => { if(!r.ok) throw new Error("stories.json missing"); return r.json(); })
    ]);

    const seedById = new Map(seeds.map(s => [s.id, s]));
    const storiesByVisionKey = stories.reduce((acc, st) => {
      (acc[st.vision_key] ||= []).push(st);
      return acc;
    }, {});

    // ---- Ternary setup ----
    const width = 520, height = 460, padding = 36;
    const side = Math.min(width, height) - 2 * padding;
    const origin = { x: padding, y: padding + 10 };
    const A = { x: 0.5 * side, y: 0 };
    const B = { x: 0, y: (Math.sqrt(3) / 2) * side };
    const C = { x: side, y: (Math.sqrt(3) / 2) * side };

    const svg = d3.select("#plot").append("svg")
      .attr("width", width)
      .attr("height", height);

    // Triangle
    svg.append("path")
      .attr("d", `M${A.x+origin.x},${A.y+origin.y} L${B.x+origin.x},${B.y+origin.y} L${C.x+origin.x},${C.y+origin.y}Z`)
      .attr("stroke", "#111").attr("fill", "none");

    // Axis labels (store nodes so we can re-render text on toggle)
    AXIS_LABEL_NODES = [
      svg.append("text").attr("x", origin.x + side*0.5).attr("y", origin.y - 6).attr("text-anchor", "middle").attr("class", "muted"),
      svg.append("text").attr("x", origin.x - 8).attr("y", origin.y + (Math.sqrt(3)/2)*side + 18).attr("text-anchor", "end").attr("class", "muted"),
      svg.append("text").attr("x", origin.x + side + 8).attr("y", origin.y + (Math.sqrt(3)/2)*side + 18).attr("text-anchor", "start").attr("class", "muted")
    ];
    function renderAxes() {
      const L = I18N[LANG].axes;
      AXIS_LABEL_NODES[0].text(L[0]);
      AXIS_LABEL_NODES[1].text(L[1]);
      AXIS_LABEL_NODES[2].text(L[2]);
    }
    renderAxes();

    // Helpers
    function baryToXY(nff) {
      const a = nff.a ?? nff.nature_for_nature ?? 0;
      const b = nff.b ?? nff.nature_for_society ?? 0;
      const c = nff.c ?? nff.nature_as_culture ?? 0;
      const s = a + b + c || 1;
      const aa = a/s, bb = b/s, cc = c/s;
      return { x: aa*A.x + bb*B.x + cc*C.x + origin.x, y: aa*A.y + bb*B.y + cc*C.y + origin.y };
    }
    function nearestVision(x, y) {
      let best=null, bestD=Infinity;
      visions
