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
    query = db.select(User).order_by(User.created_at.desc())
    if q:
        query = query.filter(User.email.ilike(f"%{q}%") | User.display_name.ilike(f"%{q}%"))
    users_list = db.session.execute(query).scalars().all()

    # Кол-во миров у каждого
    counts = dict(db.session.execute(
        db.select(World.user_id, func.count(World.id)).group_by(World.user_id)
    ).all())
    counts = {str(k): v for k, v in counts.items()}

    return render_template("admin/users.html", users=users_list, world_counts=counts, q=q)


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
    query = (
        db.select(World, User, func.count(Article.id).label("n_articles"))
        .join(User, User.id == World.user_id)
        .join(Article, Article.world_id == World.id, isouter=True)
        .group_by(World.id, User.id)
        .order_by(World.created_at.desc())
    )
    if q:
        query = query.filter(World.title.ilike(f"%{q}%") | User.email.ilike(f"%{q}%"))
    rows = db.session.execute(query).all()
    return render_template("admin/worlds.html", rows=rows, q=q)


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
    page_size = 50
    logs_list = db.session.execute(
        db.select(AdminLog).order_by(AdminLog.created_at.desc()).limit(page_size)
    ).scalars().all()
    return render_template("admin/logs.html", logs=logs_list)
