console.log("[explore.js v9] loaded");

// --- i18n ---
let LANG = localStorage.getItem("dmz-lang") || "en";
const I18N = {
  en: { axes: ["Nature for Nature (A)", "Nature for Society (B)", "Nature as Culture (C)"], seeds: "Seeds", stories: "Stories", source: "Source", legend:"Scenarios" },
  kr: { axes: ["자연을 위한 자연 (A)", "사회를 위한 자연 (B)", "자연으로서의 문화 (C)"], seeds: "시드", stories: "이야기", source: "출처", legend:"시나리오" }
};

let CURRENT_VISION = null;
let AXIS_LABEL_NODES = [];
let SHOW_CARD = () => {};

function renderAxes(){
  if (AXIS_LABEL_NODES.length !== 3) return;
  const L = I18N[LANG].axes;
  AXIS_LABEL_NODES[0].text(L[0]);
  AXIS_LABEL_NODES[1].text(L[1]);
  AXIS_LABEL_NODES[2].text(L[2]);
}

function setLang(lang){
  LANG = lang;
  localStorage.setItem("dmz-lang", LANG);
  document.getElementById("btn-en")?.classList.toggle("active", LANG === "en");
  document.getElementById("btn-kr")?.classList.toggle("active", LANG === "kr");
  renderAxes();
  if (CURRENT_VISION) SHOW_CARD(CURRENT_VISION);
  // update legend title if present
  d3.select("#legend-title").text(I18N[LANG].legend);
}

