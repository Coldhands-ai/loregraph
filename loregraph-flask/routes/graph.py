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

    nodes = [
        {
            "data": {
                "id": a.id,
                "label": a.title,
                "color": cat_color.get(a.category_id, "#64748B"),
                "category": cat_name.get(a.category_id, "без категории"),
                "category_id": a.category_id or "none",
                "pinned": a.is_pinned,
                "summary": a.summary or "",
            }
        }
        for a in articles
    ]
    edges = [
        {
            "data": {
                "id": r.id,
                "source": r.source_article_id,
                "target": r.target_article_id,
                "label": r.label,
            }
        }
        for r in relations
    ]
    return jsonify(nodes=nodes, edges=edges)
