"""Статьи: список, редактор (с автосейвом), управление связями, обложка."""
import bleach
import markdown as md
from flask import (
    Blueprint, abort, current_app, flash, jsonify, redirect, render_template,
    request, url_for,
)
from flask_login import current_user, login_required
from sqlalchemy import or_

from extensions import db
from forms import ArticleCreateForm, CoverUploadForm, RelationForm
from models import Article, Category, Relation, World
from storage import UploadError, delete_image, save_image

bp = Blueprint("articles", __name__, url_prefix="/worlds/<world_id>/articles")


def _get_owned_world(world_id: str) -> World:
    world = db.session.get(World, world_id)
    if world is None or world.user_id != current_user.id:
        abort(404)
    return world


def _get_owned_article(world_id: str, article_id: str) -> Article:
    article = db.session.get(Article, article_id)
    if article is None or article.world_id != world_id:
        abort(404)
    if article.world.user_id != current_user.id:
        abort(404)
    return article


# ─── Список и создание ──────────────────────────────────────

@bp.route("/", methods=["GET"])
@login_required
def index(world_id: str):
    world = _get_owned_world(world_id)
    articles = (
        db.session.execute(
            db.select(Article)
            .filter_by(world_id=world.id)
            .order_by(Article.is_pinned.desc(), Article.updated_at.desc())
        )
        .scalars()
        .all()
    )
    categories = world.categories
    filter_cat = request.args.get("category", "").strip() or None
    search = request.args.get("q", "").strip()

    if filter_cat == "none":
        articles = [a for a in articles if a.category_id is None]
    elif filter_cat:
        articles = [a for a in articles if a.category_id == filter_cat]
    if search:
        s = search.lower()
        articles = [a for a in articles if s in a.title.lower()]

    # Кол-во связей по статьям (для богатых карточек)
    rel_counts = _relation_counts(world.id)

    form = ArticleCreateForm()
    form.set_category_choices(categories)

    return render_template(
        "articles/list.html",
        world=world,
        articles=articles,
        categories=categories,
        rel_counts=rel_counts,
        form=form,
        filter_cat=filter_cat,
        search=search,
    )


def _relation_counts(world_id: str) -> dict[str, int]:
    rows = db.session.execute(
        db.text(
            "SELECT article_id, COUNT(*) FROM ("
            " SELECT source_article_id AS article_id FROM relations WHERE world_id = :wid"
            " UNION ALL"
            " SELECT target_article_id AS article_id FROM relations WHERE world_id = :wid"
            ") t GROUP BY article_id"
        ),
        {"wid": world_id},
    ).all()
    return {r[0]: r[1] for r in rows}


@bp.route("/create", methods=["POST"])
@login_required
def create(world_id: str):
    world = _get_owned_world(world_id)
    form = ArticleCreateForm()
    form.set_category_choices(world.categories)
    if not form.validate_on_submit():
        flash("Проверь форму: название обязательно.", "error")
        return redirect(url_for("articles.index", world_id=world.id))

    article = Article(
        world_id=world.id,
        title=form.title.data.strip(),
        category_id=form.category_id.data or None,
    )
    db.session.add(article)
    db.session.commit()
    return redirect(url_for("articles.edit", world_id=world.id, article_id=article.id))


# ─── Редактор ───────────────────────────────────────────────

@bp.route("/<article_id>", methods=["GET"])
@login_required
def edit(world_id: str, article_id: str):
    article = _get_owned_article(world_id, article_id)
    world = article.world
    relations = _list_relations_for_article(article)
    return render_template(
        "articles/edit.html",
        world=world,
        article=article,
        categories=world.categories,
        relations=relations,
        relation_form=RelationForm(),
        cover_form=CoverUploadForm(),
    )


@bp.route("/<article_id>/autosave", methods=["POST"])
@login_required
def autosave(world_id: str, article_id: str):
    article = _get_owned_article(world_id, article_id)
    data = request.get_json(silent=True) or {}
    if "title" in data:
        title = (data["title"] or "").strip()
        if not title or len(title) > 200:
            return jsonify(ok=False, error="Название обязательно (до 200 символов)."), 400
        article.title = title
    if "content_md" in data:
        article.content_md = data["content_md"] or ""
        # Автосаммари — первые 200 символов plain-текста
        plain = bleach.clean(md.markdown(article.content_md or ""), tags=[], strip=True).strip()
        article.summary = (plain[:200] + "…") if len(plain) > 200 else (plain or None)
    if "summary" in data:
        article.summary = (data["summary"] or "").strip() or None
    if "category_id" in data:
        cat_id = data["category_id"] or None
        if cat_id is not None:
            cat = db.session.get(Category, cat_id)
            if cat is None or cat.world_id != article.world_id:
                return jsonify(ok=False, error="Чужая категория."), 400
        article.category_id = cat_id
    if "field_values" in data and isinstance(data["field_values"], dict):
        # Принимаем только поля, объявленные у текущей категории
        if article.category_id:
            cat = db.session.get(Category, article.category_id)
            allowed_keys = {f["key"] for f in (cat.template_fields or [])}
            cleaned = {k: str(v)[:1000] for k, v in data["field_values"].items() if k in allowed_keys}
            article.field_values = cleaned
        else:
            article.field_values = {}
    db.session.commit()
    return jsonify(ok=True, updated_at=article.updated_at.isoformat())


