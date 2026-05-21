"""Админ-панель: дашборд, управление пользователями и мирами, аудит-лог."""
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import Blueprint, abort, current_app, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required
from sqlalchemy import func

from extensions import db
from models import AdminLog, Article, Relation, User, World
from storage import delete_image

bp = Blueprint("admin", __name__, url_prefix="/admin")

# Размер страницы для всех списков админки. 25 — компромисс между плотностью
# таблицы и количеством скроллов.
PAGE_SIZE = 25


class Pagination:
    """Минимальная пагинация: считает количество страниц и помогает рендерить навигацию.
    Не используем Flask-SQLAlchemy.paginate, чтобы не зависеть от его API и
    одинаково работать с db.select() для items и для count."""

    def __init__(self, items, page: int, per_page: int, total: int):
        self.items = items
        self.page = page
        self.per_page = per_page
        self.total = total
        self.pages = (total + per_page - 1) // per_page if total else 0
        self.has_prev = page > 1
        self.has_next = page < self.pages
        self.prev_num = page - 1 if self.has_prev else None
        self.next_num = page + 1 if self.has_next else None

    def iter_pages(self, edge: int = 1, window: int = 2):
        """Номера страниц для навигации с «…» вместо длинного диапазона.
        Возвращает None в местах разрывов. Пример (16 страниц, текущая 8):
        1, None, 6, 7, 8, 9, 10, None, 16."""
        last = 0
        for num in range(1, self.pages + 1):
            if (
                num <= edge
                or num > self.pages - edge
                or abs(num - self.page) <= window
            ):
                if last + 1 < num:
                    yield None
                yield num
                last = num


def _page_arg() -> int:
    try:
        return max(1, int(request.args.get("page", "1")))
    except (TypeError, ValueError):
        return 1


@bp.before_request
@login_required
def require_admin():
    if not current_user.is_admin:
        abort(403)


def log(action: str, *, target_user: User | None = None, target_world: World | None = None,
        details: dict | None = None) -> None:
    """Записывает действие админа в audit-лог."""
    db.session.add(AdminLog(
        admin_id=current_user.id,
        action=action,
        target_user_id=target_user.id if target_user else None,
        target_world_id=target_world.id if target_world else None,
        details=details,
    ))
    # commit делает caller


# ─── Дашборд ────────────────────────────────────────────────

@bp.route("/", methods=["GET"])
def dashboard():
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    stats = {
        "users_total": db.session.scalar(db.select(func.count()).select_from(User)),
        "users_blocked": db.session.scalar(
            db.select(func.count()).select_from(User).filter_by(is_blocked=True)
        ),
        "users_admins": db.session.scalar(
            db.select(func.count()).select_from(User).filter_by(role="admin")
        ),
        "users_new_week": db.session.scalar(
            db.select(func.count()).select_from(User).filter(User.created_at >= week_ago)
        ),
        "worlds_total": db.session.scalar(db.select(func.count()).select_from(World)),
        "articles_total": db.session.scalar(db.select(func.count()).select_from(Article)),
        "relations_total": db.session.scalar(db.select(func.count()).select_from(Relation)),
        "articles_new_week": db.session.scalar(
            db.select(func.count()).select_from(Article).filter(Article.created_at >= week_ago)
        ),
    }

    # Топ-5 миров по числу статей
    top_worlds = db.session.execute(
        db.select(World, func.count(Article.id).label("n"))
        .join(Article, Article.world_id == World.id, isouter=True)
        .group_by(World.id)
        .order_by(func.count(Article.id).desc())
        .limit(5)
    ).all()

    # Свежие действия
    recent_logs = db.session.execute(
        db.select(AdminLog).order_by(AdminLog.created_at.desc()).limit(10)
    ).scalars().all()

    return render_template(
        "admin/dashboard.html",
        stats=stats,
        top_worlds=top_worlds,
        recent_logs=recent_logs,
    )


# ─── Пользователи ───────────────────────────────────────────

@bp.route("/users", methods=["GET"])
def users():
    q = (request.args.get("q") or "").strip()
    page = _page_arg()

    base = db.select(User)
    count_base = db.select(func.count()).select_from(User)
    if q:
        cond = User.email.ilike(f"%{q}%") | User.display_name.ilike(f"%{q}%")
        base = base.filter(cond)
        count_base = count_base.filter(cond)

    total = db.session.scalar(count_base) or 0
    items = db.session.execute(
        base.order_by(User.created_at.desc())
            .limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE)
    ).scalars().all()
    pagination = Pagination(items, page, PAGE_SIZE, total)

    # Кол-во миров у каждого — берём только для отображаемой страницы, чтобы
    # не тянуть полный список по всей базе.
    user_ids = [u.id for u in items]
    if user_ids:
        counts = dict(db.session.execute(
            db.select(World.user_id, func.count(World.id))
            .filter(World.user_id.in_(user_ids))
            .group_by(World.user_id)
        ).all())
        counts = {str(k): v for k, v in counts.items()}
    else:
        counts = {}

    return render_template(
        "admin/users.html",
        users=items, pagination=pagination, world_counts=counts, q=q,
    )


