// Редактор статьи: Toast UI Editor (WYSIWYG + Markdown), автосейв 2с,
// смена названия / категории, заполнение полей шаблона, закрепление.

(function () {
  const root = document.querySelector('[data-article-id]');
  if (!root) return;

  const worldId = root.dataset.worldId;
  const articleId = root.dataset.articleId;
  const csrf = root.dataset.csrf;
  const indicator = document.getElementById('save-indicator');
  const titleInput = document.getElementById('title-input');
  const editorEl = document.getElementById('md-editor');

  function setIndicator(state, customText) {
    if (!indicator) return;
    const map = {
      saving: { text: 'Сохраняем…', cls: 'text-text-dim' },
      saved:  { text: 'Сохранено',  cls: 'text-text-dim' },
      dirty:  { text: 'Изменения не сохранены', cls: 'text-amber-400' },
      error:  { text: 'Ошибка сохранения', cls: 'text-red-400' },
    };
    const s = map[state] || map.saved;
    indicator.textContent = customText || s.text;
    indicator.className = 'text-xs ' + s.cls;
    // Тултип: полный текст ошибки доступен по hover, если в индикаторе обрезался.
    indicator.title = customText || '';
  }

  async function persist(patch) {
    setIndicator('saving');
    try {
      const res = await fetch(`/worlds/${worldId}/articles/${articleId}/autosave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = (data && data.error) || `Ошибка сохранения (${res.status})`;
        console.error('autosave failed:', msg);
        setIndicator('error', msg);
        return;
      }
      setIndicator('saved');
    } catch (err) {
      console.error('autosave failed', err);
      setIndicator('error');
    }
  }

  // Буферизованный дебаунс: пока таймер тикает, накапливаем все патчи в
  // один объект и отправляем их одним запросом. Обычный debounce
  // сохранял бы только args последнего вызова — и при быстром
  // переключении (поле → редактор) поля терялись.
  // Плюс сериализация через цепочку промисов, чтобы два запроса не ушли
  // одновременно при долгой сети.
  let _pendingPatch = {};
  let _pendingTimer = null;
  let _inflight = Promise.resolve();

  function persistDebounced(patch) {
    Object.assign(_pendingPatch, patch);
    if (_pendingTimer) clearTimeout(_pendingTimer);
    _pendingTimer = setTimeout(() => {
      const toSend = _pendingPatch;
      _pendingPatch = {};
      _pendingTimer = null;
      _inflight = _inflight.then(() => persist(toSend));
    }, 2000);
  }

  // ─── Toast UI Editor ─────────────────────────────────────
  const initialEl = document.getElementById('md-initial');
  const initial = initialEl ? initialEl.value : '';

  // Флаг готовности — игнорируем change-события, которые Toast UI стреляет
  // в момент инициализации (иначе пустой автосейв затрёт контент).
  let ready = false;

  const editor = new toastui.Editor({
    el: editorEl,
    height: '600px',
    initialEditType: 'wysiwyg',
    previewStyle: 'vertical',
    initialValue: initial,
    theme: 'dark',
    placeholder: 'Начни писать… Что случилось в этом мире?',
    usageStatistics: false,
    autofocus: false,
    toolbarItems: [
      ['heading', 'bold', 'italic', 'strike'],
      ['hr', 'quote'],
      ['ul', 'ol', 'task'],
      ['table', 'image', 'link'],
      ['code', 'codeblock'],
      ['scrollSync'],
    ],
    events: {
      change: () => {
        if (!ready) return;
        setIndicator('dirty');
        persistDebounced({ content_md: editor.getMarkdown() });
      },
    },
  });

  // Один тик после инициализации — теперь любые изменения это уже от пользователя
  setTimeout(() => { ready = true; }, 200);

  // ─── Название ────────────────────────────────────────────
  if (titleInput) {
    titleInput.addEventListener('input', (e) => {
      setIndicator('dirty');
      persistDebounced({ title: e.target.value });
    });
  }

  // ─── Категория ───────────────────────────────────────────
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
      // Прокидываем title и content одним патчем — иначе несохранённые
      // изменения в редакторе потерялись бы при reload.
      await persist({
        category_id: id,
        title: titleInput ? titleInput.value : undefined,
        content_md: editor.getMarkdown(),
      });
      // Перезагружаем страницу, чтобы появились/исчезли поля шаблона новой категории
      setTimeout(() => window.location.reload(), 250);
    });
  });

  // ─── Поля шаблона (template_fields) ──────────────────────
  function collectFieldValues() {
    const out = {};
    document.querySelectorAll('.field-input[data-field-key]').forEach((el) => {
      out[el.dataset.fieldKey] = el.value;
    });
    return out;
  }
  document.querySelectorAll('.field-input[data-field-key]').forEach((el) => {
    el.addEventListener('input', () => {
      setIndicator('dirty');
      persistDebounced({ field_values: collectFieldValues() });
    });
  });

  // ─── Теги ────────────────────────────────────────────────
  // tags.js шлёт CustomEvent с актуальным списком имён — отправляем в autosave.
  document.addEventListener('tags:change', (e) => {
    setIndicator('dirty');
    persistDebounced({ tags: e.detail.tags });
  });

  // ─── Закрепление ─────────────────────────────────────────
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
        pinBtn.className = pinned
          ? 'h-9 w-9 inline-flex items-center justify-center rounded transition-colors bg-brand-gradient text-white'
          : 'h-9 w-9 inline-flex items-center justify-center rounded transition-colors text-text-muted hover:bg-bg-surface2 hover:text-text';
      } catch (err) {
        console.error('pin failed', err);
      }
    });
  }

  // ─── Закладка ────────────────────────────────────────────
  const bmBtn = document.getElementById('bookmark-btn');
  if (bmBtn) {
    bmBtn.addEventListener('click', async () => {
      try {
        const res = await fetch(`/worlds/${worldId}/articles/${articleId}/bookmark`, {
          method: 'POST',
          headers: { 'X-CSRFToken': csrf },
        });
        const data = await res.json();
        const on = data.bookmarked;
        bmBtn.dataset.bookmarked = String(on);
        bmBtn.textContent = on ? '★' : '☆';
        bmBtn.className = on
          ? 'h-9 w-9 inline-flex items-center justify-center rounded transition-colors text-lg text-amber-400'
          : 'h-9 w-9 inline-flex items-center justify-center rounded transition-colors text-lg text-text-muted hover:bg-bg-surface2 hover:text-amber-400';
      } catch (err) {
        console.error('bookmark failed', err);
      }
    });
  }
})();
