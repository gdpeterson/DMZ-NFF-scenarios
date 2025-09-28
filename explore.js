async function init() {
  const visions = await fetch("data/visions.json").then(r => r.json());

  const width = 400, height = 350, padding = 30;
  const side = Math.min(width, height) - 2 * padding;
  const origin = { x: padding, y: padding };

  // vertices of triangle
  const A = { x: 0.5 * side, y: 0 };
  const B = { x: 0, y: (Math.sqrt(3) / 2) * side };
  const C = { x: side, y: (Math.sqrt(3) / 2) * side };

  const svg = d3.select("#plot").append("svg")
    .attr("width", width)
    .attr("height", height);

  svg.append("path")
    .attr("d", `M${A.x+origin.x},${A.y+origin.y} L${B.x+origin.x},${B.y+origin.y} L${C.x+origin.x},${C.y+origin.y}Z`)
    .attr("stroke", "#333").attr("fill", "none");

  // helper: barycentric to xy
  function baryToXY({a,b,c}) {
    const sum = a+b+c || 1;
    a/=sum; b/=sum; c/=sum;
    return {
      x: a*A.x + b*B.x + c*C.x + origin.x,
      y: a*A.y + b*B.y + c*C.y + origin.y
    };
  }

  // place authored visions
  visions.forEach(v => {
    const {x,y} = baryToXY(v.nff);
    svg.append("circle")
      .attr("cx", x).attr("cy", y)
      .attr("r", 5).attr("fill", "black")
      .append("title").text(v.title_en);
  });

  // draggable cursor
  let cursor = svg.append("circle")
    .attr("r", 10).attr("stroke", "black").attr("fill", "white")
    .attr("cx", width/2).attr("cy", height/2);

  function snapToNearest(x,y) {
    let best=null, bestD=Infinity;
    visions.forEach(v=>{
      const {x:px,y:py}=baryToXY(v.nff);
      const d=(px-x)**2+(py-y)**2;
      if(d<bestD){bestD=d; best=v;}
    });
    return best;
  }

  svg.on("click", function(e){
    const [x,y]=d3.pointer(e);
    cursor.attr("cx", x).attr("cy", y);
    const nearest=snapToNearest(x,y);
    if(nearest) showCard(nearest);
  });

  // scenario card
  function showCard(v){
    const div=document.getElementById("scenario-card");
    div.innerHTML=`
      <h2>${v.title_en} / ${v.title_kr}</h2>
      <p>${v.summary_en||""}</p>
      <p>${v.summary_kr||""}</p>
      <h3>Seeds</h3>
      <ul>${(v.seeds||[]).map(s=>`<li>${s}</li>`).join("")}</ul>
      <small>Source: ${ (v.source||[]).join(", ") }</small>
    `;
  }
}
init();
