"""Аутентификация: email/password + Google OAuth."""
from datetime import datetime, timezone

from flask import Blueprint, current_app, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required, login_user, logout_user

from extensions import db, oauth
from forms import LoginForm, RegisterForm
from models import User

bp = Blueprint("auth", __name__)


@bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("worlds.index"))

    form = LoginForm()
    if form.validate_on_submit():
        user = db.session.execute(
            db.select(User).filter_by(email=form.email.data.lower().strip())
        ).scalar_one_or_none()

        if user is None or not user.check_password(form.password.data):
            flash("Неверный email или пароль.", "error")
            return render_template("auth/login.html", form=form)

        if user.is_blocked:
            flash("Этот аккаунт заблокирован.", "error")
            return render_template("auth/login.html", form=form)

        login_user(user, remember=form.remember.data)
        user.last_sign_in = datetime.now(timezone.utc)
        db.session.commit()
        flash("С возвращением.", "success")
        return _safe_redirect_after_login()

    return render_template("auth/login.html", form=form)


@bp.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("worlds.index"))

    form = RegisterForm()
    if form.validate_on_submit():
        email = form.email.data.lower().strip()
        existing = db.session.execute(
            db.select(User).filter_by(email=email)
        ).scalar_one_or_none()
        if existing is not None:
            flash("Аккаунт с таким email уже есть. Войди.", "error")
            return render_template("auth/register.html", form=form)

        user = User(email=email, display_name=form.display_name.data.strip())
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()

        login_user(user)
        flash("Аккаунт создан. Поехали строить миры.", "success")
        return redirect(url_for("worlds.index"))

    return render_template("auth/register.html", form=form)


@bp.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    flash("Сессия завершена.", "info")
    return redirect(url_for("auth.login"))


# ─── Google OAuth ────────────────────────────────────────────

@bp.route("/google")
def google_login():
    if not current_app.config["GOOGLE_OAUTH_ENABLED"]:
        flash("Google OAuth не настроен на сервере.", "error")
        return redirect(url_for("auth.login"))
    redirect_uri = url_for("auth.google_callback", _external=True)
    return oauth.google.authorize_redirect(redirect_uri)


@bp.route("/google/callback")
def google_callback():
    if not current_app.config["GOOGLE_OAUTH_ENABLED"]:
        return redirect(url_for("auth.login"))

    try:
        token = oauth.google.authorize_access_token()
    except Exception as e:
        flash(f"Не удалось войти через Google: {e}", "error")
        return redirect(url_for("auth.login"))

    info = token.get("userinfo") or {}
    google_sub = info.get("sub")
    email = (info.get("email") or "").lower().strip()
    if not google_sub or not email:
        flash("Google не вернул email — войти не получилось.", "error")
        return redirect(url_for("auth.login"))

    # Ищем по google_sub, потом по email (на случай если пользователь уже регался по email)
    user = db.session.execute(
        db.select(User).filter_by(google_sub=google_sub)
    ).scalar_one_or_none()
    if user is None:
        user = db.session.execute(
            db.select(User).filter_by(email=email)
        ).scalar_one_or_none()
        if user is not None:
            user.google_sub = google_sub
        else:
            user = User(
                email=email,
                google_sub=google_sub,
                display_name=info.get("name") or email.split("@")[0],
                avatar_url=info.get("picture"),
            )
            db.session.add(user)

    if user.is_blocked:
        flash("Этот аккаунт заблокирован.", "error")
        return redirect(url_for("auth.login"))

    user.last_sign_in = datetime.now(timezone.utc)
    db.session.commit()
    login_user(user, remember=True)
    flash("Добро пожаловать.", "success")
    return _safe_redirect_after_login()


def _safe_redirect_after_login():
    """Возврат на ?next=... если он внутренний; иначе на /worlds."""
    next_url = request.args.get("next") or ""
    if next_url.startswith("/") and not next_url.startswith("//"):
        return redirect(next_url)
    return redirect(url_for("worlds.index"))
