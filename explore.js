console.log("[explore.js v12] loaded");

// i18n (axes on the triangle stay abbreviated NN/NS/NC; legend explains them)
let LANG = localStorage.getItem("dmz-lang") || "en";
const I18N = {
  en: {
    axes: ["NN","NS","NC"],                 // shown on the corners
    legend: "Scenarios",
    legend_axes: "Axes",
    seeds: "Seeds",
    stories: "Stories",
    source: "Source"
  },
  kr: {
    axes: ["NN","NS","NC"],                 // corners fixed as abbreviations
    legend: "시나리오",
    legend_axes: "축",
    seeds: "시드",
    stories: "이야기",
    source: "출처"
  }
};

// Long-form explanations for the abbreviations (for the legend)
const ABBR = {
  en: [
    { abbr: "NN", text: "Nature for Nature" },
    { abbr: "NS", text: "Nature for Society" },
    { abbr: "NC", text: "Nature as Culture" }
  ],
  kr: [
    { abbr: "NN", text: "자연을 위한 자연" },
    { abbr: "NS", text: "사회를 위한 자연" },
    { abbr: "NC", text: "자연으로서의 문화" }
  ]
};

let CURRENT_VISION = null, AXIS_LABEL_NODES = [], SHOW_CARD = () => {};
let renderAbbrLegend = () => {}; // assigned after SVG exists

function renderAxes() {
  if (AXIS_LABEL_NODES.length !== 3) return;
  const L = I18N[LANG].axes; // ["NN","NS","NC"]
  AXIS_LABEL_NODES[0].text(L[0]); // top
  AXIS_LABEL_NODES[1].text(L[1]); // bottom-left
  AXIS_LABEL_NODES[2].text(L[2]); // bottom-right
}

function setLang(lang) {
  LANG = lang;
  localStorage.setItem("dmz-lang", LANG);
  document.getElementById("btn-en")?.classList.toggle("active", LANG === "en");
  document.getElementById("btn-kr")?.classList.toggle("active", LANG === "kr");

  // Axes remain NN/NS/NC, but the axes legend and scenario legend title update
  renderAxes();
  renderAbbrLegend();
  d3.select("#legend-title").text(I18N[LANG].legend);

  if (CURRENT_VISION) SHOW_CARD(CURRENT_VISION);
  console.log("[i18n] LANG =", LANG);

  // notify index.html static i18n (if present)
  document.dispatchEvent(new CustomEvent("dmz-lang-change", { detail: { lang } }));
}

