"""Статьи: список, редактор (с автосейвом), управление связями, обложка, версии."""
import re
from datetime import datetime, timezone

import bleach
import markdown as md
from flask import (
    Blueprint, abort, current_app, flash, jsonify, redirect, render_template,
    request, url_for,
)
from flask_login import current_user, login_required
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from extensions import db
from forms import ArticleCreateForm, CoverUploadForm, RelationForm
from models import Article, ArticleVersion, Bookmark, Category, Relation, Tag, World
from storage import UploadError, delete_image, save_image

# Минимальный интервал между авто-снапшотами версии (секунды).
# В минутах — 30. Можно временно убавить для тестирования.
AUTO_VERSION_INTERVAL_S = 30 * 60
MAX_AUTO_VERSIONS = 3
MAX_MANUAL_VERSIONS = 2

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
    categories = world.categories
    filter_cat = request.args.get("category", "").strip() or None
    search = request.args.get("q", "").strip()

    query = db.select(Article).filter_by(world_id=world.id)
    if filter_cat == "none":
        query = query.filter(Article.category_id.is_(None))
    elif filter_cat:
        query = query.filter(Article.category_id == filter_cat)

    fts_str = build_tsquery(search) if search else None
    if fts_str:
        # Префиксный матч: «11» найдёт «111», «эльф» — «эльфом», «эльфы».
        # Сортируем по релевантности; pin игнорируем — при поиске важнее, что нашлось.
        ts_query = db.func.to_tsquery("russian", fts_str)
        query = (
            query.filter(Article.search_vector.op("@@")(ts_query))
                 .order_by(
                     db.func.ts_rank(Article.search_vector, ts_query).desc(),
                     Article.updated_at.desc(),
                 )
        )
    else:
        query = query.order_by(Article.is_pinned.desc(), Article.updated_at.desc())

    articles = db.session.execute(query).scalars().all()

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
    # psycopg возвращает UUID как объекты — приводим к str, чтобы лукап в шаблоне совпал
    return {str(r[0]): r[1] for r in rows}


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


# ─── Просмотр (read view) ───────────────────────────────────

_MD_TAGS = [
    "p", "br", "strong", "em", "del", "a", "img",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "blockquote", "hr",
    "pre", "code",
    "table", "thead", "tbody", "tr", "th", "td",
    "input",
]
_MD_ATTRS = {
    "a": ["href", "title", "rel"],
    "img": ["src", "alt", "title"],
    "input": ["type", "checked", "disabled"],
    "*": ["class"],
}


# ─── Версионирование ────────────────────────────────────────

def _push_auto_version(article: Article) -> None:
    """Создаёт авто-снапшот текущего состояния. Если 3 авто-слота заняты —
    самый старый удаляется (rolling rotation)."""
    auto = list(db.session.execute(
        db.select(ArticleVersion)
        .filter_by(article_id=article.id, kind="auto")
        .order_by(ArticleVersion.created_at.asc())
    ).scalars())
    if len(auto) >= MAX_AUTO_VERSIONS:
        db.session.delete(auto[0])
    db.session.add(ArticleVersion(
        article_id=article.id,
        kind="auto",
        title=article.title,
        content_md=article.content_md or "",
        field_values=dict(article.field_values or {}),
        category_id=article.category_id,
    ))


def _maybe_push_auto_version(article: Article) -> None:
    """Версионируем по таймеру: создаём авто-версию, если с прошлой
    прошло >= AUTO_VERSION_INTERVAL_S."""
    now = datetime.now(timezone.utc)
    if (now - article.last_auto_version_at).total_seconds() < AUTO_VERSION_INTERVAL_S:
        return
    _push_auto_version(article)
    article.last_auto_version_at = now


def _render_markdown(text: str) -> str:
    if not text:
        return ""
    html = md.markdown(text, extensions=["extra", "sane_lists", "nl2br"])
    return bleach.clean(
        html, tags=_MD_TAGS, attributes=_MD_ATTRS,
        protocols=["http", "https", "mailto"],
    )


MAX_TAGS_PER_ARTICLE = 20


def build_tsquery(text: str) -> str | None:
    """Превращает пользовательский ввод в tsquery с префиксным матчем:
    'эльф маг' -> 'эльф:* & маг:*'. Знаки препинания вычищаем,
    иначе to_tsquery упадёт на спецсимволах (& | ! ( )).
    """
    cleaned = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    words = cleaned.split()
    if not words:
        return None
    return " & ".join(f"{w}:*" for w in words)


