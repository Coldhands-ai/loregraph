"""Точка входа: фабрика приложения + регистрация blueprint'ов."""
from flask import Flask, redirect, render_template, url_for
from flask_login import current_user

from config import Config
from extensions import db, login_manager, csrf, oauth
from models import User


def create_app(config_class: type = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Расширения
    db.init_app(app)
    login_manager.init_app(app)
    csrf.init_app(app)
    oauth.init_app(app)

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

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(worlds_bp, url_prefix="/worlds")
    app.register_blueprint(articles_bp)  # пути уже включают /worlds/<id>/articles
    app.register_blueprint(graph_bp)     # пути уже включают /worlds/<id>/graph

    # Корень → мирам или логину
    @app.route("/")
    def index():
        if current_user.is_authenticated:
            return redirect(url_for("worlds.index"))
        return redirect(url_for("auth.login"))

    # Ошибки
    @app.errorhandler(404)
    def not_found(_e):
        return render_template("errors/404.html"), 404

    @app.errorhandler(500)
    def server_error(_e):
        return render_template("errors/500.html"), 500

    # Создание схемы при первом запуске. Без миграций — для учебного проекта норм.
    with app.app_context():
        db.create_all()

    return app


# Для `flask --app app run`
app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
