// Автокомплит для добавления связи.

(function () {
  const form = document.getElementById('relation-form');
  if (!form) return;

  const searchUrl = form.dataset.searchUrl;
  const exclude = form.dataset.exclude;
  const input = document.getElementById('rel-search');
  const matches = document.getElementById('rel-matches');
  const targetIdInput = document.getElementById('rel-target-id');
  const submitBtn = document.getElementById('rel-submit');
  const labelInput = form.querySelector('input[name="label"]');

  let timer = null;

  function updateSubmit() {
    submitBtn.disabled = !(targetIdInput.value && labelInput.value.trim());
  }

  function clearMatches() {
    matches.innerHTML = '';
    matches.classList.add('hidden');
  }

  function selectTarget(id, title) {
    targetIdInput.value = id;
    input.value = title;
    input.disabled = true;
    clearMatches();
    updateSubmit();
  }

  input.addEventListener('input', () => {
    targetIdInput.value = '';
    updateSubmit();
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) {
      clearMatches();
      return;
    }
    timer = setTimeout(async () => {
      try {
        const url = `${searchUrl}?q=${encodeURIComponent(q)}&exclude=${encodeURIComponent(exclude)}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.results.length) {
          matches.innerHTML = '<li class="px-3 py-2 text-xs text-text-dim">Ничего не найдено</li>';
          matches.classList.remove('hidden');
          return;
        }
        matches.innerHTML = '';
        for (const item of data.results) {
          const li = document.createElement('li');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = item.title;
          btn.addEventListener('click', () => selectTarget(item.id, item.title));
          li.appendChild(btn);
          matches.appendChild(li);
        }
        matches.classList.remove('hidden');
      } catch (err) {
        console.error('search failed', err);
      }
    }, 200);
  });

  // Клик мимо — закрыть выпадашку
  document.addEventListener('click', (e) => {
    if (!form.contains(e.target)) clearMatches();
  });

  // Сменить выбранную статью
  input.addEventListener('dblclick', () => {
    if (input.disabled) {
      input.disabled = false;
      input.value = '';
      targetIdInput.value = '';
      updateSubmit();
      input.focus();
    }
  });

  labelInput.addEventListener('input', updateSubmit);

  // Пресеты
  form.querySelectorAll('.preset-label').forEach((b) => {
    b.addEventListener('click', () => {
      labelInput.value = b.dataset.preset;
      updateSubmit();
    });
  });
})();
