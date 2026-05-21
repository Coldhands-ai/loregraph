"""Точка входа: фабрика приложения + регистрация blueprint'ов."""
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

import click
from flask import Flask, redirect, render_template, request, url_for
from flask_login import current_user

from config import Config
from extensions import db, migrate, login_manager, csrf, oauth
from models import User, World


def _configure_logging(app: Flask) -> None:
    """Файловое логирование с ротацией. Дев-консольный вывод Flask не трогаем."""
    if app.config.get("TESTING"):
        return
    logs_dir = Path(app.root_path) / "logs"
    logs_dir.mkdir(exist_ok=True)

    handler = RotatingFileHandler(
        logs_dir / "loregraph.log",
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    handler.setLevel(logging.INFO)
    handler.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    ))
    app.logger.addHandler(handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info("LoreGraph started")


def create_app(config_class: type = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Расширения
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    csrf.init_app(app)
    oauth.init_app(app)

    _configure_logging(app)

    # Папка для загрузок (картинки статей, аватары)
    (Path(app.root_path) / "static" / "uploads").mkdir(parents=True, exist_ok=True)

    # Google OAuth — регистрируем только если есть ключи
    if app.config["GOOGLE_OAUTH_ENABLED"]:
        oauth.register(
            name="google",
            client_id=app.config["GOOGLE_CLIENT_ID"],
            client_secret=app.config["GOOGLE_CLIENT_SECRET"],
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )

    @login_manager.user_loader
    def load_user(user_id: str) -> User | None:
        return db.session.get(User, user_id)

    # Blueprints
    from routes.auth import bp as auth_bp
    from routes.worlds import bp as worlds_bp
    from routes.articles import bp as articles_bp
    from routes.graph import bp as graph_bp
    from routes.categories import bp as categories_bp
    from routes.profile import bp as profile_bp
    from routes.admin import bp as admin_bp
    from routes.bookmarks import bp as bookmarks_bp
    from routes.search import bp as search_bp

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(worlds_bp, url_prefix="/worlds")
    app.register_blueprint(articles_bp)
    app.register_blueprint(graph_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(bookmarks_bp)
    app.register_blueprint(search_bp)

    def _build_custom_overrides(theme: dict) -> str | None:
        """Из World.custom_theme собирает inline <style>, перекрывающий
        CSS-переменные для data-setting='custom'."""
        brand_hex = (theme.get("brand") or "#3B82F6").lstrip("#")
        try:
            r = int(brand_hex[0:2], 16)
            g = int(brand_hex[2:4], 16)
            b = int(brand_hex[4:6], 16)
        except (ValueError, IndexError):
            return None
        font = (theme.get("font") or "Newsreader").replace("'", "")
        return (
            ":root[data-setting='custom'] {"
            f"--color-brand: {r} {g} {b};"
            f"--color-brand-violet: {r} {g} {b};"
            f"--font-display: '{font}', Newsreader, Georgia, serif;"
            "}"
        )

    # Текущий мир и сеттинг — доступны во всех шаблонах, чтобы навбар
    # показывал имя мира и <html data-setting> применял правильную тему.
    @app.context_processor
    def inject_world_context() -> dict:
        setting = "default"
        current_world = None
        custom_css = None
        world_id = (request.view_args or {}).get("world_id")
        if world_id and current_user.is_authenticated:
            world = db.session.get(World, world_id)
            if world and (world.user_id == current_user.id or current_user.is_admin):
                current_world = world
                setting = world.setting or "default"
                if setting == "custom" and world.custom_theme:
                    custom_css = _build_custom_overrides(world.custom_theme)
        return {
            "current_setting": setting,
            "current_world": current_world,
            "custom_css_overrides": custom_css,
        }

    # Корень → мирам или логину
    @app.route("/")
    def index():
        if current_user.is_authenticated:
            return redirect(url_for("worlds.index"))
        return redirect(url_for("auth.login"))

    # Ошибки
    @app.errorhandler(403)
    def forbidden(_e):
        return render_template("errors/403.html"), 403

    @app.errorhandler(404)
    def not_found(_e):
        return render_template("errors/404.html"), 404

    @app.errorhandler(500)
    def server_error(_e):
        return render_template("errors/500.html"), 500

    @app.errorhandler(413)
    def request_too_large(_e):
        return render_template("errors/413.html"), 413

    # CLI-команды
    @app.cli.command("make-admin")
    @click.argument("email")
    def make_admin(email: str) -> None:
        """Выдать роль admin пользователю по email.

        Использование: flask --app app make-admin user@example.com
        """
        user = db.session.execute(
            db.select(User).filter_by(email=email.lower().strip())
        ).scalar_one_or_none()
        if user is None:
            click.echo(f"Пользователь {email} не найден.", err=True)
            return
        if user.role == "admin":
            click.echo(f"{email} уже администратор.")
            return
        user.role = "admin"
        db.session.commit()
        click.echo(f"OK: {email} → admin")

    return app


# Для `flask --app app run`
app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
