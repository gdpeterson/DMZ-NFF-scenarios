// Minimal, defensive version with clear errors in the console.
console.log("[explore.js] loaded");

window.addEventListener("DOMContentLoaded", async () => {
  console.log("[explore.js] DOM ready, starting init()");
  try {
    // 1) Load data
    const resp = await fetch("data/visions.json");
    if (!resp.ok) throw new Error(`Failed to fetch data/visions.json (${resp.status})`);
    const visions = await resp.json();
    console.log("[explore.js] visions loaded:", visions);

    // Guard: require at least one vision
    if (!Array.isArray(visions) || visions.length === 0) {
      renderError("No visions found in data/visions.json");
      return;
    }

    // 2) Basic triangle
    const width = 420, height = 380, padding = 30;
    const side = Math.min(width, height) - 2 * padding;
    const origin = { x: padding, y: padding };

    const A = { x: 0.5 * side, y: 0 };
    const B = { x: 0, y: (Math.sqrt(3) / 2) * side };
    const C = { x: side, y: (Math.sqrt(3) / 2) * side };

    const svg = d3.select("#plot").append("svg")
      .attr("width", width)
      .attr("height", height);

    svg.append("path")
      .attr("d", `M${A.x+origin.x},${A.y+origin.y} L${B.x+origin.x},${B.y+origin.y} L${C.x+origin.x},${C.y+origin.y}Z`)
      .attr("stroke", "#111")
      .attr("fill", "none");

    // Helpers
    function baryToXY(nff) {
      // Support both {a,b,c} and {nature_for_nature, nature_for_society, nature_as_culture}
      const a = nff.a ?? nff.nature_for_nature ?? 0;
      const b = nff.b ?? nff.nature_for_society ?? 0;
      const c = nff.c ?? nff.nature_as_culture ?? 0;
      const sum = a + b + c || 1;
      const aa = a / sum, bb = b / sum, cc = c / sum;
      return {
        x: aa * A.x + bb * B.x + cc * C.x + origin.x,
        y: aa * A.y + bb * B.y + cc * C.y + origin.y
      };
    }

    function showCard(v) {
      const div = document.getElementById("scenario-card");
      const seedsList = Array.isArray(v.seeds) ? v.seeds.map(s => `<li>${s}</li>`).join("") : "";
      const sources = Array.isArray(v.source) ? v.source.join(", ") : (v.source || "");

      div.innerHTML = `
        <h2>${v.title_en || "(no title)"} / ${v.title_kr || ""}</h2>
        <p>${v.summary_en || ""}</p>
        <p>${v.summary_kr || ""}</p>
        <h3>Seeds</h3>
        <ul>${seedsList}</ul>
        <small class="muted">Source: ${sources}</small>
      `;
    }

    // 3) Plot authored vision points
    visions.forEach(v => {
      const { x, y } = baryToXY(v.nff);
      svg.append("circle")
        .attr("cx", x).attr("cy", y)
        .attr("r", 5).attr("fill", "#111")
        .append("title").text(v.title_en || v.id || "Vision");
    });

    // 4) Draggable cursor (actually click-to-move; simple & reliable)
    let cursor = svg.append("circle")
      .attr("r", 10)
      .attr("stroke", "#111")
      .attr("fill", "#fff")
      .attr("cx", width/2)
      .attr("cy", height/2);

    function nearestVision(x, y) {
      let best = null, bestD = Infinity;
      visions.forEach(v => {
        const p = baryToXY(v.nff);
        const d = (p.x - x)**2 + (p.y - y)**2;
        if (d < bestD) { bestD = d; best = v; }
      });
      return best;
    }

    svg.on("click", function (e) {
      const [x, y] = d3.pointer(e);
      cursor.attr("cx", x).attr("cy", y);
      const v = nearestVision(x, y);
      if (v) showCard(v);
    });

    // Initialize with first vision
    const start = visions[0];
    if (start) {
      const p = baryToXY(start.nff);
      cursor.attr("cx", p.x).attr("cy", p.y);
      showCard(start);
    }
  } catch (err) {
    console.error(err);
    renderError(err.message || String(err));
  }
});

function renderError(msg) {
  const div = document.getElementById("scenario-card");
  div.innerHTML = `<strong>Load error:</strong> ${msg}<br><span class="muted">Check the browser console for details.</span>`;
}
