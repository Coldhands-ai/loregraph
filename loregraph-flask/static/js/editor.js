// Редактор статьи: EasyMDE + автосейв (debounce 2с) + смена названия и категории.

(function () {
  const root = document.querySelector('[data-article-id]');
  if (!root) return;

  const worldId = root.dataset.worldId;
  const articleId = root.dataset.articleId;
  const csrf = root.dataset.csrf;
  const indicator = document.getElementById('save-indicator');
  const titleInput = document.getElementById('title-input');
  const editorEl = document.getElementById('md-editor');

  function setIndicator(state) {
    if (!indicator) return;
    const map = {
      idle: { text: 'Сохранено', cls: 'text-text-dim' },
      saving: { text: 'Сохраняем…', cls: 'text-text-dim' },
      saved: { text: 'Сохранено', cls: 'text-text-dim' },
      dirty: { text: 'Изменения не сохранены', cls: 'text-text-dim' },
      error: { text: 'Ошибка сохранения', cls: 'text-red-400' },
    };
    const s = map[state] || map.idle;
    indicator.textContent = s.text;
    indicator.className = 'text-xs ' + s.cls;
  }

  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  async function persist(patch) {
    setIndicator('saving');
    try {
      const res = await fetch(`/worlds/${worldId}/articles/${articleId}/autosave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrf,
        },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
      setIndicator('saved');
    } catch (err) {
      console.error('autosave failed', err);
      setIndicator('error');
    }
  }

  const persistDebounced = debounce(persist, 2000);

  // EasyMDE
  const easyMDE = new EasyMDE({
    element: editorEl,
    autofocus: false,
    spellChecker: false,
    placeholder: 'Начни писать… Что случилось в этом мире?',
    status: ['lines', 'words'],
    toolbar: [
      'bold', 'italic', 'strikethrough', 'heading-1', 'heading-2', 'heading-3', '|',
      'unordered-list', 'ordered-list', 'quote', 'code', '|',
      'link', 'image', 'horizontal-rule', '|',
      'preview', 'side-by-side', 'fullscreen', '|',
      'guide',
    ],
    minHeight: '480px',
    shortcuts: { drawTable: 'Cmd-Alt-T' },
  });

  easyMDE.codemirror.on('change', () => {
    setIndicator('dirty');
    persistDebounced({ content_md: easyMDE.value() });
  });

  if (titleInput) {
    titleInput.addEventListener('input', (e) => {
      setIndicator('dirty');
      persistDebounced({ title: e.target.value });
    });
  }

  // Смена категории
  document.querySelectorAll('.cat-option').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.catId || null;
      const name = btn.dataset.catName;
      const color = btn.dataset.catColor;
      const trigger = btn.closest('[x-data]')?.querySelector('button');
      if (trigger) {
        trigger.style.color = id ? color : '#94A3B8';
        trigger.style.backgroundColor = id ? color + '1A' : 'transparent';
        trigger.style.borderColor = id ? color + '55' : 'rgba(148,163,184,0.3)';
        const dot = trigger.querySelector('span');
        if (dot) dot.style.backgroundColor = color;
        const label = trigger.querySelector('#cat-label');
        if (label) label.textContent = name;
      }
      await persist({ category_id: id });
    });
  });

  // Закрепление
  const pinBtn = document.getElementById('pin-btn');
  if (pinBtn) {
    pinBtn.addEventListener('click', async () => {
      try {
        const res = await fetch(`/worlds/${worldId}/articles/${articleId}/pin`, {
          method: 'POST',
          headers: { 'X-CSRFToken': csrf },
        });
        const data = await res.json();
        const pinned = data.is_pinned;
        pinBtn.dataset.pinned = String(pinned);
        if (pinned) {
          pinBtn.className = 'h-9 w-9 inline-flex items-center justify-center rounded transition-colors bg-brand-gradient text-white';
        } else {
          pinBtn.className = 'h-9 w-9 inline-flex items-center justify-center rounded transition-colors text-text-muted hover:bg-bg-surface2 hover:text-text';
        }
      } catch (err) {
        console.error('pin failed', err);
      }
    });
  }
})();