window.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("btn-en")?.addEventListener("click", () => setLang("en"));
  document.getElementById("btn-kr")?.addEventListener("click", () => setLang("kr"));

  // --- Canvas ---
  const width = 640, height = 520, padding = 48;
  const side = Math.min(width, height) - 2 * padding;
  const origin = { x: padding, y: padding + 10 };
  const A = { x: 0.5 * side, y: 0 };
  const B = { x: 0, y: (Math.sqrt(3) / 2) * side };
  const C = { x: side, y: (Math.sqrt(3) / 2) * side };

  const svg = d3.select("#plot").append("svg")
    .attr("width", width)
    .attr("height", height);

  // light background
  svg.append("rect").attr("x",0).attr("y",0).attr("width",width).attr("height",height)
    .attr("fill","#fff");

  // triangle face (subtle fill)
  svg.append("path")
    .attr("d", `M${A.x+origin.x},${A.y+origin.y} L${B.x+origin.x},${B.y+origin.y} L${C.x+origin.x},${C.y+origin.y}Z`)
    .attr("fill","#f8fafc")
    .attr("stroke","#0f172a")
    .attr("stroke-width",1.5)
    .style("filter","drop-shadow(0 6px 14px rgba(15,23,42,.08))")
    .style("pointer-events","all");

  // subtle edge ticks at 20/40/60/80% along each side
  const tickPercents = [0.2, 0.4, 0.6, 0.8];
  const edges = [
    { from:A, to:B }, // AC side labels are set below; ticks just aesthetic
    { from:B, to:C },
    { from:C, to:A }
  ];
  const tickLen = 6;
  edges.forEach(e => {
    tickPercents.forEach(p => {
      const x = (1-p)*e.from.x + p*e.to.x;
      const y = (1-p)*e.from.y + p*e.to.y;
      // perpendicular tiny tick
      const nx = y, ny = -x; // rough normal; we’ll just offset vertically for simplicity
      svg.append("line")
        .attr("x1", x+origin.x).attr("y1", y+origin.y - tickLen/2)
        .attr("x2", x+origin.x).attr("y2", y+origin.y + tickLen/2)
        .attr("stroke","#cbd5e1").attr("stroke-width",1).attr("opacity",0.8);
    });
  });

  // axis labels
  AXIS_LABEL_NODES = [
    svg.append("text").attr("x", origin.x + side*0.5).attr("y", origin.y - 10).attr("text-anchor","middle").attr("class","axis"),
    svg.append("text").attr("x", origin.x - 10).attr("y", origin.y + (Math.sqrt(3)/2)*side + 24).attr("text-anchor","end").attr("class","axis"),
    svg.append("text").attr("x", origin.x + side + 10).attr("y", origin.y + (Math.sqrt(3)/2)*side + 24).attr("text-anchor","start").attr("class","axis")
  ];
  renderAxes();

  // transparent click catcher
  const clickCatcher = svg.append("rect")
    .attr("x", 0).attr("y", 0).attr("width", width).attr("height", height)
    .attr("fill", "transparent").style("pointer-events", "all");

  // cursor
  const cursor = svg.append("circle")
    .attr("r", 11).attr("stroke","#0f172a").attr("stroke-width",1.5)
    .attr("fill","#fff")
    .attr("cx", origin.x + side*0.5)
    .attr("cy", origin.y + (Math.sqrt(3)/4)*side);

  // --- Data ---
  let visions=[], seeds=[], stories=[];
  try {
    const vResp = await fetch("data/visions.json"); if(!vResp.ok) throw new Error(`visions.json missing (${vResp.status})`);
    visions = await vResp.json();
  } catch (e) {
    document.getElementById("scenario-card").innerHTML = `<strong>Load error:</strong> ${e.message}`;
    return;
  }
  try { const s = await fetch("data/seeds.json"); if(s.ok) seeds = await s.json(); } catch {}
  try { const t = await fetch("data/stories.json"); if(t.ok) stories = await t.json(); } catch {}

  const seedById = new Map(seeds.map(s => [s.id, s]));
  const storiesByVisionKey = stories.reduce((acc, st) => ((acc[st.vision_key] ||= []).push(st), acc), {});

  // palette (distinct scenario colors)
  const palette = d3.scaleOrdinal()
    .domain(visions.map(v => v.title_key || v.title_en || v.id))
    .range(["#2563eb","#059669","#f59e0b","#e11d48","#7c3aed"]); // blue, green, amber, rose, violet

  // helpers
  function baryToXY(nff){
    const a = nff.a ?? nff.nature_for_nature ?? 0;
    const b = nff.b ?? nff.nature_for_society ?? 0;
    const c = nff.c ?? nff.nature_as_culture ?? 0;
    const s = a+b+c || 1; const aa=a/s, bb=b/s, cc=c/s;
    return { x: aa*A.x + bb*B.x + cc*C.x + origin.x, y: aa*A.y + bb*B.y + cc*C.y + origin.y };
  }
  function nearestVision(x,y, list){
    let best=null, bestD=Infinity;
    for(const v of list){ const p=baryToXY(v.nff); const d=(p.x-x)**2+(p.y-y)**2; if(d<bestD){bestD=d; best=v;} }
    return best;
  }

  // scenario points + colored tags (labels distinct from axis labels)
  const gPoints = svg.append("g");
  const gTags   = svg.append("g");
  visions.forEach(v=>{
    const p = baryToXY(v.nff);
    const color = palette(v.title_key || v.title_en || v.id);

    // point
    gPoints.append("circle")
      .attr("cx", p.x).attr("cy", p.y)
      .attr("r", 7)
      .attr("fill", color)
      .attr("stroke","#fff")
      .attr("stroke-width",2)
      .style("cursor","pointer")
      .on("mouseenter", function(){ d3.select(this).transition().attr("r",9); })
      .on("mouseleave", function(){ d3.select(this).transition().attr("r",7); })
      .on("click", () => selectVision(v, p));

    // text tag with white outline (paint-order stroke)
    gTags.append("text")
      .attr("x", p.x + 12).attr("y", p.y - 10)
      .attr("class","scenario-tag")
      .attr("fill", color)
      .text(v.title_en || v.id)
      .style("cursor","pointer")
      .on("click", () => selectVision(v, p));
  });

  // legend
  const legend = svg.append("g").attr("transform", `translate(${width-200}, ${padding-10})`);
  legend.append("text")
    .attr("id","legend-title")
    .attr("class","muted")
    .attr("font-weight",600)
    .text(I18N[LANG].legend);
  visions.forEach((v,i)=>{
    const y = 18 + i*20;
    const color = palette(v.title_key || v.title_en || v.id);
    legend.append("circle").attr("cx",0).attr("cy",y-5).attr("r",6).attr("fill",color).attr("stroke","#fff").attr("stroke-width",1.5);
    legend.append("text").attr("x",12).attr("y",y-2).attr("class","muted").text(v.title_en || v.id);
  });

  // click behavior (anywhere on plot)
  clickCatcher.on("click", (e)=>{
    const [x,y] = d3.pointer(e, svg.node());
    const v = nearestVision(x,y,visions);
    if (!v) return;
    selectVision(v, baryToXY(v.nff));
  });

  function selectVision(v, p){
    CURRENT_VISION = v;
    cursor.transition().duration(220).attr("cx", p.x).attr("cy", p.y);
    SHOW_CARD(v);
  }

  // card renderer
  SHOW_CARD = function(v){
    const t = LANG === "kr" ? (v.title_kr || "") : (v.title_en || "");
    const s = LANG === "kr" ? (v.summary_kr || "") : (v.summary_en || "");
    const sources = Array.isArray(v.source) ? v.source.join(", ") : (v.source || "");
    const visionKey = v.title_key || v.title_en || "";
    const seedObjs = (v.seeds || []).map(id => seedById.get(id)).filter(Boolean);
    const visionStories = storiesByVisionKey[visionKey] || [];

    const seedChips = seedObjs.map(sd=>{
      const nm = LANG==="kr" ? sd.title_kr : sd.title_en;
      return `<span class="chip" title="${sd.domain||""}">${nm}</span>`;
    }).join("");

    const storyItems = visionStories.map(st=>{
      const nm = LANG==="kr" ? st.title_kr : st.title_en;
      const ab = LANG==="kr" ? st.abstract_kr : st.abstract_en;
      return `<li><strong>${nm||""}</strong><br><span class="muted">${ab||""}</span></li>`;
    }).join("");

    const H = I18N[LANG];
    document.getElementById("scenario-card").innerHTML = `
      <h2>${t}</h2>
      <p>${s}</p>
      <div class="group">
        <h3>${H.seeds}</h3>
        <div class="chips">${seedChips || "<span class='muted'>—</span>"}</div>
      </div>
      <div class="group">
        <h3>${H.stories}</h3>
        <ul style="margin-left:1rem">${storyItems || "<span class='muted'>—</span>"}</ul>
      </div>
      <div class="group">
        <small class="muted">${H.source}: ${sources || "—"}</small>
      </div>
    `;
  };

  // initial selection
  if (visions[0]) {
    const p = baryToXY(visions[0].nff);
    selectVision(visions[0], p);
  }

  // finalize UI
  setLang(LANG);
});