@bp.route("/<article_id>/cover", methods=["POST"])
@login_required
def upload_cover(world_id: str, article_id: str):
    article = _get_owned_article(world_id, article_id)
    form = CoverUploadForm()
    if not form.validate_on_submit():
        flash("Не удалось загрузить — проверь формат и размер.", "error")
        return redirect(url_for("articles.edit", world_id=world_id, article_id=article_id))

    try:
        url = save_image(
            form.cover.data,
            subdir=f"articles/{article.id}",
            base_dir=current_app.root_path,
        )
    except UploadError as e:
        flash(str(e), "error")
        return redirect(url_for("articles.edit", world_id=world_id, article_id=article_id))

    if article.image_url:
        delete_image(article.image_url, current_app.root_path)
    article.image_url = url
    db.session.commit()
    flash("Обложка обновлена.", "success")
    return redirect(url_for("articles.edit", world_id=world_id, article_id=article_id))


@bp.route("/<article_id>/cover/delete", methods=["POST"])
@login_required
def delete_cover(world_id: str, article_id: str):
    article = _get_owned_article(world_id, article_id)
    if article.image_url:
        delete_image(article.image_url, current_app.root_path)
        article.image_url = None
        db.session.commit()
        flash("Обложка удалена.", "info")
    return redirect(url_for("articles.edit", world_id=world_id, article_id=article_id))


@bp.route("/<article_id>/pin", methods=["POST"])
@login_required
def toggle_pin(world_id: str, article_id: str):
    article = _get_owned_article(world_id, article_id)
    article.is_pinned = not article.is_pinned
    db.session.commit()
    return jsonify(ok=True, is_pinned=article.is_pinned)


@bp.route("/<article_id>/delete", methods=["POST"])
@login_required
def delete(world_id: str, article_id: str):
    article = _get_owned_article(world_id, article_id)
    title = article.title
    if article.image_url:
        delete_image(article.image_url, current_app.root_path)
    db.session.delete(article)
    db.session.commit()
    flash(f"Статья «{title}» удалена.", "info")
    return redirect(url_for("articles.index", world_id=world_id))


# ─── Связи ──────────────────────────────────────────────────

@bp.route("/<article_id>/relations", methods=["POST"])
@login_required
def add_relation(world_id: str, article_id: str):
    article = _get_owned_article(world_id, article_id)
    form = RelationForm()
    if not form.validate_on_submit():
        flash("Заполни тип связи и выбери целевую статью.", "error")
        return redirect(url_for("articles.edit", world_id=world_id, article_id=article_id))

    target_id = form.target_article_id.data
    target = db.session.get(Article, target_id)
    if target is None or target.world_id != world_id:
        flash("Такой статьи нет в этом мире.", "error")
        return redirect(url_for("articles.edit", world_id=world_id, article_id=article_id))
    if target.id == article.id:
        flash("Нельзя связать статью саму с собой.", "error")
        return redirect(url_for("articles.edit", world_id=world_id, article_id=article_id))

    rel = Relation(
        world_id=world_id,
        source_article_id=article.id,
        target_article_id=target.id,
        label=form.label.data.strip(),
        description=(form.description.data or "").strip() or None,
    )
    db.session.add(rel)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        flash("Такая связь уже существует.", "error")
    return redirect(url_for("articles.edit", world_id=world_id, article_id=article_id))


@bp.route("/<article_id>/relations/<relation_id>/delete", methods=["POST"])
@login_required
def delete_relation(world_id: str, article_id: str, relation_id: str):
    _get_owned_article(world_id, article_id)
    rel = db.session.get(Relation, relation_id)
    if rel is None or rel.world_id != world_id:
        abort(404)
    db.session.delete(rel)
    db.session.commit()
    return redirect(url_for("articles.edit", world_id=world_id, article_id=article_id))


@bp.route("/search.json", methods=["GET"])
@login_required
def search_json(world_id: str):
    """Автокомплит для добавления связи."""
    _get_owned_world(world_id)
    q = request.args.get("q", "").strip()
    exclude = request.args.get("exclude", "").strip()
    if not q:
        return jsonify(results=[])
    rows = (
        db.session.execute(
            db.select(Article.id, Article.title)
            .filter(Article.world_id == world_id)
            .filter(Article.title.ilike(f"%{q}%"))
            .filter(Article.id != exclude)
            .order_by(Article.title)
            .limit(8)
        )
        .all()
    )
    return jsonify(results=[{"id": r[0], "title": r[1]} for r in rows])


# ─── Хелперы ────────────────────────────────────────────────

def _list_relations_for_article(article: Article):
    """Все связи статьи (исходящие + входящие) с присоединёнными статьями-концами."""
    rows = (
        db.session.execute(
            db.select(Relation)
            .filter(
                or_(
                    Relation.source_article_id == article.id,
                    Relation.target_article_id == article.id,
                )
            )
            .order_by(Relation.created_at.desc())
        )
        .scalars()
        .all()
    )
    out = []
    for r in rows:
        outgoing = r.source_article_id == article.id
        other = r.target if outgoing else r.source
        out.append({"rel": r, "outgoing": outgoing, "other": other})
    return out
