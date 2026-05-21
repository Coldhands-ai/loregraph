"""Миры: список, создание, удаление."""
from flask import Blueprint, abort, current_app, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required
from sqlalchemy import func

from extensions import db
from forms import CoverUploadForm, WorldForm
from models import Article, Relation, SETTING_KEYS, World
from storage import UploadError, delete_image, save_image

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


@bp.route("/<world_id>/", methods=["GET"])
@login_required
def detail(world_id: str):
    world = _get_owned_world_or_404(world_id)

    article_count = db.session.scalar(
        db.select(func.count(Article.id)).filter_by(world_id=world.id)
    ) or 0
    relation_count = db.session.scalar(
        db.select(func.count(Relation.id)).filter_by(world_id=world.id)
    ) or 0

    # Сколько статей в каждой категории (включая «без категории»)
    rows = db.session.execute(
        db.select(Article.category_id, func.count(Article.id))
        .filter(Article.world_id == world.id)
        .group_by(Article.category_id)
    ).all()
    cat_counts = {(str(k) if k else None): v for k, v in rows}

    recent = db.session.execute(
        db.select(Article)
        .filter_by(world_id=world.id)
        .order_by(Article.updated_at.desc())
        .limit(6)
    ).scalars().all()

    pinned = db.session.execute(
        db.select(Article)
        .filter_by(world_id=world.id, is_pinned=True)
        .order_by(Article.updated_at.desc())
    ).scalars().all()

    return render_template(
        "worlds/detail.html",
        world=world,
        article_count=article_count,
        relation_count=relation_count,
        cat_counts=cat_counts,
        recent=recent,
        pinned=pinned,
        cover_form=CoverUploadForm(),
    )


@bp.route("/<world_id>/cover", methods=["POST"])
@login_required
def upload_cover(world_id: str):
    world = _get_owned_world_or_404(world_id)
    form = CoverUploadForm()
    if not form.validate_on_submit():
        flash("Не удалось загрузить — проверь формат и размер.", "error")
        return redirect(url_for("worlds.detail", world_id=world.id))

    try:
        url = save_image(
            form.cover.data,
            subdir=f"worlds/{world.id}",
            base_dir=current_app.root_path,
            max_size=(1500, 500),
        )
    except UploadError as e:
        flash(str(e), "error")
        return redirect(url_for("worlds.detail", world_id=world.id))

    if world.cover_url:
        delete_image(world.cover_url, current_app.root_path)
    world.cover_url = url
    db.session.commit()
    flash("Обложка мира обновлена.", "success")
    return redirect(url_for("worlds.detail", world_id=world.id))


@bp.route("/<world_id>/cover/delete", methods=["POST"])
@login_required
def delete_cover(world_id: str):
    world = _get_owned_world_or_404(world_id)
    if world.cover_url:
        delete_image(world.cover_url, current_app.root_path)
        world.cover_url = None
        db.session.commit()
        flash("Обложка мира удалена.", "info")
    return redirect(url_for("worlds.detail", world_id=world.id))


def _custom_theme_from_form(form: WorldForm) -> dict | None:
    if form.setting.data != "custom":
        return None
    return {
        "brand": (form.custom_brand.data or "#3B82F6").strip(),
        "font": (form.custom_font.data or "Newsreader").strip(),
    }


@bp.route("/create", methods=["POST"])
@login_required
def create():
    form = WorldForm()
    if not form.validate_on_submit():
        flash("Проверь форму: название обязательно (до 100 символов).", "error")
        return redirect(url_for("worlds.index"))

    setting = form.setting.data if form.setting.data in SETTING_KEYS else "default"
    world = World(
        user_id=current_user.id,
        title=form.title.data.strip(),
        description=(form.description.data or "").strip() or None,
        setting=setting,
        custom_theme=_custom_theme_from_form(form),
    )
    world.seed_default_categories()
    db.session.add(world)
    db.session.commit()
    flash("Мир создан. Категории уже на месте.", "success")
    return redirect(url_for("articles.index", world_id=world.id))


@bp.route("/<world_id>/edit", methods=["GET", "POST"])
@login_required
def edit(world_id: str):
    world = _get_owned_world_or_404(world_id)
    form = WorldForm(obj=world)
    if request.method == "GET":
        # Чтобы кастомные поля подтянулись из JSONB
        if world.custom_theme:
            form.custom_brand.data = world.custom_theme.get("brand", "#3B82F6")
            form.custom_font.data = world.custom_theme.get("font", "Newsreader")
        return render_template("worlds/edit.html", world=world, form=form)

    if not form.validate_on_submit():
        flash("Проверь форму.", "error")
        return render_template("worlds/edit.html", world=world, form=form)

    world.title = form.title.data.strip()
    world.description = (form.description.data or "").strip() or None
    new_setting = form.setting.data if form.setting.data in SETTING_KEYS else "default"
    world.setting = new_setting
    world.custom_theme = _custom_theme_from_form(form)
    db.session.commit()
    flash("Настройки мира обновлены.", "success")
    return redirect(url_for("worlds.detail", world_id=world.id))


@bp.route("/<world_id>/delete", methods=["POST"])
@login_required
def delete(world_id: str):
    world = _get_owned_world_or_404(world_id)
    title = world.title
    for article in world.articles:
        if article.image_url:
            delete_image(article.image_url, current_app.root_path)
    if world.cover_url:
        delete_image(world.cover_url, current_app.root_path)
    db.session.delete(world)
    db.session.commit()
    current_app.logger.info("world deleted: %s (owner %s)", title, current_user.email)
    flash(f"Мир «{title}» удалён.", "info")
    return redirect(url_for("worlds.index"))
