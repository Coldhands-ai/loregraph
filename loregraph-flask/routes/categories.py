"""Категории мира: CRUD + редактирование template_fields."""
import json

from flask import Blueprint, abort, flash, redirect, render_template, request, url_for, jsonify
from flask_login import current_user, login_required

from extensions import db
from forms import CategoryForm
from models import Category, World

bp = Blueprint("categories", __name__, url_prefix="/worlds/<world_id>/categories")


def _get_owned_world(world_id: str) -> World:
    world = db.session.get(World, world_id)
    if world is None or world.user_id != current_user.id:
        abort(404)
    return world


def _get_owned_category(world_id: str, category_id: str) -> Category:
    cat = db.session.get(Category, category_id)
    if cat is None or cat.world_id != world_id:
        abort(404)
    if cat.world.user_id != current_user.id:
        abort(404)
    return cat


def _parse_template_fields(raw: str) -> list:
    """Разбирает поля шаблона из формы (JSON-строка от JS-редактора)."""
    if not raw or not raw.strip():
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    cleaned = []
    seen_keys = set()
    for item in data:
        if not isinstance(item, dict):
            continue
        label = (item.get("label") or "").strip()
        if not label:
            continue
        # ключ выводим из label, если не задан явно
        key = (item.get("key") or label).strip().lower()
        # упрощённая нормализация
        key = "".join(ch if ch.isalnum() else "_" for ch in key).strip("_")[:50]
        if not key or key in seen_keys:
            continue
        seen_keys.add(key)
        ftype = item.get("type") if item.get("type") in ("text", "textarea", "date") else "text"
        cleaned.append({"key": key, "label": label[:100], "type": ftype})
    return cleaned[:20]  # разумный потолок


@bp.route("/", methods=["GET"])
@login_required
def index(world_id: str):
    world = _get_owned_world(world_id)
    form = CategoryForm()
    return render_template("settings/categories.html", world=world, form=form)


@bp.route("/create", methods=["POST"])
@login_required
def create(world_id: str):
    world = _get_owned_world(world_id)
    form = CategoryForm()
    if not form.validate_on_submit():
        flash("Проверь форму: имя и валидный цвет обязательны.", "error")
        return redirect(url_for("categories.index", world_id=world.id))

    # Уникальность имени в пределах мира
    existing = next((c for c in world.categories if c.name.lower() == form.name.data.strip().lower()), None)
    if existing:
        flash(f"Категория «{form.name.data.strip()}» уже есть.", "error")
        return redirect(url_for("categories.index", world_id=world.id))

    cat = Category(
        world_id=world.id,
        name=form.name.data.strip(),
        color=form.color.data.strip(),
        icon=(form.icon.data or "").strip() or None,
        weight=form.weight.data,
        sort_order=form.sort_order.data or 0,
        template_fields=_parse_template_fields(request.form.get("template_fields", "")),
    )
    db.session.add(cat)
    db.session.commit()
    flash(f"Категория «{cat.name}» создана.", "success")
    return redirect(url_for("categories.index", world_id=world.id))


@bp.route("/<category_id>/update", methods=["POST"])
@login_required
def update(world_id: str, category_id: str):
    cat = _get_owned_category(world_id, category_id)
    form = CategoryForm()
    if not form.validate_on_submit():
        flash("Проверь форму.", "error")
        return redirect(url_for("categories.index", world_id=world_id))

    template_fields = _parse_template_fields(request.form.get("template_fields", ""))
    allowed_keys = {f["key"] for f in template_fields}
    cat.name = form.name.data.strip()
    cat.color = form.color.data.strip()
    cat.icon = (form.icon.data or "").strip() or None
    cat.weight = form.weight.data
    cat.sort_order = form.sort_order.data or 0
    cat.template_fields = template_fields
    for article in cat.articles:
        article.field_values = {
            k: v for k, v in (article.field_values or {}).items() if k in allowed_keys
        }
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        flash("Не удалось сохранить (возможно, имя уже занято).", "error")
        return redirect(url_for("categories.index", world_id=world_id))
    flash(f"Категория «{cat.name}» обновлена.", "success")
    return redirect(url_for("categories.index", world_id=world_id))


@bp.route("/<category_id>/delete", methods=["POST"])
@login_required
def delete(world_id: str, category_id: str):
    cat = _get_owned_category(world_id, category_id)
    name = cat.name
    for article in cat.articles:
        article.category_id = None
        article.field_values = {}
    db.session.delete(cat)
    db.session.commit()
    flash(f"Категория «{name}» удалена. Статьи в ней теперь без категории.", "info")
    return redirect(url_for("categories.index", world_id=world_id))


@bp.route("/quick-create.json", methods=["POST"])
@login_required
def quick_create_json(world_id: str):
    """Inline-создание категории из выпадашки выбора. Возвращает JSON."""
    world = _get_owned_world(world_id)
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    color = (data.get("color") or "#3B82F6").strip()
    if not name:
        return jsonify(ok=False, error="Имя обязательно."), 400
    if any(c.name.lower() == name.lower() for c in world.categories):
        return jsonify(ok=False, error="Уже есть."), 400
    cat = Category(
        world_id=world.id,
        name=name,
        color=color,
        weight=3,
        sort_order=(max((c.sort_order for c in world.categories), default=0) + 1),
        template_fields=[],
    )
    db.session.add(cat)
    db.session.commit()
    return jsonify(ok=True, id=cat.id, name=cat.name, color=cat.color)
