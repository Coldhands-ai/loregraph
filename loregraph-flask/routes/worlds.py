"""Миры: список, создание, удаление."""
from flask import Blueprint, abort, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required
from sqlalchemy import func

from extensions import db
from forms import WorldForm
from models import Article, Relation, World

bp = Blueprint("worlds", __name__)


def _get_owned_world_or_404(world_id: str) -> World:
    """Достаёт мир и проверяет, что текущий пользователь — владелец."""
    world = db.session.get(World, world_id)
    if world is None or world.user_id != current_user.id:
        abort(404)
    return world


@bp.route("/", methods=["GET"])
@login_required
def index():
    worlds = (
        db.session.execute(
            db.select(World)
            .filter_by(user_id=current_user.id)
            .order_by(World.updated_at.desc())
        )
        .scalars()
        .all()
    )

    # Считаем статьи и связи одним запросом каждое. На пустом списке миров —
    # пропускаем запросы (иначе Postgres ругается на пустой IN или "" как UUID).
    world_ids = [w.id for w in worlds]
    if world_ids:
        article_counts = dict(
            db.session.execute(
                db.select(Article.world_id, func.count(Article.id))
                .filter(Article.world_id.in_(world_ids))
                .group_by(Article.world_id)
            ).all()
        )
        relation_counts = dict(
            db.session.execute(
                db.select(Relation.world_id, func.count(Relation.id))
                .filter(Relation.world_id.in_(world_ids))
                .group_by(Relation.world_id)
            ).all()
        )
    else:
        article_counts = {}
        relation_counts = {}

    form = WorldForm()
    return render_template(
        "worlds/list.html",
        worlds=worlds,
        article_counts=article_counts,
        relation_counts=relation_counts,
        form=form,
    )


@bp.route("/create", methods=["POST"])
@login_required
def create():
    form = WorldForm()
    if not form.validate_on_submit():
        flash("Проверь форму: название обязательно (до 100 символов).", "error")
        return redirect(url_for("worlds.index"))

    world = World(
        user_id=current_user.id,
        title=form.title.data.strip(),
        description=(form.description.data or "").strip() or None,
    )
    world.seed_default_categories()
    db.session.add(world)
    db.session.commit()
    flash("Мир создан. Категории уже на месте.", "success")
    return redirect(url_for("articles.index", world_id=world.id))


@bp.route("/<world_id>/delete", methods=["POST"])
@login_required
def delete(world_id: str):
    world = _get_owned_world_or_404(world_id)
    title = world.title
    db.session.delete(world)
    db.session.commit()
    flash(f"Мир «{title}» удалён.", "info")
    return redirect(url_for("worlds.index"))
