console.log("[explore.js v8] loaded");

// --- Simple i18n state ---
let LANG = localStorage.getItem("dmz-lang") || "en";
const I18N = {
  en: { axes: ["Nature for Nature (A)", "Nature for Society (B)", "Nature as Culture (C)"], seeds: "Seeds", stories: "Stories", source: "Source" },
  kr: { axes: ["자연을 위한 자연 (A)", "사회를 위한 자연 (B)", "자연으로서의 문화 (C)"], seeds: "시드", stories: "이야기", source: "출처" }
};

// Global UI state used by toggle re-renders
let CURRENT_VISION = null;
let AXIS_LABEL_NODES = []; // three <text> nodes for axes
let SHOW_CARD = () => {};  // assigned after data loads

// HOISTED: make renderAxes global so setLang() can call it safely
function renderAxes() {
  if (AXIS_LABEL_NODES.length !== 3) return;
  const L = I18N[LANG].axes;
  AXIS_LABEL_NODES[0].text(L[0]);
  AXIS_LABEL_NODES[1].text(L[1]);
  AXIS_LABEL_NODES[2].text(L[2]);
}

function setLang(lang) {
  LANG = lang;
  localStorage.setItem("dmz-lang", LANG);
  document.getElementById("btn-en")?.classList.toggle("active", LANG === "en");
  document.getElementById("btn-kr")?.classList.toggle("active", LANG === "kr");
  renderAxes();                     // now safe: hoisted & global
  if (CURRENT_VISION) SHOW_CARD(CURRENT_VISION);
  console.log("[i18n] LANG =", LANG);
}

