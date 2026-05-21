"""Конфигурация приложения. Все секреты — из .env."""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")


class Config:
    SECRET_KEY = os.environ["FLASK_SECRET_KEY"]
    SQLALCHEMY_DATABASE_URI = os.environ["DATABASE_URL"]
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Лимит формы — 5 МБ (см. FileSize в forms.py и MAX_BYTES в storage.py).
    # На уровне запроса даём небольшой запас под multipart-обвязку и поля формы.
    MAX_CONTENT_LENGTH = 8 * 1024 * 1024

    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_OAUTH_ENABLED = bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)

    # Длительность сессии Flask-Login
    REMEMBER_COOKIE_DURATION = 60 * 60 * 24 * 30  # 30 дней

    # Безопасность cookies. SECURE = True только когда запускаем поверх HTTPS.
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "0") == "1"
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SAMESITE = "Lax"

    # CSRF: продлеваем срок жизни, иначе долгая работа в редакторе ловит
    # CSRFError на autosave через час.
    WTF_CSRF_TIME_LIMIT = 60 * 60 * 8  # 8 часов