window.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("btn-en")?.addEventListener("click", () => setLang("en"));
  document.getElementById("btn-kr")?.addEventListener("click", () => setLang("kr"));

  // Bigger canvas + responsive viewBox
  const width = 820, height = 640, padding = 72;
  const side = Math.min(width, height) - 2 * padding;
  const origin = { x: padding, y: padding + 16 };
  const A = { x: .5 * side, y: 0 }, B = { x: 0, y: (Math.sqrt(3) / 2) * side }, C = { x: side, y: (Math.sqrt(3) / 2) * side };

  const svg = d3.select("#plot").append("svg")
    .attr("width", "100%").attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  svg.append("rect").attr("x", 0).attr("y", 0).attr("width", width).attr("height", height).attr("fill", "#fff");

  svg.append("path")
    .attr("d", `M${A.x + origin.x},${A.y + origin.y} L${B.x + origin.x},${B.y + origin.y} L${C.x + origin.x},${C.y + origin.y}Z`)
    .attr("fill", "#f8fafc").attr("stroke", "#0f172a").attr("stroke-width", 1.5)
    .style("filter", "drop-shadow(0 6px 14px rgba(15,23,42,.08))")
    .style("pointer-events", "all");

  const clickCatcher = svg.append("rect").attr("x", 0).attr("y", 0).attr("width", width).attr("height", height)
    .attr("fill", "transparent").style("pointer-events", "all");

  // Corner labels (NN/NS/NC)
  AXIS_LABEL_NODES = [
    svg.append("text").attr("x", origin.x + side * .5).attr("y", origin.y - 14).attr("text-anchor", "middle").attr("class", "axis"),
    svg.append("text").attr("x", origin.x - 12).attr("y", origin.y + (Math.sqrt(3) / 2) * side + 28).attr("text-anchor", "end").attr("class", "axis"),
    svg.append("text").attr("x", origin.x + side + 12).attr("y", origin.y + (Math.sqrt(3) / 2) * side + 28).attr("text-anchor", "start").attr("class", "axis")
  ];
  renderAxes();

  // Axes legend (explains NN/NS/NC in current language)
  const abbrLegendGroup = svg.append("g").attr("transform", `translate(${padding - 6}, ${padding - 6})`);
  renderAbbrLegend = function () {
    const rows = ABBR[LANG];
    abbrLegendGroup.selectAll("*").remove();
    abbrLegendGroup.append("text")
      .attr("class", "legend muted")
      .attr("font-weight", 600)
      .text(I18N[LANG].legend_axes);
    rows.forEach((r, i) => {
      const y = 24 + i * 18;
      abbrLegendGroup.append("text")
        .attr("x", 0).attr("y", y)
        .attr("font-weight", 700)
        .text(r.abbr);
      abbrLegendGroup.append("text")
        .attr("x", 28).attr("y", y)
        .attr("class", "muted")
        .text("— " + r.text);
    });
  };
  renderAbbrLegend();

  function baryToXY(nff) {
    const a = nff.a ?? nff.nature_for_nature ?? 0, b = nff.b ?? nff.nature_for_society ?? 0, c = nff.c ?? nff.nature_as_culture ?? 0;
    const s = a + b + c || 1, aa = a / s, bb = b / s, cc = c / s;
    return { x: aa * A.x + bb * B.x + cc * C.x + origin.x, y: aa * A.y + bb * B.y + cc * C.y + origin.y };
  }
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  // Load data (visions required; others optional)
  let visions = [], seeds = [], stories = [];
  try { const r = await fetch("data/visions.json"); if (!r.ok) throw new Error(`visions.json ${r.status}`); visions = await r.json(); }
  catch (e) { document.getElementById("scenario-card").innerHTML = `<strong>Load error:</strong> ${e.message}`; return; }
  try { const r = await fetch("data/seeds.json"); if (r.ok) seeds = await r.json(); } catch {}
  try { const r = await fetch("data/stories.json"); if (r.ok) stories = await r.json(); } catch {}

  const seedById = new Map(seeds.map(s => [s.id, s]));
  const storiesByVisionKey = stories.reduce((a, st) => ((a[st.vision_key] ??= []).push(st), a), {});

  const palette = d3.scaleOrdinal().domain(visions.map(v => v.title_key || v.title_en || v.id))
    .range(["#2563eb", "#059669", "#f59e0b", "#e11d48", "#7c3aed"]);

  function nearestVision(x, y, list) {
    let best = null, bestD = Infinity;
    for (const v of list) { const p = baryToXY(v.nff), d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bestD) { bestD = d; best = v; } }
    return best;
  }

  // Draw scenarios with smarter label placement
  const gPoints = svg.append("g"), gTags = svg.append("g");
  visions.forEach(v => {
    const p = baryToXY(v.nff), color = palette(v.title_key || v.title_en || v.id);
    gPoints.append("circle").attr("cx", p.x).attr("cy", p.y).attr("r", 8).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", 2)
      .style("cursor", "pointer").on("mouseenter", function () { d3.select(this).transition().attr("r", 10); })
      .on("mouseleave", function () { d3.select(this).transition().attr("r", 8); })
      .on("click", () => selectVision(v, p));

    // Label offset based on horizontal half; clamp to inset box
    const left = p.x < origin.x + side / 2;
    const dx = left ? -14 : 14, anchor = left ? "end" : "start";
    const box = { x1: 16, y1: 16, x2: width - 16, y2: height - 16 };
    const lx = clamp(p.x + dx, box.x1, box.x2), ly = clamp(p.y - 10, box.y1, box.y2);

    gTags.append("text").attr("x", lx).attr("y", ly).attr("class", "scenario-tag").attr("fill", color)
      .attr("text-anchor", anchor).text(v.title_en || v.id)
      .style("cursor", "pointer").on("click", () => selectVision(v, p));
  });

  // Scenario legend (top-right)
  const legend = svg.append("g").attr("transform", `translate(${width - 240}, ${padding - 6})`);
  legend.append("text").attr("id", "legend-title").attr("class", "legend muted").attr("font-weight", 600).text(I18N[LANG].legend);
  visions.forEach((v, i) => {
    const y = 22 + i * 20, color = palette(v.title_key || v.title_en || v.id);
    legend.append("circle").attr("cx", 0).attr("cy", y - 6).attr("r", 6).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", 1.5);
    legend.append("text").attr("x", 12).attr("y", y - 4).attr("class", "muted").text(v.title_en || v.id);
  });

  // Cursor + clicks
  const cursor = svg.append("circle").attr("r", 12).attr("stroke", "#0f172a").attr("stroke-width", 1.5).attr("fill", "#fff");
  function selectVision(v, p) { CURRENT_VISION = v; cursor.transition().duration(220).attr("cx", p.x).attr("cy", p.y); SHOW_CARD(v); }
  clickCatcher.on("click", (e) => { const [x, y] = d3.pointer(e, svg.node()); const v = nearestVision(x, y, visions); if (v) selectVision(v, baryToXY(v.nff)); });

  // Card renderer
  SHOW_CARD = function (v) {
    const t = LANG === "kr" ? (v.title_kr || "") : (v.title_en || "");
    const s = LANG === "kr" ? (v.summary_kr || "") : (v.summary_en || "");
    const sources = Array.isArray(v.source) ? v.source.join(", ") : (v.source || "");
    const visionKey = v.title_key || v.title_en || "";
    const seedObjs = (v.seeds || []).map(id => seedById.get(id)).filter(Boolean);
    const visionStories = storiesByVisionKey[visionKey] || [];
    const seedChips = seedObjs.map(sd => `<span class="chip" title="${sd.domain || ""}">${LANG === "kr" ? sd.title_kr : sd.title_en}</span>`).join("");
    const storyItems = visionStories.map(st => `<li><strong>${LANG === "kr" ? st.title_kr : st.title_en}</strong><br><span class="muted">${LANG === "kr" ? st.abstract_kr : (st.abstract_en || "")}</span></li>`).join("");
    const H = I18N[LANG];
    document.getElementById("scenario-card").innerHTML = `
      <h2>${t}</h2><p>${s}</p>
      <div class="group"><h3>${H.seeds}</h3><div class="chips">${seedChips || "<span class='muted'>—</span>"}</div></div>
      <div class="group"><h3>${H.stories}</h3><ul style="margin-left:1rem">${storyItems || "<span class='muted'>—</span>"}</ul></div>
      <div class="group"><small class="muted">${H.source}: ${sources || "—"}</small></div>`;
  };

  // Start at first
  if (visions[0]) { const p = baryToXY(visions[0].nff); selectVision(visions[0], p); }

  // Initialize language UI (buttons, legends)
  setLang(LANG);
});
