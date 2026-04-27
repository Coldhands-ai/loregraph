// Граф связей через Cytoscape.
//
// Что делает живым:
// - размер узла по data(size) (рассчитан из weight категории)
// - внутри узла — первая буква, под узлом — мелкое название (растёт при hover)
// - градиент рёбер source.color → target.color
// - selected-обводка цветом узла
// - бегущая пунктирная анимация по рёбрам (поток энергии)
// - на hover: связанные подсвечиваются, остальные тускнеют
// - hover-tooltip с превью (категория, обложка, summary)
// - 2× клик по узлу — открыть статью

(function () {
  const root = document.querySelector('[data-data-url]');
  if (!root) return;

  const dataUrl = root.dataset.dataUrl;
  const articleBase = root.dataset.articleBase;
  const cyEl = document.getElementById('cy');
  const previewEl = document.getElementById('node-preview');
  const searchEl = document.getElementById('graph-search');
  const filtersEl = document.getElementById('graph-filters');
  const tooltipEl = document.getElementById('cy-tooltip');

  let cy;
  const hiddenCats = new Set();

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
        const visible = e.source().style('display') !== 'none' && e.target().style('display') !== 'none';
        e.style('display', visible ? 'element' : 'none');
      });
    });
  }

  filtersEl.querySelectorAll('.cat-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const id = pill.dataset.catId;
      const next = pill.dataset.active !== 'true';
      pill.dataset.active = String(next);
      next ? hiddenCats.delete(id) : hiddenCats.add(id);
      paintFilterPill(pill);
      applyFilters();
    });
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function renderTooltip(node) {
    const d = node.data();
    const cover = d.image_url
      ? `<div class="w-full h-20 rounded-md mb-2 -mt-1 -mx-1 overflow-hidden" style="background:url('${d.image_url}') center/cover"></div>`
      : '';
    return `
      ${cover}
      <div class="flex items-center gap-2 mb-1">
        <span class="h-1.5 w-1.5 rounded-full shrink-0" style="background:${d.color}"></span>
        <span class="text-[10px] uppercase tracking-wider font-medium" style="color:${d.color}">${escapeHtml(d.category)}</span>
      </div>
      <div class="font-serif text-base leading-tight text-text">${escapeHtml(d.label)}</div>
      ${d.summary ? `<div class="mt-1.5 text-xs text-text-muted line-clamp-3 leading-relaxed">${escapeHtml(d.summary)}</div>` : ''}
    `;
  }

  function showTooltip(node, evtPosition) {
    tooltipEl.innerHTML = renderTooltip(node);
    tooltipEl.classList.remove('hidden');
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
    tooltipEl.classList.add('hidden');
  }

  function renderPreview(node) {
    if (!node) {
      previewEl.className = 'rounded-lg border border-dashed border-border-strong p-6 text-sm text-text-muted text-center sticky top-20';
      previewEl.innerHTML = 'Кликни на узел, чтобы увидеть его карточку.';
      return;
    }
    const d = node.data();
    previewEl.className = 'rounded-lg border border-border bg-bg-surface/70 overflow-hidden sticky top-20 animate-fade-in';
    const cover = d.image_url
      ? `<div class="w-full aspect-[16/9]" style="background:url('${d.image_url}') center/cover"></div>`
      : `<div class="w-full aspect-[16/9] flex items-center justify-center" style="background:linear-gradient(135deg, ${d.color}33, ${d.color}11)">
           <span class="font-serif text-6xl font-bold opacity-90" style="color:${d.color}">${escapeHtml(d.initial)}</span>
         </div>`;
    previewEl.innerHTML = `
      ${cover}
      <div class="p-5 space-y-3">
        <div class="flex items-center gap-2">
          <span class="h-2 w-2 rounded-full shrink-0" style="background:${d.color}"></span>
          <span class="text-xs uppercase tracking-wider font-medium" style="color:${d.color}">${escapeHtml(d.category)}</span>
        </div>
        <h3 class="font-serif text-2xl font-medium leading-tight">${escapeHtml(d.label)}</h3>
        ${d.summary ? `<p class="text-sm text-text-muted leading-relaxed">${escapeHtml(d.summary)}</p>` : ''}
        <a href="${articleBase}${d.id}" class="inline-flex items-center justify-center w-full h-10 rounded bg-brand-gradient text-white text-sm font-semibold hover:-translate-y-px transition-transform">
          Открыть статью →
        </a>
      </div>
    `;
  }

  function focusNode(query) {
    if (!cy || !query.trim()) return;
    const q = query.toLowerCase();
    const found = cy.nodes().toArray().find((n) => n.data('label').toLowerCase().includes(q));
    if (!found) return;
    cy.animate({ center: { eles: found }, zoom: 1.6, duration: 600, easing: 'ease-in-out' });
    found.flashClass('focused', 1500);
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

    if (raw.nodes.length === 0) {
      cyEl.innerHTML = '<div class="h-full flex items-center justify-center text-text-muted text-sm p-6 text-center">В этом мире пока нет статей. Создай хотя бы одну, чтобы увидеть граф.</div>';
      return;
    }

    cy = cytoscape({
      container: cyEl,
      elements: [...raw.nodes, ...raw.edges],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'background-opacity': 0.95,
            'label': 'data(initial)',
            'color': '#ffffff',
            'font-family': 'Newsreader, Georgia, serif',
            'font-weight': 700,
            'font-size': (n) => Math.round(n.data('size') * 0.45),
            'text-valign': 'center',
            'text-halign': 'center',
            'text-outline-width': 0,
            'border-color': '#0B0F1A',
            'border-width': 2,
            'border-opacity': 0.9,
            'width': 'data(size)',
            'height': 'data(size)',
            'overlay-padding': 4,
            'transition-property': 'border-color, border-width, background-opacity',
            'transition-duration': 200,
          },
        },
        // Подпись под узлом — отдельной техникой (через ghost-node не делаем).
        // Используем дополнительный label через text-halign не позволит, поэтому
        // подпись рендерится только на hover/select через class .with-name.
        {
          selector: 'node.with-name',
          style: {
            'text-margin-y': 0,
            'font-family': 'Space Grotesk, sans-serif',
            'font-weight': 500,
          },
        },
        {
          selector: 'node[?pinned]',
          style: {
            'border-color': '#3B82F6',
            'border-width': 3,
          },
        },
        {
          selector: 'edge',
          style: {
            'curve-style': 'bezier',
            'line-fill': 'linear-gradient',
            'line-gradient-stop-colors': 'data(source_color) data(target_color)',
            'line-gradient-stop-positions': '0 100',
            'line-style': 'dashed',
            'line-dash-pattern': [6, 4],
            'line-dash-offset': 0,
            'width': 1.6,
            'opacity': 0.85,
            'target-arrow-shape': 'triangle',
            'target-arrow-color': 'data(target_color)',
            'arrow-scale': 0.9,
            'label': 'data(label)',
            'font-size': 9,
            'color': '#94A3B8',
            'text-rotation': 'autorotate',
            'text-background-opacity': 1,
            'text-background-color': '#0B0F1A',
            'text-background-padding': 3,
            'text-background-shape': 'roundrectangle',
            'transition-property': 'opacity, width',
            'transition-duration': 200,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': 'data(color)',
            'border-width': 5,
            'border-opacity': 1,
          },
        },
        {
          selector: '.focused',
          style: {
            'border-color': '#6366F1',
            'border-width': 5,
            'border-opacity': 1,
          },
        },
        {
          selector: 'node.hovered',
          style: {
            'background-opacity': 1,
            'border-color': 'data(color)',
            'border-width': 4,
          },
        },
        {
          selector: '.faded',
          style: {
            'opacity': 0.18,
            'text-opacity': 0.18,
          },
        },
        {
          selector: 'edge.highlight',
          style: {
            'opacity': 1,
            'width': 2.5,
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 700,
        nodeRepulsion: () => 9000,
        idealEdgeLength: () => 130,
        edgeElasticity: () => 80,
        gravity: 0.4,
        numIter: 1500,
      },
      wheelSensitivity: 0.3,
      minZoom: 0.2,
      maxZoom: 3,
    });

    // ─── Бегущий пунктир по рёбрам ───────────────────────
    let dashOffset = 0;
    setInterval(() => {
      if (!cy) return;
      dashOffset = (dashOffset - 1) % 1000;
      cy.edges().forEach((e) => {
        if (e.style('display') !== 'none') {
          e.style('line-dash-offset', dashOffset);
        }
      });
    }, 60);

    // ─── Hover: подсветка связанных, тускнение остальных + tooltip ───
    cy.on('mouseover', 'node', (e) => {
      const node = e.target;
      const neighborhood = node.closedNeighborhood();
      cy.elements().difference(neighborhood).addClass('faded');
      neighborhood.removeClass('faded');
      node.addClass('hovered');
      node.connectedEdges().addClass('highlight');
      showTooltip(node, e.renderedPosition);
    });
    cy.on('mouseout', 'node', (e) => {
      cy.elements().removeClass('faded');
      e.target.removeClass('hovered');
      cy.edges().removeClass('highlight');
      hideTooltip();
    });
    cy.on('mousemove', (e) => {
      if (!tooltipEl.classList.contains('hidden')) moveTooltip(e.renderedPosition);
    });

    // ─── Клики ───────────────────────────────────────────
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
