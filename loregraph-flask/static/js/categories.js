// Alpine-компонент для страницы категорий: модалка create/edit + редактор template_fields.
// Регистрируем через alpine:init — гарантирует, что компонент известен Alpine
// до момента, когда он начнёт вычислять x-data в DOM.

function _blankCategory() {
  return {
    name: '',
    color: '#3B82F6',
    icon: '',
    weight: 3,
    sort_order: 0,
    template_fields: [],
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('categoriesPage', () => ({
    modalOpen: false,
    editingId: null,
    data: _blankCategory(),

    openCreate() {
      this.editingId = null;
      this.data = _blankCategory();
      this.modalOpen = true;
    },

    openEdit(payload) {
      this.editingId = payload.id;
      this.data = {
        name: payload.name,
        color: payload.color,
        icon: payload.icon || '',
        weight: payload.weight,
        sort_order: payload.sort_order,
        template_fields: (payload.template_fields || []).map((f) => ({
          key: f.key, label: f.label, type: f.type || 'text',
        })),
      };
      this.modalOpen = true;
    },

    closeModal() {
      this.modalOpen = false;
    },

    addField() {
      this.data.template_fields.push({ key: '', label: '', type: 'text' });
    },
  }));
});
