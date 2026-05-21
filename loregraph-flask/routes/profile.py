"""Профиль пользователя: имя, аватар, смена пароля."""
from flask import Blueprint, current_app, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from extensions import db
from forms import AvatarUploadForm, PasswordChangeForm, ProfileForm
from storage import UploadError, delete_image, save_image

bp = Blueprint("profile", __name__, url_prefix="/profile")


@bp.route("/", methods=["GET"])
@login_required
def view():
    return render_template(
        "profile/edit.html",
        profile_form=ProfileForm(display_name=current_user.display_name),
        password_form=PasswordChangeForm(),
        avatar_form=AvatarUploadForm(),
    )


@bp.route("/update", methods=["POST"])
@login_required
def update():
    form = ProfileForm()
    if not form.validate_on_submit():
        flash("Имя обязательно.", "error")
        return redirect(url_for("profile.view"))
    current_user.display_name = form.display_name.data.strip()
    db.session.commit()
    flash("Профиль обновлён.", "success")
    return redirect(url_for("profile.view"))


@bp.route("/password", methods=["POST"])
@login_required
def change_password():
    form = PasswordChangeForm()
    if not form.validate_on_submit():
        flash("Проверь поля пароля.", "error")
        return redirect(url_for("profile.view"))

    # Если у юзера есть пароль (не только OAuth) — требуем текущий
    if current_user.password_hash:
        if not form.current_password.data or not current_user.check_password(form.current_password.data):
            flash("Текущий пароль неверный.", "error")
            return redirect(url_for("profile.view"))

    current_user.set_password(form.new_password.data)
    db.session.commit()
    flash("Пароль изменён.", "success")
    return redirect(url_for("profile.view"))


@bp.route("/avatar", methods=["POST"])
@login_required
def upload_avatar():
    form = AvatarUploadForm()
    if not form.validate_on_submit():
        flash("Не удалось загрузить — проверь формат и размер.", "error")
        return redirect(url_for("profile.view"))

    try:
        url = save_image(
            form.avatar.data,
            subdir=f"avatars/{current_user.id}",
            base_dir=current_app.root_path,
            max_size=(512, 512),
        )
    except UploadError as e:
        flash(str(e), "error")
        return redirect(url_for("profile.view"))

    # Удаляем предыдущий, если был свой (не Google-аватар)
    if current_user.avatar_url and current_user.avatar_url.startswith("/static/uploads/"):
        delete_image(current_user.avatar_url, current_app.root_path)
    current_user.avatar_url = url
    db.session.commit()
    flash("Аватар обновлён.", "success")
    return redirect(url_for("profile.view"))


@bp.route("/avatar/delete", methods=["POST"])
@login_required
def delete_avatar():
    if current_user.avatar_url and current_user.avatar_url.startswith("/static/uploads/"):
        delete_image(current_user.avatar_url, current_app.root_path)
    current_user.avatar_url = None
    db.session.commit()
    flash("Аватар удалён.", "info")
    return redirect(url_for("profile.view"))
