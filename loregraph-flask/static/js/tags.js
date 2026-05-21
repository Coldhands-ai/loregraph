// Чипсы тегов в редакторе. Получает url автокомплита из data-аттрибута
// контейнера. При любом изменении отправляет CustomEvent('tags:change')
// с detail = { tags: ['имя', ...] }. editor.js слушает и кидает в autosave.

(function () {
  const container = document.getElementById('tags-block');
  if (!container) return;

  const listEl = container.querySelector('[data-tag-list]');
  const input = container.querySelector('input[data-tag-input]');
  const suggestionsEl = container.querySelector('[data-tag-suggestions]');
  const searchUrl = container.dataset.searchUrl;
  const maxTags = parseInt(container.dataset.maxTags || '20', 10);

  let suggestTimer = null;

  function currentTagNames() {
    return Array.from(listEl.querySelectorAll('.tag-chip[data-tag-name]'))
      .map((el) => el.dataset.tagName);
  }

  function emitChange() {
    document.dispatchEvent(new CustomEvent('tags:change', {
      detail: { tags: currentTagNames() },
    }));
  }

  function makeChip(name) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip inline-flex items-center gap-1 rounded-full bg-brand/10 border border-brand/30 text-brand px-2.5 py-0.5 text-xs';
    chip.dataset.tagName = name;

    const label = document.createElement('span');
    label.textContent = name;
    chip.appendChild(label);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ml-0.5 text-brand/70 hover:text-red-400 transition-colors';
    btn.setAttribute('aria-label', 'Убрать');
    btn.textContent = '×';
    btn.addEventListener('click', () => {
      chip.remove();
      emitChange();
    });
    chip.appendChild(btn);
    return chip;
  }

  function addTag(name) {
    name = (name || '').trim().slice(0, 50);
    if (!name) return;
    const existing = currentTagNames();
    if (existing.includes(name)) return;
    if (existing.length >= maxTags) {
      // молча игнорим — UI лимит
      return;
    }
    // Вставляем перед input-wrapper'ом
    const wrapper = listEl.querySelector('[data-tag-input-wrapper]');
    listEl.insertBefore(makeChip(name), wrapper);
    input.value = '';
    hideSuggestions();
    emitChange();
  }

  function hideSuggestions() {
    suggestionsEl.innerHTML = '';
    suggestionsEl.classList.add('hidden');
  }

  function showSuggestions(items) {
    suggestionsEl.innerHTML = '';
    if (items.length === 0) {
      hideSuggestions();
      return;
    }
    for (const item of items) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'block w-full text-left px-3 py-1.5 text-xs hover:bg-bg-surface2 transition-colors';
      btn.textContent = item.name;
      btn.addEventListener('click', () => addTag(item.name));
      li.appendChild(btn);
      suggestionsEl.appendChild(li);
    }
    suggestionsEl.classList.remove('hidden');
  }

  // ─── Существующие чипы из шаблона ──────────────────
  listEl.querySelectorAll('.tag-chip .tag-remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.tag-chip').remove();
      emitChange();
    });
  });

  // ─── Input ─────────────────────────────────────────
  input.addEventListener('input', () => {
    clearTimeout(suggestTimer);
    const q = input.value.trim();
    if (!q) {
      hideSuggestions();
      return;
    }
    suggestTimer = setTimeout(async () => {
      try {
        const res = await fetch(`${searchUrl}?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        const exclude = new Set(currentTagNames());
        showSuggestions((data.results || []).filter((t) => !exclude.has(t.name)));
      } catch (err) {
        console.error('tags autocomplete failed', err);
      }
    }, 180);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(input.value);
    } else if (e.key === 'Backspace' && input.value === '') {
      // Backspace на пустом инпуте удаляет последний чип
      const chips = listEl.querySelectorAll('.tag-chip');
      if (chips.length) {
        chips[chips.length - 1].remove();
        emitChange();
      }
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  });

  // Клик мимо — закрыть выпадашку
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) hideSuggestions();
  });
})();