def _sync_article_tags(article: Article, raw_names: list) -> None:
    """Приводит article.tags в соответствие списку имён. Создаёт недостающие,
    отвязывает не упомянутые. Лимит — MAX_TAGS_PER_ARTICLE."""
    seen: set[str] = set()
    names: list[str] = []
    for raw in raw_names[:MAX_TAGS_PER_ARTICLE]:
        if not isinstance(raw, str):
            continue
        name = raw.strip()[:50]
        if name and name not in seen:
            seen.add(name)
            names.append(name)

    if names:
        rows = db.session.execute(
            db.select(Tag).filter(
                Tag.world_id == article.world_id,
                Tag.name.in_(names),
            )
        ).scalars().all()
        existing = {t.name: t for t in rows}
    else:
        existing = {}

    new_tags: list[Tag] = []
    for name in names:
        tag = existing.get(name)
        if tag is None:
            tag = Tag(world_id=article.world_id, name=name)
            db.session.add(tag)
        new_tags.append(tag)
    article.tags = new_tags


def _refresh_summary(article: Article) -> None:
    """Пересобирает article.summary из content_md (первые 200 plain-символов).
    Зовём из autosave и из restore_version, чтобы превью всегда соответствовало
    тексту."""
    plain = bleach.clean(md.markdown(article.content_md or ""), tags=[], strip=True).strip()
    article.summary = (plain[:200] + "…") if len(plain) > 200 else (plain or None)


def _is_bookmarked(article: Article) -> bool:
    return db.session.scalar(
        db.select(db.func.count()).select_from(Bookmark)
        .filter_by(user_id=current_user.id, article_id=article.id)
    ) > 0


@bp.route("/<article_id>", methods=["GET"])
@login_required
def view(world_id: str, article_id: str):
    article = _get_owned_article(world_id, article_id)
    world = article.world
    relations = _list_relations_for_article(article)
    html_content = _render_markdown(article.content_md or "")
    return render_template(
        "articles/view.html",
        world=world,
        article=article,
        relations=relations,
        html_content=html_content,
        is_bookmarked=_is_bookmarked(article),
    )


# ─── Редактор ───────────────────────────────────────────────

@bp.route("/<article_id>/edit", methods=["GET"])
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
        is_bookmarked=_is_bookmarked(article),
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
        content = data["content_md"] or ""
        if len(content) > 200_000:
            return jsonify(ok=False, error="Слишком большой текст (макс. 200 КБ)."), 400
        article.content_md = content
        _refresh_summary(article)
    if "summary" in data:
        article.summary = (data["summary"] or "").strip() or None
    if "category_id" in data:
        cat_id = data["category_id"] or None
        if cat_id is not None:
            cat = db.session.get(Category, cat_id)
            if cat is None or cat.world_id != article.world_id:
                return jsonify(ok=False, error="Чужая категория."), 400
        if cat_id != article.category_id:
            article.category_id = cat_id
            article.field_values = {}
    if "field_values" in data and isinstance(data["field_values"], dict):
        # Принимаем только поля, объявленные у текущей категории
        if article.category_id:
            cat = db.session.get(Category, article.category_id)
            allowed_keys = {f["key"] for f in (cat.template_fields or [])}
            cleaned = {k: str(v)[:1000] for k, v in data["field_values"].items() if k in allowed_keys}
            article.field_values = cleaned
        else:
            article.field_values = {}
    if "tags" in data and isinstance(data["tags"], list):
        _sync_article_tags(article, data["tags"])
    _maybe_push_auto_version(article)
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
            max_size=(1280, 720),
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
    except IntegrityError:
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


@bp.route("/tags.json", methods=["GET"])
@login_required
def tags_json(world_id: str):
    """Автокомплит тегов: возвращает существующие теги мира, фильтруя по q."""
    _get_owned_world(world_id)
    q = request.args.get("q", "").strip().lower()
    query = db.select(Tag).filter_by(world_id=world_id)
    if q:
        query = query.filter(Tag.name.ilike(f"%{q}%"))
    rows = db.session.execute(query.order_by(Tag.name).limit(20)).scalars().all()
    return jsonify(results=[{"id": t.id, "name": t.name, "color": t.color} for t in rows])


# ─── Закладки ──────────────────────────────────────────────

@bp.route("/<article_id>/bookmark", methods=["POST"])
@login_required
def toggle_bookmark(world_id: str, article_id: str):
    """Тоггл закладки текущего пользователя на эту статью."""
    article = _get_owned_article(world_id, article_id)
    existing = db.session.execute(
        db.select(Bookmark).filter_by(user_id=current_user.id, article_id=article.id)
    ).scalar_one_or_none()
    if existing is not None:
        db.session.delete(existing)
        bookmarked = False
    else:
        db.session.add(Bookmark(user_id=current_user.id, article_id=article.id))
        bookmarked = True
    db.session.commit()
    return jsonify(ok=True, bookmarked=bookmarked)


# ─── Версии: список, ручное сохранение, просмотр, откат, удаление ─

