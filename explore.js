console.log("[explore.js v6] loaded");

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

// Global UI state used by toggle re-renders
let CURRENT_VISION = null;
let AXIS_LABEL_NODES = []; // three <text> nodes for axes

function setLang(lang) {
  LANG = lang;
  localStorage.setItem("dmz-lang", LANG);
  document.getElementById("btn-en")?.classList.toggle("active", LANG === "en");
  document.getElementById("btn-kr")?.classList.toggle("active", LANG === "kr");
  if (AXIS_LABEL_NODES.length === 3) renderAxes(); // update axis text
  if (CURRENT_VISION) showCard(CURRENT_VISION);    // update card text
  console.log("[i18n] LANG =", LANG);
}

window.addEventListener("DOMContentLoaded", async () => {
  // Wire language buttons
  document.getElementById("btn-en")?.addEventListener("click", () => setLang("en"));
  document.getElementById("btn-kr")?.addEventListener("click", () => setLang("kr"));
  setLang(LANG); // set initial button state immediately

  try {
    // Load datasets
    const [visions, seeds, stories] = await Promise.all([
      fetch("data/visions.json").then(r => { if (!r.ok) throw new Error("visions.json missing"); return r.json(); }),
      fetch("data/seeds.json").then(r => { if (!r.ok) throw new Error("seeds.json missing"); return r.json(); }),
      fetch("data/stories.json").then(r => { if (!r.ok) throw new Error("stories.json missing"); return r.json(); })
    ]);
    console.log("[data] visions:", visions.length, "seeds:", seeds.length, "stories:", stories.length);

    // Index helpers
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
    renderAxes(); // initial render for current LANG

    // Helpers for ternary <-> xy
    function baryToXY(nff) {
      const a = nff.a ?? nff.nature_for_nature ?? 0;
      const b = nff.b ?? nff.nature_for_society ?? 0;
      const c = nff.c ?? nff.nature_as_culture ?? 0;
      const s = a + b + c || 1;
      const aa = a/s, bb = b/s, cc = c/s;
      return { x: aa*A.x + bb*B.x + cc*C.x + origin.x, y: aa*A.y + bb*B.y + cc*C.y + origin.y };
    }
    function nearestVision(x, y) {
      let best = null, bestD = Infinity;
      for (const v of visions) {
        const p = baryToXY(v.nff);
        const d = (p.x - x)**2 + (p.y - y)**2;
        if (d < bestD) { bestD = d; best = v; }
      }
      return best;
    }

    // Plot authored points + small labels (keep EN for tiny labels to avoid clutter)
    for (const v of visions) {
      const { x, y } = baryToXY(v.nff);
      svg.append("circle").attr("cx", x).attr("cy", y).attr("r", 5).attr("fill", "#111")
        .append("title").text(v.title_en || v.id);
      svg.append("text").attr("x", x+8).attr("y", y-8).attr("class", "muted").text(v.title_en || v.id);
    }

    // Cursor & click interaction
    const cursor = svg.append("circle").attr("r", 10).attr("stroke", "#111").attr("fill", "#fff");
    svg.on("click", (e) => {
      const [x,y] = d3.pointer(e);
      cursor.attr("cx", x).attr("cy", y);
      const v = nearestVision(x,y);
      if (v) { CURRENT_VISION = v; showCard(v); }
    });

    // Initialize at first vision
    if (visions[0]) {
      const p = baryToXY(visions[0].nff);
      cursor.attr("cx", p.x).attr("cy", p.y);
      CURRENT_VISION = visions[0];
      showCard(CURRENT_VISION);
    }

    // ---- Card renderer (uses LANG) ----
    function showCard(v) {
      const t = LANG === "kr" ? (v.title_kr || "") : (v.title_en || "");
      const s = LANG === "kr" ? (v.summary_kr || "") : (v.summary_en || "");
      const sources = Array.isArray(v.source) ? v.source.join(", ") : (v.source || "");
      const visionKey = v.title_key || v.title_en || ""; // used to group stories
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
    }

  } catch (err) {
    console.error(err);
    document.getElementById("scenario-card").innerHTML =
      `<strong>Load error:</strong> ${err.message || String(err)}<br><span class="muted">Check file paths & casing.</span>`;
  }
});