def _get_user_or_404(user_id: str) -> User:
    user = db.session.get(User, user_id)
    if user is None:
        abort(404)
    return user


@bp.route("/users/<user_id>/block", methods=["POST"])
def block_user(user_id: str):
    user = _get_user_or_404(user_id)
    if user.id == current_user.id:
        flash("Себя заблокировать нельзя.", "error")
        return redirect(url_for("admin.users"))
    user.is_blocked = True
    log("block_user", target_user=user)
    db.session.commit()
    flash(f"Пользователь {user.email} заблокирован.", "info")
    return redirect(url_for("admin.users"))


@bp.route("/users/<user_id>/unblock", methods=["POST"])
def unblock_user(user_id: str):
    user = _get_user_or_404(user_id)
    user.is_blocked = False
    log("unblock_user", target_user=user)
    db.session.commit()
    flash(f"Пользователь {user.email} разблокирован.", "success")
    return redirect(url_for("admin.users"))


@bp.route("/users/<user_id>/promote", methods=["POST"])
def promote_user(user_id: str):
    user = _get_user_or_404(user_id)
    user.role = "admin"
    log("promote_admin", target_user=user)
    db.session.commit()
    flash(f"{user.email} теперь администратор.", "success")
    return redirect(url_for("admin.users"))


@bp.route("/users/<user_id>/demote", methods=["POST"])
def demote_user(user_id: str):
    user = _get_user_or_404(user_id)
    if user.id == current_user.id:
        flash("Себя из админов снять нельзя.", "error")
        return redirect(url_for("admin.users"))
    # Защита: нельзя снять последнего админа
    admins_count = db.session.scalar(
        db.select(func.count()).select_from(User).filter_by(role="admin")
    )
    if admins_count <= 1:
        flash("Нельзя снять права у последнего администратора.", "error")
        return redirect(url_for("admin.users"))
    user.role = "user"
    log("demote_admin", target_user=user)
    db.session.commit()
    flash(f"{user.email} больше не администратор.", "info")
    return redirect(url_for("admin.users"))


# ─── Миры ───────────────────────────────────────────────────

@bp.route("/worlds", methods=["GET"])
def worlds():
    q = (request.args.get("q") or "").strip()
    page = _page_arg()

    base = (
        db.select(World, User, func.count(Article.id).label("n_articles"))
        .join(User, User.id == World.user_id)
        .join(Article, Article.world_id == World.id, isouter=True)
        .group_by(World.id, User.id)
        .order_by(World.created_at.desc())
    )
    count_base = (
        db.select(func.count())
        .select_from(World)
        .join(User, User.id == World.user_id)
    )
    if q:
        cond = World.title.ilike(f"%{q}%") | User.email.ilike(f"%{q}%")
        base = base.filter(cond)
        count_base = count_base.filter(cond)

    total = db.session.scalar(count_base) or 0
    rows = db.session.execute(
        base.limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE)
    ).all()
    pagination = Pagination(rows, page, PAGE_SIZE, total)

    return render_template("admin/worlds.html", rows=rows, pagination=pagination, q=q)


@bp.route("/worlds/<world_id>/delete", methods=["POST"])
def delete_world(world_id: str):
    world = db.session.get(World, world_id)
    if world is None:
        abort(404)
    title = world.title
    owner_email = world.owner.email
    # Удаляем обложки статей с диска
    for article in world.articles:
        if article.image_url:
            delete_image(article.image_url, current_app.root_path)
    log("delete_world", target_world=world, target_user=world.owner,
        details={"title": title, "owner": owner_email})
    db.session.delete(world)
    db.session.commit()
    flash(f"Мир «{title}» (владелец: {owner_email}) удалён.", "info")
    return redirect(url_for("admin.worlds"))


# ─── Лог действий ───────────────────────────────────────────

@bp.route("/logs", methods=["GET"])
def logs():
    page = _page_arg()

    total = db.session.scalar(db.select(func.count()).select_from(AdminLog)) or 0
    items = db.session.execute(
        db.select(AdminLog)
        .order_by(AdminLog.created_at.desc())
        .limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE)
    ).scalars().all()
    pagination = Pagination(items, page, PAGE_SIZE, total)
    return render_template("admin/logs.html", logs=items, pagination=pagination)
