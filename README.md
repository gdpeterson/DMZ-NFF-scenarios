# DMZ Futures Explorer

An interactive, bilingual (Korean/English) static website for exploring possible futures of the Korean Demilitarized Zone (DMZ) using the **Nature Futures Framework (NFF)**.

Built as part of the EcoPeace Forum 2023–2024 process.  
Content is grounded in two core sources:

- **Kim et al. 2024 — DMZ Visions Preprint** ([OSF link](https://osf.io/g3zb4_v1))  
- **Peterson 2024 — DMZ Storybook** ([OSF link](https://osf.io/g3zb4_v1))

---

## 🌐 Live site

[https://gdpeterson.github.io/DMZ-NFF-scenarios/](https://gdpeterson.github.io/DMZ-NFF-scenarios/)  


---

## 📖 Features

- **Interactive ternary plot** (NN = Nature for Nature, NS = Nature for Society, NC = Nature as Culture)  
  – click anywhere to snap to the nearest authored scenario.
- **Five scenarios, each with seeds, stories, and sources.
- **Seeds library** with domain filters (Agriculture, Conservation, Community, Culture, Education, Economy).
- **Stories gallery** (planned) showing narrative vignettes.
- **Bilingual toggle (EN/KR)** — persists across pages.
- **Provenance chips** link every scenario or seed back to its source.
- **Accessible & mobile-friendly** design.

---

## 🗂 Repository structure

```
DMZ-NFF-scenarios/
├── index.html          # Main explorer (triangle, about, library)
├── seeds.html          # Seeds library page
├── stories.html        # (planned) Stories gallery
├── data/
│   ├── visions.json    # Scenario metadata (4+ visions)
│   ├── seeds.json      # Seed entries
│   └── stories.json    # Story entries
├── explore.js          # Main D3 ternary plot logic
├── styles.css          # (optional, inline styles currently used)
├── social.png          # Screenshot for sharing/SEO
├── 404.html            # Custom not-found page
├── README.md           # This file
└── LICENSE             # License info (MIT for code, CC-BY for content)
```

---

## 🚀 Development

This site is **100% static**: just HTML, CSS, JS, and JSON. No build step required.

### Running locally
Clone the repo and open `index.html` in your browser:

```bash
git clone https://github.com/USERNAME/DMZ-NFF-scenarios.git
cd DMZ-NFF-scenarios
open index.html   # or double-click the file
```

For JSON fetches to work locally, you’ll need a static server (due to browser CORS rules). For example:

```bash
python3 -m http.server 8000
```

Then open: [http://localhost:8000](http://localhost:8000)

### Deployment
Push to GitHub → Pages will automatically serve the site.  
Enable **Pages** in repo settings and select the `main` branch, `/root` folder.

---


## 📜 License

- **Code**: MIT License  
- **Content (seeds, stories, scenarios)**: CC-BY 4.0 — must cite EcoPeace Forum and the original authors.

---

## 🙏 Acknowledgments

- EcoPeace Forum 2023–2024 participants  

---

## 🔮 Roadmap

- [ ] Stories gallery (Peterson narratives)
- [ ] Indicators dashboard (ecological, social, cultural metrics)
- [ ] Export/print functions
- [ ] Expanded seed set with tagging
- [ ] Enhanced accessibility & mobile UI polish
