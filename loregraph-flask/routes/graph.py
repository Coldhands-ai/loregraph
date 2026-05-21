"""Граф связей: страница + JSON-эндпоинт для Cytoscape."""
from flask import Blueprint, abort, jsonify, render_template
from flask_login import current_user, login_required

from extensions import db
from models import Article, Relation, World

bp = Blueprint("graph", __name__, url_prefix="/worlds/<world_id>/graph")


def _get_owned_world(world_id: str) -> World:
    world = db.session.get(World, world_id)
    if world is None or world.user_id != current_user.id:
        abort(404)
    return world


@bp.route("/", methods=["GET"])
@login_required
def view(world_id: str):
    world = _get_owned_world(world_id)
    return render_template("graph/view.html", world=world, categories=world.categories)


@bp.route("/data.json", methods=["GET"])
@login_required
def data(world_id: str):
    """Отдаёт узлы и рёбра в формате Cytoscape."""
    world = _get_owned_world(world_id)

    articles = (
        db.session.execute(
            db.select(Article).filter_by(world_id=world.id)
        )
        .scalars()
        .all()
    )
    relations = (
        db.session.execute(
            db.select(Relation).filter_by(world_id=world.id)
        )
        .scalars()
        .all()
    )

    cat_color = {c.id: c.color for c in world.categories}
    cat_name = {c.id: c.name for c in world.categories}
    cat_weight = {c.id: c.weight for c in world.categories}
    cat_fields = {c.id: c.template_fields or [] for c in world.categories}
    article_cat = {a.id: a.category_id for a in articles}

    nodes = []
    for a in articles:
        weight = cat_weight.get(a.category_id, 3)
        # Размер узла на canvas: 14 + weight*5 (то есть 19..39 px)
        size = 14 + weight * 5
        # Первая буква для отображения внутри
        first = (a.title.strip()[:1] or "·").upper()
        fields = []
        field_values = a.field_values or {}
        for field in cat_fields.get(a.category_id, []):
            key = field.get("key")
            value = field_values.get(key) if key else None
            if value is None or str(value).strip() == "":
                continue
            fields.append({
                "label": field.get("label") or key,
                "value": str(value),
            })
        nodes.append({
            "data": {
                "id": a.id,
                "label": a.title,
                "initial": first,
                "color": cat_color.get(a.category_id, "#64748B"),
                "category": cat_name.get(a.category_id, "без категории"),
                "category_id": a.category_id or "none",
                "weight": weight,
                "size": size,
                "pinned": a.is_pinned,
                "summary": a.summary or "",
                "image_url": a.image_url or "",
                "fields": fields,
            }
        })
    edges = []
    for r in relations:
        edges.append({
            "data": {
                "id": r.id,
                "source": r.source_article_id,
                "target": r.target_article_id,
                "label": r.label,
                # Цвета концов — для градиента ребра на канвасе
                "source_color": cat_color.get(article_cat.get(r.source_article_id), "#64748B"),
                "target_color": cat_color.get(article_cat.get(r.target_article_id), "#64748B"),
            }
        })
    return jsonify(nodes=nodes, edges=edges)
