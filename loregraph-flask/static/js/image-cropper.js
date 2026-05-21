// Универсальный кроппер для обложек и аватаров.
// Если Cropper.js или модалка недоступны — change на data-cropper-input
// сразу отправляет форму с исходным файлом (без обрезки).

(function () {
  window.LoreGraphCropper = window.LoreGraphCropper || { ready: false };

  const modal = document.getElementById('cropper-modal');
  const imageEl = document.getElementById('cropper-image');
  const titleEl = document.getElementById('cropper-title');
  const applyBtn = modal ? modal.querySelector('[data-cropper-apply]') : null;
  const zoomButtons = modal ? modal.querySelectorAll('[data-cropper-zoom]') : [];
  const rotateButtons = modal ? modal.querySelectorAll('[data-cropper-rotate]') : [];
  const resetBtn = modal ? modal.querySelector('[data-cropper-reset]') : null;
  const closeButtons = modal ? modal.querySelectorAll('[data-cropper-close]') : [];
  const fileInputs = document.querySelectorAll('input[type="file"][data-cropper-input]');

  const cropperAvailable =
    !!modal && !!imageEl && !!titleEl && !!applyBtn && typeof window.Cropper !== 'undefined';

  function submitForm(form) {
    if (!form) return;
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      form.submit();
    }
  }

  // Единый change-листенер на каждом input: если кроппер доступен — открываем модалку,
  // иначе сразу отправляем форму. Никаких inline onchange в шаблонах не нужно.
  fileInputs.forEach((input) => {
    input.addEventListener('change', () => {
      if (!input.files || !input.files[0]) return;
      if (cropperAvailable) {
        open(input);
      } else {
        submitForm(input.form);
      }
    });
  });

  if (!cropperAvailable) {
    console.warn(
      '[LoreGraphCropper] Cropper.js или модалка недоступны: формы будут отправлять файлы без обрезки.'
    );
    return;
  }

  const state = {
    input: null,
    form: null,
    file: null,
    cropper: null,
    objectUrl: null,
    aspectRatio: NaN,
    outputWidth: null,
    outputHeight: null,
  };

  function parseAspectRatio(raw) {
    if (!raw) return NaN;
    if (raw.includes('/')) {
      const [w, h] = raw.split('/').map((part) => Number(part.trim()));
      return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? w / h : NaN;
    }
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : NaN;
  }

  function parsePositiveInt(raw) {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }

  function destroyCropper() {
    if (state.cropper) {
      state.cropper.destroy();
      state.cropper = null;
    }
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = null;
    }
  }

  function setVisible(visible) {
    modal.style.display = visible ? 'flex' : 'none';
    modal.setAttribute('aria-hidden', visible ? 'false' : 'true');
    document.body.style.overflow = visible ? 'hidden' : '';
  }

  function closeModal(clearSelection) {
    destroyCropper();
    setVisible(false);
    if (clearSelection && state.input) {
      state.input.value = '';
    }
    state.input = null;
    state.form = null;
    state.file = null;
  }

  function canvasToBlob(canvas, type) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), type, 0.92);
    });
  }

  async function canvasToFile(canvas, baseName) {
    let blob = await canvasToBlob(canvas, 'image/webp');
    if (!blob) {
      blob = await canvasToBlob(canvas, 'image/png');
    }
    if (!blob) {
      throw new Error('Не удалось подготовить изображение.');
    }
    const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
    const name = `${baseName}.${ext}`;
    return new File([blob], name, { type: blob.type || `image/${ext}` });
  }

  function open(input) {
    const file = input.files && input.files[0];
    if (!file) return;

    destroyCropper();
    state.input = input;
    state.form = input.form;
    state.file = file;
    state.aspectRatio = parseAspectRatio(input.dataset.cropperAspect || '');
    state.outputWidth = parsePositiveInt(input.dataset.cropperMaxWidth || '');
    state.outputHeight = parsePositiveInt(input.dataset.cropperMaxHeight || '');

    titleEl.textContent = input.dataset.cropperTitle || 'Подгони область';
    imageEl.alt = file.name;
    setVisible(true);

    const objectUrl = URL.createObjectURL(file);
    state.objectUrl = objectUrl;
    imageEl.onload = () => {
      if (state.objectUrl !== objectUrl || state.input !== input) return;
      const options = {
        viewMode: 1,
        dragMode: 'move',
        background: false,
        autoCropArea: 1,
        responsive: true,
      };
      if (Number.isFinite(state.aspectRatio)) {
        options.aspectRatio = state.aspectRatio;
      }
      state.cropper = new Cropper(imageEl, options);
    };
    imageEl.src = state.objectUrl;
  }

  async function applyCrop() {
    if (!state.cropper || !state.input || !state.form) return;

    const form = state.form;
    const canvasOptions = {};
    if (state.outputWidth) canvasOptions.width = state.outputWidth;
    if (state.outputHeight) canvasOptions.height = state.outputHeight;

    const canvas = state.cropper.getCroppedCanvas(canvasOptions);
    if (!canvas) return;

    const baseName = (state.file && state.file.name ? state.file.name : 'cropped').replace(/\.[^.]+$/, '');
    const file = await canvasToFile(canvas, baseName);
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    state.input.files = dataTransfer.files;

    closeModal(false);
    submitForm(form);
  }

  zoomButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!state.cropper) return;
      state.cropper.zoom(Number(btn.dataset.cropperZoom || '0'));
    });
  });

  rotateButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!state.cropper) return;
      state.cropper.rotate(Number(btn.dataset.cropperRotate || '0'));
    });
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (state.cropper) state.cropper.reset();
    });
  }

  closeButtons.forEach((btn) => {
    btn.addEventListener('click', () => closeModal(true));
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(true);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display !== 'none') {
      closeModal(true);
    }
  });

  applyBtn.addEventListener('click', () => {
    applyCrop().catch((err) => {
      console.error('cropper apply failed', err);
    });
  });

  window.LoreGraphCropper = {
    ready: true,
    open,
    close: () => closeModal(true),
  };
})();
