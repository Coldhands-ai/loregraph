// Alpine-компонент для страницы категорий: открытие/закрытие модалки create/edit
// и динамический редактор template_fields.

window.categoriesPage = function () {
  return {
    modalOpen: false,
    editingId: null,
    data: this._blank(),

    _blank() {
      return {
        name: '',
        color: '#3B82F6',
        icon: '',
        weight: 3,
        sort_order: 0,
        template_fields: [],
      };
    },

    openCreate() {
      this.editingId = null;
      this.data = this._blank();
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
  };
};
