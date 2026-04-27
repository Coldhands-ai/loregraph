"""Статьи: список, редактор (с автосейвом), управление связями."""
import bleach
import markdown as md
from flask import Blueprint, abort, flash, jsonify, redirect, render_template, request, url_for
from flask_login import current_user, login_required
from sqlalchemy import or_

from extensions import db
from forms import ArticleCreateForm, RelationForm
from models import Article, Category, Relation, World

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

    form = ArticleCreateForm()
    form.set_category_choices(categories)

    return render_template(
        "articles/list.html",
        world=world,
        articles=articles,
        categories=categories,
        form=form,
        filter_cat=filter_cat,
        search=search,
    )


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
    relation_form = RelationForm()
    return render_template(
        "articles/edit.html",
        world=world,
        article=article,
        categories=world.categories,
        relations=relations,
        relation_form=relation_form,
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
    if "summary" in data:
        article.summary = (data["summary"] or "").strip() or None
    if "category_id" in data:
        cat_id = data["category_id"] or None
        if cat_id is not None:
            cat = db.session.get(Category, cat_id)
            if cat is None or cat.world_id != article.world_id:
                return jsonify(ok=False, error="Чужая категория."), 400
        article.category_id = cat_id
    db.session.commit()
    return jsonify(ok=True, updated_at=article.updated_at.isoformat())


@bp.route("/<article_id>/preview", methods=["POST"])
@login_required
def preview(world_id: str, article_id: str):
    """Рендер Markdown в безопасный HTML для предпросмотра."""
    _get_owned_article(world_id, article_id)
    raw = (request.get_json(silent=True) or {}).get("content_md", "")
    html = md.markdown(raw, extensions=["fenced_code", "tables", "nl2br", "sane_lists"])
    safe = bleach.clean(
        html,
        tags=[
            "p", "br", "hr", "strong", "em", "del", "code", "pre", "blockquote",
            "h1", "h2", "h3", "h4", "ul", "ol", "li", "a", "img", "table", "thead",
            "tbody", "tr", "th", "td",
        ],
        attributes={"a": ["href", "title"], "img": ["src", "alt", "title"]},
        protocols=["http", "https", "mailto"],
        strip=True,
    )
    return jsonify(html=safe)


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
