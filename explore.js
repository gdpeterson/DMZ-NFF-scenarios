console.log("[explore.js] loaded");

// Simple language state (EN default)
let LANG = localStorage.getItem("dmz-lang") || "en";
function setLang(lang) {
  LANG = lang;
  localStorage.setItem("dmz-lang", LANG);
  document.getElementById("btn-en").classList.toggle("active", LANG === "en");
  document.getElementById("btn-kr").classList.toggle("active", LANG === "kr");
}

window.addEventListener("DOMContentLoaded", async () => {
  // Wire language buttons
  document.getElementById("btn-en").addEventListener("click", () => { setLang("en"); if (currentVision) showCard(currentVision); });
  document.getElementById("btn-kr").addEventListener("click", () => { setLang("kr"); if (currentVision) showCard(currentVision); });
  setLang(LANG);

  try {
    // Load all datasets
    const [visions, seeds, stories] = await Promise.all([
      fetch("data/visions.json").then(r => { if(!r.ok) throw new Error("visions.json missing"); return r.json(); }),
      fetch("data/seeds.json").then(r => { if(!r.ok) throw new Error("seeds.json missing"); return r.json(); }),
      fetch("data/stories.json").then(r => { if(!r.ok) throw new Error("stories.json missing"); return r.json(); })
    ]);

    // Index seeds by id for quick lookup
    const seedById = new Map(seeds.map(s => [s.id, s]));
    // Group stories by vision_key (e.g., "Nature for Society")
    const storiesByVisionKey = stories.reduce((acc, st) => {
      (acc[st.vision_key] ||= []).push(st);
      return acc;
    }, {});

    // Triangle setup
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

    // Axes labels
    const labels = [
      { text: "Nature for Nature (A)", x: origin.x + side*0.5, y: origin.y - 6, anchor: "middle" },
      { text: "Nature for Society (B)", x: origin.x - 8, y: origin.y + (Math.sqrt(3)/2)*side + 18, anchor: "end" },
      { text: "Nature as Culture (C)", x: origin.x + side + 8, y: origin.y + (Math.sqrt(3)/2)*side + 18, anchor: "start" }
    ];
    labels.forEach(l => svg.append("text").attr("x", l.x).attr("y", l.y).attr("text-anchor", l.anchor).attr("class", "muted").text(l.text));

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
      visions.forEach(v => {
        const p = baryToXY(v.nff);
        const d = (p.x-x)**2 + (p.y-y)**2;
        if (d < bestD) { bestD = d; best = v; }
      });
      return best;
    }

    // Plot authored vision points
    visions.forEach(v => {
      const { x, y } = baryToXY(v.nff);
      svg.append("circle").attr("cx", x).attr("cy", y).attr("r", 5).attr("fill", "#111")
        .append("title").text(v.title_en || v.id);
      svg.append("text").attr("x", x+8).attr("y", y-8).attr("class", "muted").text(v.title_en || v.id);
    });

    // Cursor and interactions
    let cursor = svg.append("circle").attr("r", 10).attr("stroke", "#111").attr("fill", "#fff");
    let currentVision = null;

    svg.on("click", (e) => {
      const [x,y] = d3.pointer(e);
      cursor.attr("cx", x).attr("cy", y);
      const v = nearestVision(x,y);
      if (v) { currentVision = v; showCard(v); }
    });

    // Initialize at first vision
    if (visions[0]) {
      const p = baryToXY(visions[0].nff);
      cursor.attr("cx", p.x).attr("cy", p.y);
      currentVision = visions[0];
      showCard(currentVision);
    }

    // Render the scenario card with seeds + stories and language
    function showCard(v) {
      const div = document.getElementById("scenario-card");
      const t_en = v.title_en || "";
      const t_kr = v.title_kr || "";
      const s_en = v.summary_en || "";
      const s_kr = v.summary_kr || "";
      const sources = Array.isArray(v.source) ? v.source.join(", ") : (v.source || "");

      // resolve seeds by id
      const seedObjs = (v.seeds || []).map(id => seedById.get(id)).filter(Boolean);

      // stories by the vision's title_key
      const visionKey = v.title_key || v.title_en; // fallback
      const visionStories = storiesByVisionKey[visionKey] || [];

      const title = LANG === "kr" ? `${t_kr} / ${t_en}` : `${t_en} / ${t_kr}`;
      const summary = LANG === "kr" ? s_kr : s_en;

      const seedChips = seedObjs.map(s => {
        const name = LANG === "kr" ? s.title_kr : s.title_en;
        return `<span class="chip" title="${s.domain}">${name}</span>`;
      }).join("");

      const storyList = visionStories.map(st => {
        const name = LANG === "kr" ? st.title_kr : st.title_en;
        const abs = LANG === "kr" ? st.abstract_kr : st.abstract_en;
        return `<li><strong>${name}</strong><br><span class="muted">${abs || ""}</span></li>`;
      }).join("");

      div.innerHTML = `
        <h2>${title}</h2>
        <p>${summary}</p>

        <div class="group">
          <h3>Seeds / 시드</h3>
          <div class="chips">${seedChips || "<span class='muted'>—</span>"}</div>
        </div>

        <div class="group">
          <h3>Stories / 이야기</h3>
          <ul style="margin-left:1rem">${storyList || "<span class='muted'>—</span>"}</ul>
        </div>

        <div class="group">
          <small class="muted">Source: ${sources || "—"}</small>
        </div>
      `;
    }

  } catch (err) {
    console.error(err);
    const div = document.getElementById("scenario-card");
    div.innerHTML = `<strong>Load error:</strong> ${err.message || String(err)}<br><span class="muted">Check file paths & casing.</span>`;
  }
});