def _get_owned_version(world_id: str, article_id: str, version_id: str) -> ArticleVersion:
    article = _get_owned_article(world_id, article_id)
    v = db.session.get(ArticleVersion, version_id)
    if v is None or v.article_id != article.id:
        abort(404)
    return v


def _attach_preview(versions: list[ArticleVersion]) -> None:
    """Цепляет короткий plain-text preview к каждой версии (для карточек)."""
    for v in versions:
        plain = bleach.clean(md.markdown(v.content_md or ""), tags=[], strip=True).strip()
        v.preview = (plain[:200] + "…") if len(plain) > 200 else plain


@bp.route("/<article_id>/versions", methods=["GET"])
@login_required
def versions(world_id: str, article_id: str):
    article = _get_owned_article(world_id, article_id)
    auto = list(db.session.execute(
        db.select(ArticleVersion)
        .filter_by(article_id=article.id, kind="auto")
        .order_by(ArticleVersion.created_at.desc())
    ).scalars())
    manual = list(db.session.execute(
        db.select(ArticleVersion)
        .filter_by(article_id=article.id, kind="manual")
        .order_by(ArticleVersion.created_at.desc())
    ).scalars())
    _attach_preview(auto)
    _attach_preview(manual)
    return render_template(
        "articles/versions.html",
        world=article.world,
        article=article,
        auto_versions=auto,
        manual_versions=manual,
        max_auto=MAX_AUTO_VERSIONS,
        max_manual=MAX_MANUAL_VERSIONS,
    )


@bp.route("/<article_id>/versions/create", methods=["POST"])
@login_required
def create_version(world_id: str, article_id: str):
    """Ручное сохранение версии. Слотов всего MAX_MANUAL_VERSIONS — если все
    заняты, пользователь должен сначала удалить одну."""
    article = _get_owned_article(world_id, article_id)
    name = (request.form.get("name") or "").strip()[:100] or None

    manual_count = db.session.scalar(
        db.select(db.func.count())
        .select_from(ArticleVersion)
        .filter_by(article_id=article.id, kind="manual")
    )
    if manual_count >= MAX_MANUAL_VERSIONS:
        flash(
            f"Оба ручных слота заняты. Удали одну из ручных версий, чтобы сохранить новую.",
            "error",
        )
        return redirect(url_for("articles.versions", world_id=world_id, article_id=article_id))

    db.session.add(ArticleVersion(
        article_id=article.id,
        kind="manual",
        name=name,
        title=article.title,
        content_md=article.content_md or "",
        field_values=dict(article.field_values or {}),
        category_id=article.category_id,
    ))
    db.session.commit()
    flash("Версия сохранена.", "success")
    return redirect(url_for("articles.versions", world_id=world_id, article_id=article_id))


@bp.route("/<article_id>/versions/<version_id>", methods=["GET"])
@login_required
def view_version(world_id: str, article_id: str, version_id: str):
    v = _get_owned_version(world_id, article_id, version_id)
    article = v.article
    category = db.session.get(Category, v.category_id) if v.category_id else None
    html_content = _render_markdown(v.content_md or "")
    return render_template(
        "articles/version_view.html",
        world=article.world,
        article=article,
        version=v,
        version_category=category,
        html_content=html_content,
    )


@bp.route("/<article_id>/versions/<version_id>/restore", methods=["POST"])
@login_required
def restore_version(world_id: str, article_id: str, version_id: str):
    v = _get_owned_version(world_id, article_id, version_id)
    article = v.article

    # Safety net — снапшот текущего состояния перед перезаписью (всегда, не по таймеру).
    _push_auto_version(article)

    # Применяем содержимое версии. Если категория к этому моменту удалена,
    # FK на ArticleVersion.category_id уже SET NULL, так что v.category_id мог стать None.
    article.title = v.title
    article.content_md = v.content_md or ""
    article.field_values = dict(v.field_values or {})
    if v.category_id and db.session.get(Category, v.category_id):
        article.category_id = v.category_id
    else:
        article.category_id = None
    _refresh_summary(article)
    article.last_auto_version_at = datetime.now(timezone.utc)

    db.session.commit()
    current_app.logger.info(
        "version restored: article=%s version=%s kind=%s",
        article.id, v.id, v.kind,
    )
    flash("Откатили к выбранной версии. Текущее состояние сохранено в авто-слот.", "success")
    return redirect(url_for("articles.view", world_id=world_id, article_id=article_id))


@bp.route("/<article_id>/versions/<version_id>/delete", methods=["POST"])
@login_required
def delete_version(world_id: str, article_id: str, version_id: str):
    v = _get_owned_version(world_id, article_id, version_id)
    kind = v.kind
    db.session.delete(v)
    db.session.commit()
    flash(f"Версия удалена ({'авто' if kind == 'auto' else 'ручная'}).", "info")
    return redirect(url_for("articles.versions", world_id=world_id, article_id=article_id))


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