window.addEventListener("DOMContentLoaded", async () => {
  // Wire language buttons
  document.getElementById("btn-en")?.addEventListener("click", () => setLang("en"));
  document.getElementById("btn-kr")?.addEventListener("click", () => setLang("kr"));

  // ---- Draw the triangle FIRST so it's always visible ----
  const width = 520, height = 460, padding = 36;
  const side = Math.min(width, height) - 2 * padding;
  const origin = { x: padding, y: padding + 10 };
  const A = { x: 0.5 * side, y: 0 };
  const B = { x: 0, y: (Math.sqrt(3) / 2) * side };
  const C = { x: side, y: (Math.sqrt(3) / 2) * side };

  const svg = d3.select("#plot").append("svg").attr("width", width).attr("height", height);

  // Triangle outline
  svg.append("path")
    .attr("d", `M${A.x+origin.x},${A.y+origin.y} L${B.x+origin.x},${B.y+origin.y} L${C.x+origin.x},${C.y+origin.y}Z`)
    .attr("stroke", "#111").attr("fill", "none")
    .style("pointer-events", "all"); // let clicks land on the path too

  // FULL-SIZE CLICK CATCHER (transparent, on top of triangle)
  const clickCatcher = svg.append("rect")
    .attr("x", 0).attr("y", 0)
    .attr("width", width).attr("height", height)
    .attr("fill", "transparent")
    .style("pointer-events", "all");

  // Axis labels (store nodes so we can re-render text on toggle)
  AXIS_LABEL_NODES = [
    svg.append("text").attr("x", origin.x + side*0.5).attr("y", origin.y - 6).attr("text-anchor", "middle").attr("class", "muted"),
    svg.append("text").attr("x", origin.x - 8).attr("y", origin.y + (Math.sqrt(3)/2)*side + 18).attr("text-anchor", "end").attr("class", "muted"),
    svg.append("text").attr("x", origin.x + side + 8).attr("y", origin.y + (Math.sqrt(3)/2)*side + 18).attr("text-anchor", "start").attr("class", "muted")
  ];

  // initial lang state + axes
  setLang(LANG);   // sets buttons + calls renderAxes()
  renderAxes();    // harmless extra call

  // Helpers for ternary <-> xy
  function baryToXY(nff) {
    const a = nff.a ?? nff.nature_for_nature ?? 0;
    const b = nff.b ?? nff.nature_for_society ?? 0;
    const c = nff.c ?? nff.nature_as_culture ?? 0;
    const s = a + b + c || 1;
    const aa = a/s, bb = b/s, cc = c/s;
    return { x: aa*A.x + bb*B.x + cc*C.x + origin.x, y: aa*A.y + bb*B.y + cc*C.y + origin.y };
  }
  function nearestVision(x, y, visions) {
    let best = null, bestD = Infinity;
    for (const v of visions) {
      const p = baryToXY(v.nff);
      const d = (p.x - x)**2 + (p.y - y)**2;
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }

  // Cursor (visible even before data) — centered
  const cursor = svg.append("circle").attr("r", 10).attr("stroke", "#111").attr("fill", "#fff")
    .attr("cx", origin.x + side * 0.5).attr("cy", origin.y + (Math.sqrt(3)/4) * side);

  // ---- Now load data (visions required, seeds/stories optional) ----
  let visions = [];
  let seeds = [];
  let stories = [];

  try {
    const vResp = await fetch("data/visions.json");
    if (!vResp.ok) throw new Error(`visions.json missing (status ${vResp.status})`);
    visions = await vResp.json();
  } catch (e) {
    console.error("[data] visions load failed:", e);
    document.getElementById("scenario-card").innerHTML =
      `<strong>Load error:</strong> ${e.message || String(e)}<br><span class="muted">Ensure data/visions.json exists.</span>`;
    return; // can't proceed without visions
  }

  // seeds (optional)
  try {
    const sResp = await fetch("data/seeds.json");
    if (sResp.ok) seeds = await sResp.json(); else console.warn("[data] seeds.json not found; continuing with none.");
  } catch { console.warn("[data] seeds.json fetch error; continuing with none."); }

  // stories (optional)
  try {
    const stResp = await fetch("data/stories.json");
    if (stResp.ok) stories = await stResp.json(); else console.warn("[data] stories.json not found; continuing with none.");
  } catch { console.warn("[data] stories.json fetch error; continuing with none."); }

  console.log("[data] visions:", visions.length, "seeds:", seeds.length, "stories:", stories.length);

  // Index helpers
  const seedById = new Map(seeds.map(s => [s.id, s]));
  const storiesByVisionKey = stories.reduce((acc, st) => {
    (acc[st.vision_key] ||= []).push(st);
    return acc;
  }, {});

  // Plot authored points + tiny labels (keep EN to avoid clutter)
  for (const v of visions) {
    const { x, y } = baryToXY(v.nff);
    svg.append("circle").attr("cx", x).attr("cy", y).attr("r", 5).attr("fill", "#111")
      .append("title").text(v.title_en || v.id);
    svg.append("text").attr("x", x+8).attr("y", y-8).attr("class", "muted").text(v.title_en || v.id);
  }

  // Click interaction (snap to nearest) — use explicit container for pointer
  console.log("[ui] click handler bound; visions =", visions.length);
  clickCatcher.on("click", (e) => {
    const [x, y] = d3.pointer(e, svg.node());
    console.log("[ui] click at", x, y);
    cursor.attr("cx", x).attr("cy", y);
    const v = nearestVision(x, y, visions);
    if (v) { console.log("[ui] snapped to:", v.id || v.title_en); CURRENT_VISION = v; SHOW_CARD(v); }
    else { console.warn("[ui] no nearest vision found"); }
  });

  // Card renderer (assigned so setLang() can call it later)
  SHOW_CARD = function showCard(v) {
    const t = LANG === "kr" ? (v.title_kr || "") : (v.title_en || "");
    const s = LANG === "kr" ? (v.summary_kr || "") : (v.summary_en || "");
    const sources = Array.isArray(v.source) ? v.source.join(", ") : (v.source || "");
    const visionKey = v.title_key || v.title_en || "";
    const seedObjs = (v.seeds || []).map(id => seedById.get(id)).filter(Boolean);
    const visionStories = storiesByVisionKey[visionKey] || [];

    const seedChips = seedObjs.map(sd => {
      const name = (LANG === "kr" ? sd.title_kr : sd.title_en) || "";
      const dom = sd.domain ? ` title="${sd.domain}"` : "";
      return `<span class="chip"${dom}>${name}</span>`;
    }).join("");

    const storyItems = visionStories.map(st => {
      const name = (LANG === "kr" ? st.title_kr : st.title_en) || "";
      const abs  = (LANG === "kr" ? st.abstract_kr : st.abstract_en) || "";
      return `<li><strong>${name}</strong><br><span class="muted">${abs}</span></li>`;
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

  // Initialize at first vision (if any)
  if (visions[0]) {
    const p = baryToXY(visions[0].nff);
    cursor.attr("cx", p.x).attr("cy", p.y);
    CURRENT_VISION = visions[0];
    SHOW_CARD(CURRENT_VISION);
  } else {
    document.getElementById("scenario-card").innerHTML =
      `<strong>No visions found.</strong> <span class="muted">Check data/visions.json format.</span>`;
  }
});
