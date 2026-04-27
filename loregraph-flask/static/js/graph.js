// Граф связей через Cytoscape: force-layout (cose), фильтры, поиск, превью узла.

(function () {
  const root = document.querySelector('[data-data-url]');
  if (!root) return;

  const dataUrl = root.dataset.dataUrl;
  const articleBase = root.dataset.articleBase;
  const cyEl = document.getElementById('cy');
  const previewEl = document.getElementById('node-preview');
  const searchEl = document.getElementById('graph-search');
  const filtersEl = document.getElementById('graph-filters');

  let cy;
  let allNodes = [];
  let allEdges = [];
  const hiddenCats = new Set(); // category_id или 'none'

  // Раскрашивание чипа фильтра
  function paintFilterPill(pill) {
    const active = pill.dataset.active === 'true';
    const color = pill.dataset.color;
    pill.style.color = active ? color : '#475569';
    pill.style.backgroundColor = active ? color + '1A' : 'transparent';
    pill.style.borderColor = active ? color + '55' : 'rgba(255,255,255,0.08)';
    pill.style.opacity = active ? '1' : '0.55';
    const dot = pill.querySelector('span');
    if (dot) dot.style.backgroundColor = active ? color : '#475569';
  }

  filtersEl.querySelectorAll('.cat-pill').forEach(paintFilterPill);

  function applyFilters() {
    if (!cy) return;
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        const cat = n.data('category_id') || 'none';
        n.style('display', hiddenCats.has(cat) ? 'none' : 'element');
      });
      cy.edges().forEach((e) => {
        const sVisible = e.source().style('display') !== 'none';
        const tVisible = e.target().style('display') !== 'none';
        e.style('display', sVisible && tVisible ? 'element' : 'none');
      });
    });
  }

  filtersEl.querySelectorAll('.cat-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const id = pill.dataset.catId;
      const active = pill.dataset.active === 'true';
      const next = !active;
      pill.dataset.active = String(next);
      if (next) hiddenCats.delete(id);
      else hiddenCats.add(id);
      paintFilterPill(pill);
      applyFilters();
    });
  });

  function renderPreview(node) {
    if (!node) {
      previewEl.className = 'rounded-lg border border-dashed border-border-strong p-6 text-sm text-text-muted text-center';
      previewEl.innerHTML = 'Кликни на узел, чтобы увидеть его карточку.';
      return;
    }
    const d = node.data();
    previewEl.className = 'rounded-lg border border-border bg-bg-surface/60 p-5 space-y-3 sticky top-20';
    previewEl.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="h-2 w-2 rounded-full shrink-0" style="background:${d.color}"></span>
        <span class="text-xs uppercase tracking-wider font-medium" style="color:${d.color}">${escapeHtml(d.category)}</span>
      </div>
      <h3 class="font-serif text-2xl font-medium leading-tight">${escapeHtml(d.label)}</h3>
      ${d.summary ? `<p class="text-sm text-text-muted leading-relaxed">${escapeHtml(d.summary)}</p>` : ''}
      <a href="${articleBase}${d.id}" class="inline-flex items-center justify-center w-full h-10 rounded bg-brand-gradient text-white text-sm font-semibold hover:-translate-y-px transition-transform">
        Открыть статью →
      </a>
    `;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function focusNode(query) {
    if (!cy || !query.trim()) return;
    const q = query.toLowerCase();
    const found = cy.nodes().toArray().find((n) => n.data('label').toLowerCase().includes(q));
    if (!found) return;
    cy.animate({ center: { eles: found }, zoom: 1.6, duration: 600, easing: 'ease-in-out' });
    found.flashClass('focused', 1200);
    renderPreview(found);
  }

  searchEl.addEventListener('input', () => {
    clearTimeout(searchEl._t);
    searchEl._t = setTimeout(() => focusNode(searchEl.value), 200);
  });

  async function init() {
    let raw;
    try {
      const res = await fetch(dataUrl);
      raw = await res.json();
    } catch (err) {
      console.error('graph data failed', err);
      cyEl.innerHTML = '<div class="p-8 text-center text-text-muted">Не удалось загрузить граф.</div>';
      return;
    }

    allNodes = raw.nodes;
    allEdges = raw.edges;

    if (allNodes.length === 0) {
      cyEl.innerHTML = '<div class="h-full flex items-center justify-center text-text-muted text-sm">В этом мире пока нет статей. Создай хотя бы одну, чтобы увидеть граф.</div>';
      return;
    }

    cy = cytoscape({
      container: cyEl,
      elements: [...allNodes, ...allEdges],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'label': 'data(label)',
            'color': '#F1F5F9',
            'font-family': 'Space Grotesk, sans-serif',
            'font-size': 12,
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-outline-width': 2,
            'text-outline-color': '#0B0F1A',
            'border-color': '#0B0F1A',
            'border-width': 2,
            'width': 28,
            'height': 28,
          },
        },
        {
          selector: 'node[?pinned]',
          style: { 'width': 36, 'height': 36, 'border-color': '#3B82F6', 'border-width': 3 },
        },
        {
          selector: 'edge',
          style: {
            'curve-style': 'bezier',
            'line-color': 'rgba(148,163,184,0.4)',
            'target-arrow-color': 'rgba(148,163,184,0.6)',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.9,
            'width': 1.5,
            'label': 'data(label)',
            'font-size': 9,
            'color': '#64748B',
            'text-rotation': 'autorotate',
            'text-background-opacity': 1,
            'text-background-color': '#0B0F1A',
            'text-background-padding': 2,
          },
        },
        {
          selector: 'node:selected',
          style: { 'border-color': '#3B82F6', 'border-width': 4 },
        },
        {
          selector: '.focused',
          style: { 'border-color': '#6366F1', 'border-width': 5 },
        },
      ],
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 600,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 110,
        edgeElasticity: () => 80,
        gravity: 0.4,
        numIter: 1500,
      },
      wheelSensitivity: 0.3,
      minZoom: 0.2,
      maxZoom: 3,
    });

    cy.on('tap', 'node', (e) => renderPreview(e.target));
    cy.on('dbltap', 'node', (e) => {
      window.location.href = articleBase + e.target.data('id');
    });
    cy.on('tap', (e) => {
      if (e.target === cy) renderPreview(null);
    });
  }

  init();
})();
