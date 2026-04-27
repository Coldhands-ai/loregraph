"""Все Flask-расширения создаём здесь, чтобы избежать циклических импортов."""
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from authlib.integrations.flask_client import OAuth

db = SQLAlchemy()
login_manager = LoginManager()
csrf = CSRFProtect()
oauth = OAuth()

login_manager.login_view = "auth.login"
login_manager.login_message = "Войди, чтобы продолжить."
login_manager.login_message_category = "info"
