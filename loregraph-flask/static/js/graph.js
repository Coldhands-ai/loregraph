// Граф связей через Cytoscape.
//

(function () {
  const root = document.querySelector("[data-data-url]");
  if (!root) return;

  const dataUrl = root.dataset.dataUrl;
  const articleBase = root.dataset.articleBase;
  const cyEl = document.getElementById("cy");
  const previewEl = document.getElementById("node-preview");
  const searchEl = document.getElementById("graph-search");
  const filtersEl = document.getElementById("graph-filters");
  const tooltipEl = document.getElementById("cy-tooltip");
  const resetLayoutBtn = document.getElementById("graph-reset-layout");

  let cy;
  const hiddenCats = new Set();
  const positionsKey = `loregraph:graph:${root.dataset.worldId}:positions:v1`;

  function paintFilterPill(pill) {
    const active = pill.dataset.active === "true";
    const color = pill.dataset.color;
    pill.style.color = active ? color : "#475569";
    pill.style.backgroundColor = active ? color + "1A" : "transparent";
    pill.style.borderColor = active ? color + "55" : "rgba(255,255,255,0.08)";
    pill.style.opacity = active ? "1" : "0.55";
    const dot = pill.querySelector("span");
    if (dot) dot.style.backgroundColor = active ? color : "#475569";
  }
  filtersEl.querySelectorAll(".cat-pill").forEach(paintFilterPill);

  function applyFilters() {
    if (!cy) return;
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        const cat = n.data("category_id") || "none";
        n.style("display", hiddenCats.has(cat) ? "none" : "element");
      });
      cy.edges().forEach((e) => {
        const visible =
          e.source().style("display") !== "none" &&
          e.target().style("display") !== "none";
        e.style("display", visible ? "element" : "none");
      });
    });
  }

  filtersEl.querySelectorAll(".cat-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const id = pill.dataset.catId;
      const next = pill.dataset.active !== "true";
      pill.dataset.active = String(next);
      next ? hiddenCats.delete(id) : hiddenCats.add(id);
      paintFilterPill(pill);
      applyFilters();
    });
  });

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

  function renderTooltip(node) {
    const d = node.data();
    const cover = d.image_url
      ? `<div class="w-full h-20 rounded-md mb-2 -mt-1 -mx-1 overflow-hidden bg-bg-surface2/70 flex items-center justify-center">
           <img src="${d.image_url}" alt="" class="graph-card-cover h-full w-full object-cover">
         </div>`
      : "";
    return `
      ${cover}
      <div class="graph-card-meta flex items-center gap-2 mb-1">
        <span class="h-1.5 w-1.5 rounded-full shrink-0" style="background:${d.color}"></span>
        <span class="text-[10px] uppercase tracking-wider font-medium" style="color:${d.color}">${escapeHtml(d.category)}</span>
      </div>
      <div class="graph-card-title font-serif text-base leading-tight text-text">${escapeHtml(d.label)}</div>
      ${d.summary ? `<div class="graph-card-summary mt-1.5 text-xs text-text-muted line-clamp-3 leading-relaxed">${escapeHtml(d.summary)}</div>` : ""}
    `;
  }

  function showTooltip(node, evtPosition) {
    tooltipEl.innerHTML = renderTooltip(node);
    tooltipEl.classList.remove("hidden");
    moveTooltip(evtPosition);
  }
  function moveTooltip(p) {
    const rect = cyEl.getBoundingClientRect();
    const ttRect = tooltipEl.getBoundingClientRect();
    let x = p.x + 14;
    let y = p.y + 14;
    if (x + ttRect.width > rect.width) x = p.x - ttRect.width - 14;
    if (y + ttRect.height > rect.height) y = p.y - ttRect.height - 14;
    tooltipEl.style.left = `${Math.max(4, x)}px`;
    tooltipEl.style.top = `${Math.max(4, y)}px`;
  }
  function hideTooltip() {
    tooltipEl.classList.add("hidden");
  }

  function renderFields(fields) {
    if (!Array.isArray(fields) || fields.length === 0) return "";
    const rows = fields
      .map(
        (field) => `
      <div class="grid grid-cols-[minmax(104px,0.48fr)_1fr] gap-4 py-2.5 first:pt-0 last:pb-0 border-t border-white/[0.04] first:border-t-0">
        <dt class="text-[11px] uppercase tracking-wider text-text-dim leading-snug">${escapeHtml(field.label)}</dt>
        <dd class="text-sm text-text leading-relaxed break-words">${escapeHtml(field.value)}</dd>
      </div>
    `,
      )
      .join("");
    return `
      <section>
        <dl class="rounded border border-white/[0.06] bg-bg-surface2/30 px-3 py-2">
          ${rows}
        </dl>
      </section>
    `;
  }

  function renderPreview(node) {
    if (!node) {
      previewEl.className =
        "graph-preview-empty rounded-lg border border-dashed border-border-strong p-6 text-sm text-text-muted text-center sticky top-20";
      previewEl.innerHTML = "Кликни на узел, чтобы увидеть его карточку.";
      return;
    }
    const d = node.data();
    previewEl.className =
      "graph-preview-card rounded-lg border border-border bg-bg-surface/95 overflow-hidden sticky top-20 animate-fade-in";
    const cover = d.image_url
      ? `<div class="w-full aspect-[16/9] bg-bg-surface2/70 flex items-center justify-center">
           <img src="${d.image_url}" alt="" class="graph-card-cover h-full w-full object-cover">
         </div>`
      : `<div class="graph-card-placeholder w-full aspect-[16/9] flex items-center justify-center" style="background:linear-gradient(135deg, ${d.color}55, ${d.color}22)">
           <span class="font-serif text-6xl font-bold" style="color:${d.color}">${escapeHtml(d.initial)}</span>
         </div>`;
    previewEl.innerHTML = `
      ${cover}
      <div class="p-5 space-y-3">
        <div class="graph-card-meta flex items-center gap-2">
          <span class="h-2 w-2 rounded-full shrink-0" style="background:${d.color}"></span>
          <span class="text-xs uppercase tracking-wider font-medium" style="color:${d.color}">${escapeHtml(d.category)}</span>
        </div>
        <h3 class="graph-card-title font-serif text-2xl font-medium leading-tight">${escapeHtml(d.label)}</h3>
        ${d.summary ? `<p class="graph-card-summary text-sm text-text-muted leading-relaxed">${escapeHtml(d.summary)}</p>` : ""}
        ${renderFields(d.fields)}
        <a href="${articleBase}${d.id}" class="inline-flex items-center justify-center w-full h-10 rounded bg-brand-gradient text-white text-sm font-semibold hover:-translate-y-px transition-transform">
          Открыть статью →
        </a>
      </div>
    `;
  }

  function focusNode(query) {
    if (!cy || !query.trim()) return;
    const q = query.toLowerCase();
    const found = cy
      .nodes()
      .toArray()
      .find((n) => n.data("label").toLowerCase().includes(q));
    if (!found) return;
    cy.animate({
      center: { eles: found },
      zoom: 1.6,
      duration: 600,
      easing: "ease-in-out",
    });
    found.flashClass("focused", 1500);
    renderPreview(found);
  }

  searchEl.addEventListener("input", () => {
    clearTimeout(searchEl._t);
    searchEl._t = setTimeout(() => focusNode(searchEl.value), 200);
  });

  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function savePositions() {
    if (!cy) return;
    const positions = {};
    cy.nodes().forEach((node) => {
      const pos = node.position();
      positions[node.id()] = {
        x: Math.round(pos.x),
        y: Math.round(pos.y),
      };
    });
    try {
      localStorage.setItem(positionsKey, JSON.stringify(positions));
    } catch (err) {
      console.warn("graph positions save failed", err);
    }
  }

  const savePositionsDebounced = debounce(savePositions, 400);

  function applySavedPositions(nodes) {
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem(positionsKey) || "{}");
    } catch (_err) {
      saved = {};
    }
    let applied = 0;
    nodes.forEach((node) => {
      const pos = saved[node.data.id];
      if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;
      node.position = { x: pos.x, y: pos.y };
      applied += 1;
    });
    return applied >= Math.max(1, Math.ceil(nodes.length * 0.6));
  }

  function graphDensity(raw) {
    const nodeCount = raw.nodes.length;
    if (nodeCount < 2) return 0;
    const pairs = new Set();
    raw.edges.forEach((edge) => {
      const source = edge.data.source;
      const target = edge.data.target;
      if (!source || !target || source === target) return;
      pairs.add([source, target].sort().join("::"));
    });
    return pairs.size / ((nodeCount * (nodeCount - 1)) / 2);
  }

  function pickLayout(raw, hasSavedPositions) {
    if (hasSavedPositions) {
      return {
        name: "preset",
        fit: true,
        padding: 80,
      };
    }

    const nodeCount = raw.nodes.length;
    const density = graphDensity(raw);
    if (nodeCount <= 8 && density >= 0.55) {
      return {
        name: "circle",
        animate: true,
        animationDuration: 600,
        fit: true,
        padding: 90,
        radius: Math.max(180, nodeCount * 54),
        avoidOverlap: true,
      };
    }

    return {
      name: "cose",
      animate: true,
      animationDuration: 800,
      nodeRepulsion: 18000,
      nodeOverlap: 24,
      idealEdgeLength: 190,
      edgeElasticity: 45,
      gravity: 0.18,
      numIter: 2500,
      initialTemp: 220,
      coolingFactor: 0.95,
      minTemp: 1,
    };
  }

  if (resetLayoutBtn) {
    resetLayoutBtn.addEventListener("click", () => {
      try {
        localStorage.removeItem(positionsKey);
      } catch (_err) {
        // localStorage может быть недоступен в приватном режиме — просто перезапустим layout.
      }
      if (!cy) return;
      const raw = {
        nodes: cy.nodes().map((node) => ({ data: node.data() })),
        edges: cy.edges().map((edge) => ({ data: edge.data() })),
      };
      cy.layout(pickLayout(raw, false)).run();
    });
  }

  async function init() {
    let raw;
    try {
      const res = await fetch(dataUrl);
      raw = await res.json();
    } catch (err) {
      console.error("graph data failed", err);
      cyEl.innerHTML =
        '<div class="p-8 text-center text-text-muted">Не удалось загрузить граф.</div>';
      return;
    }

    if (raw.nodes.length === 0) {
      cyEl.innerHTML =
        '<div class="h-full flex items-center justify-center text-text-muted text-sm p-6 text-center">В этом мире пока нет статей. Создай хотя бы одну, чтобы увидеть граф.</div>';
      return;
    }

    const hasSavedPositions = applySavedPositions(raw.nodes);

    try {
      cy = cytoscape({
        container: cyEl,
        elements: [...raw.nodes, ...raw.edges],
        style: [
          {
            selector: "node",
            style: {
              "background-color": "data(color)",
              label: "data(initial)",
              color: "#ffffff",
              "font-family": "Newsreader, Georgia, serif",
              "font-weight": 700,
              "font-size": 14,
              "text-valign": "center",
              "text-halign": "center",
              "border-color": "#0B0F1A",
              "border-width": 2,
              width: "data(size)",
              height: "data(size)",
              "overlay-padding": 4,
              "transition-property": "border-color, border-width, opacity",
              "transition-duration": 200,
            },
          },
          {
            selector: "node[?pinned]",
            style: {
              "border-color": "#3B82F6",
              "border-width": 3,
            },
          },
          {
            selector: "edge",
            style: {
              "curve-style": "bezier",
              "line-color": "data(source_color)",
              "line-style": "dashed",
              "line-dash-pattern": [6, 4],
              "line-dash-offset": 0,
              width: 1.8,
              opacity: 0.7,
              "target-arrow-shape": "triangle",
              "target-arrow-color": "data(target_color)",
              "arrow-scale": 1,
              label: "data(label)",
              "font-size": 9,
              color: "#94A3B8",
              "text-rotation": "autorotate",
              "text-background-opacity": 1,
              "text-background-color": "#0B0F1A",
              "text-background-padding": 3,
              "text-background-shape": "roundrectangle",
              "transition-property": "opacity, width",
              "transition-duration": 200,
            },
          },
          {
            selector: "node:selected",
            style: {
              "border-color": "data(color)",
              "border-width": 5,
            },
          },
          {
            selector: ".focused",
            style: {
              "border-color": "#6366F1",
              "border-width": 5,
            },
          },
          {
            selector: "node.hovered",
            style: {
              "border-color": "data(color)",
              "border-width": 4,
            },
          },
          {
            selector: ".faded",
            style: {
              opacity: 0.18,
              "text-opacity": 0.18,
            },
          },
          {
            selector: "edge.highlight",
            style: {
              opacity: 1,
              width: 3,
            },
          },
        ],
        layout: pickLayout(raw, hasSavedPositions),
        wheelSensitivity: 0.3,
        minZoom: 0.2,
        maxZoom: 3,
      });
    } catch (err) {
      console.error("Cytoscape init failed", err);
      cyEl.innerHTML = `<div class="p-6 text-red-400 text-sm">Не удалось построить граф: ${err.message}</div>`;
      return;
    }

    // ─── Бегущий пунктир по рёбрам ───────────────────────
    let dashOffset = 0;
    setInterval(() => {
      if (!cy) return;
      dashOffset = (dashOffset - 1) % 1000;
      cy.edges().forEach((e) => {
        if (e.style("display") !== "none") {
          e.style("line-dash-offset", dashOffset);
        }
      });
    }, 60);

    // ─── Hover: подсветка связанных, тускнение остальных + tooltip ───
    cy.on("mouseover", "node", (e) => {
      const node = e.target;
      const neighborhood = node.closedNeighborhood();
      cy.elements().difference(neighborhood).addClass("faded");
      neighborhood.removeClass("faded");
      node.addClass("hovered");
      node.connectedEdges().addClass("highlight");
      showTooltip(node, e.renderedPosition);
    });
    cy.on("mouseout", "node", (e) => {
      cy.elements().removeClass("faded");
      e.target.removeClass("hovered");
      cy.edges().removeClass("highlight");
      hideTooltip();
    });
    cy.on("mousemove", (e) => {
      if (!tooltipEl.classList.contains("hidden"))
        moveTooltip(e.renderedPosition);
    });

    // ─── Клики ───────────────────────────────────────────
    cy.on("tap", "node", (e) => renderPreview(e.target));
    cy.on("layoutstop", savePositionsDebounced);
    cy.on("dragfree", "node", savePositionsDebounced);
    cy.on("dbltap", "node", (e) => {
      window.location.href = articleBase + e.target.data("id");
    });
    cy.on("tap", (e) => {
      if (e.target === cy) renderPreview(null);
    });
  }

  init();
})();
