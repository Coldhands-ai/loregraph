"""SQLAlchemy-модели LoreGraph."""
from datetime import datetime, timezone
from uuid import uuid4

import bcrypt
from flask_login import UserMixin
from sqlalchemy import (
    CheckConstraint,
    Computed,
    ForeignKey,
    Index,
    String,
    Text,
    Boolean,
    Integer,
    DateTime,
    UniqueConstraint,
    event,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, Session, mapped_column, relationship

from extensions import db


def _uuid() -> str:
    return str(uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# Стандартные template_fields для разных типов сущностей. Переиспользуются
# в наборах категорий разных сеттингов.
_F_CHARACTER = [
    {"key": "race",       "label": "Раса",             "type": "text"},
    {"key": "occupation", "label": "Род деятельности", "type": "text"},
    {"key": "birth_date", "label": "Дата рождения",    "type": "text"},
    {"key": "status",     "label": "Статус",           "type": "text"},
]
_F_LOCATION = [
    {"key": "kind",       "label": "Тип",        "type": "text"},
    {"key": "climate",    "label": "Климат",     "type": "text"},
    {"key": "ruler",      "label": "Правитель",  "type": "text"},
    {"key": "population", "label": "Население",  "type": "text"},
]
_F_EVENT = [
    {"key": "date",         "label": "Когда",      "type": "text"},
    {"key": "place",        "label": "Где",        "type": "text"},
    {"key": "participants", "label": "Участники",  "type": "text"},
    {"key": "outcome",      "label": "Итог",       "type": "text"},
]
_F_ITEM = [
    {"key": "kind",     "label": "Тип",           "type": "text"},
    {"key": "material", "label": "Материал",      "type": "text"},
    {"key": "owner",    "label": "Владелец",      "type": "text"},
    {"key": "origin",   "label": "Происхождение", "type": "text"},
]
_F_FACTION = [
    {"key": "leader",       "label": "Лидер",  "type": "text"},
    {"key": "headquarters", "label": "Штаб",   "type": "text"},
    {"key": "motto",        "label": "Девиз",  "type": "text"},
    {"key": "goals",        "label": "Цели",   "type": "textarea"},
]
_F_PLANET = [
    {"key": "kind",       "label": "Тип",        "type": "text"},
    {"key": "atmosphere", "label": "Атмосфера",  "type": "text"},
    {"key": "gravity",    "label": "Гравитация", "type": "text"},
    {"key": "system",     "label": "Система",    "type": "text"},
]
_F_TECH = [
    {"key": "kind",         "label": "Тип",          "type": "text"},
    {"key": "manufacturer", "label": "Производитель","type": "text"},
    {"key": "era",          "label": "Эпоха",        "type": "text"},
    {"key": "function",     "label": "Назначение",   "type": "text"},
]
_F_CORP = [
    {"key": "ceo",          "label": "Глава",        "type": "text"},
    {"key": "headquarters", "label": "Штаб-квартира","type": "text"},
    {"key": "sector",       "label": "Сектор",       "type": "text"},
    {"key": "goals",        "label": "Цели",         "type": "textarea"},
]
_F_DISTRICT = [
    {"key": "vibe",       "label": "Атмосфера",  "type": "text"},
    {"key": "controlled", "label": "Кто рулит",  "type": "text"},
    {"key": "danger",     "label": "Уровень опасности", "type": "text"},
    {"key": "population", "label": "Население",  "type": "text"},
]
_F_INCIDENT = [
    {"key": "date",     "label": "Когда",     "type": "text"},
    {"key": "place",    "label": "Где",       "type": "text"},
    {"key": "casualties", "label": "Потери",  "type": "text"},
    {"key": "outcome",  "label": "Развязка",  "type": "textarea"},
]
_F_AUGMENT = [
    {"key": "kind",         "label": "Тип",            "type": "text"},
    {"key": "manufacturer", "label": "Производитель",  "type": "text"},
    {"key": "side_effects", "label": "Побочные эффекты", "type": "textarea"},
    {"key": "owner",        "label": "Установлен у",   "type": "text"},
]
_F_ARTIFACT = [
    {"key": "origin",   "label": "Происхождение", "type": "text"},
    {"key": "material", "label": "Материал",      "type": "text"},
    {"key": "powers",   "label": "Свойства",      "type": "textarea"},
    {"key": "owner",    "label": "Владелец",      "type": "text"},
]
_F_ORDER = [
    {"key": "leader",       "label": "Магистр",  "type": "text"},
    {"key": "headquarters", "label": "Цитадель", "type": "text"},
    {"key": "creed",        "label": "Кредо",    "type": "text"},
    {"key": "goals",        "label": "Цели",     "type": "textarea"},
]
_F_MECHANISM = [
    {"key": "purpose",      "label": "Назначение",     "type": "text"},
    {"key": "inventor",     "label": "Изобретатель",   "type": "text"},
    {"key": "fuel",         "label": "Источник энергии", "type": "text"},
    {"key": "complexity",   "label": "Сложность",      "type": "text"},
]
_F_GUILD = [
    {"key": "master",       "label": "Магистр гильдии", "type": "text"},
    {"key": "headquarters", "label": "Здание",          "type": "text"},
    {"key": "trade",        "label": "Ремесло",         "type": "text"},
    {"key": "members",      "label": "Известные члены", "type": "textarea"},
]
_F_ZONE = [
    {"key": "kind",     "label": "Тип",          "type": "text"},
    {"key": "danger",   "label": "Опасность",    "type": "text"},
    {"key": "ruler",    "label": "Кто заправляет", "type": "text"},
    {"key": "loot",     "label": "Что искать",   "type": "text"},
]
_F_JUNK = [
    {"key": "kind",     "label": "Что это",        "type": "text"},
    {"key": "found",    "label": "Где нашли",      "type": "text"},
    {"key": "value",    "label": "Чем ценно",      "type": "text"},
    {"key": "owner",    "label": "У кого",         "type": "text"},
]
_F_GANG = [
    {"key": "leader",       "label": "Главарь",      "type": "text"},
    {"key": "headquarters", "label": "Логово",       "type": "text"},
    {"key": "size",         "label": "Численность",  "type": "text"},
    {"key": "goals",        "label": "Чего хотят",   "type": "textarea"},
]


def _cat(name, color, sort_order, weight, fields):
    return {
        "name": name, "color": color, "icon": None,
        "sort_order": sort_order, "weight": weight,
        "template_fields": fields,
    }


# Наборы категорий под сеттинги. Палитра подобрана внутри тематики:
# у каждого сеттинга 5 цветов, гармоничных друг другу.
SETTING_PRESETS = {
    "default": [
        _cat("Персонаж", "#3B82F6", 1, 4, _F_CHARACTER),
        _cat("Локация",  "#10B981", 2, 4, _F_LOCATION),
        _cat("Событие",  "#F59E0B", 3, 2, _F_EVENT),
        _cat("Предмет",  "#EF4444", 4, 2, _F_ITEM),
        _cat("Фракция",  "#8B5CF6", 5, 5, _F_FACTION),
    ],
    "fantasy": [
        _cat("Персонаж", "#C9A86A", 1, 4, _F_CHARACTER),
        _cat("Локация",  "#7C9B3F", 2, 4, _F_LOCATION),
        _cat("Событие",  "#B8493F", 3, 2, _F_EVENT),
        _cat("Артефакт", "#8B5A2B", 4, 2, _F_ARTIFACT),
        _cat("Орден",    "#5E3023", 5, 5, _F_ORDER),
    ],
    "darkfantasy": [
        _cat("Странник",   "#A82430", 1, 4, _F_CHARACTER),
        _cat("Руина",      "#6E6E78", 2, 4, _F_LOCATION),
        _cat("Проклятие",  "#5C3D6E", 3, 2, _F_EVENT),
        _cat("Реликвия",   "#8B7A3F", 4, 2, _F_ARTIFACT),
        _cat("Культ",      "#6B1F2A", 5, 5, _F_ORDER),
    ],
    "scifi": [
        _cat("Персонаж",   "#0EA5E9", 1, 4, _F_CHARACTER),
        _cat("Планета",    "#10B981", 2, 4, _F_PLANET),
        _cat("Событие",    "#F59E0B", 3, 2, _F_EVENT),
        _cat("Технология", "#A855F7", 4, 2, _F_TECH),
        _cat("Корпорация", "#EC4899", 5, 5, _F_CORP),
    ],
    "cyberpunk": [
        _cat("Персонаж",   "#FF2E93", 1, 4, _F_CHARACTER),
        _cat("Район",      "#00E5FF", 2, 4, _F_DISTRICT),
        _cat("Инцидент",   "#FFD60A", 3, 2, _F_INCIDENT),
        _cat("Имплант",    "#9D4EDD", 4, 2, _F_AUGMENT),
        _cat("Корпорация", "#FF4D6D", 5, 5, _F_CORP),
    ],
    "steampunk": [
        _cat("Персонаж", "#B08D57", 1, 4, _F_CHARACTER),
        _cat("Город",    "#704214", 2, 4, _F_LOCATION),
        _cat("Событие",  "#A0522D", 3, 2, _F_EVENT),
        _cat("Механизм", "#CD7F32", 4, 2, _F_MECHANISM),
        _cat("Гильдия",  "#5C4033", 5, 5, _F_GUILD),
    ],
    "wasteland": [
        _cat("Выживший", "#C26A33", 1, 4, _F_CHARACTER),
        _cat("Зона",     "#8B5C1F", 2, 4, _F_ZONE),
        _cat("Инцидент", "#B94E2E", 3, 2, _F_INCIDENT),
        _cat("Хлам",     "#7A634A", 4, 2, _F_JUNK),
        _cat("Банда",    "#5A3826", 5, 5, _F_GANG),
    ],
    "custom": [  # тот же набор, что у default — пользователь потом переделает
        _cat("Персонаж", "#3B82F6", 1, 4, _F_CHARACTER),
        _cat("Локация",  "#10B981", 2, 4, _F_LOCATION),
        _cat("Событие",  "#F59E0B", 3, 2, _F_EVENT),
        _cat("Предмет",  "#EF4444", 4, 2, _F_ITEM),
        _cat("Фракция",  "#8B5CF6", 5, 5, _F_FACTION),
    ],
}

# Список валидных значений World.setting — используется в формах и валидации.
SETTING_KEYS = list(SETTING_PRESETS.keys())

# Для обратной совместимости — если где-то ещё фигурировало.
DEFAULT_CATEGORIES = SETTING_PRESETS["default"]


class User(db.Model, UserMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    display_name: Mapped[str | None] = mapped_column(String(100))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16), default="user", nullable=False)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    last_sign_in: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    worlds: Mapped[list["World"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    bookmarks: Mapped[list["Bookmark"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint("role IN ('user', 'admin')", name="ck_users_role"),
    )

    def set_password(self, password: str) -> None:
        self.password_hash = bcrypt.hashpw(
            password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

    def check_password(self, password: str) -> bool:
        if not self.password_hash:
            return False
        return bcrypt.checkpw(password.encode("utf-8"), self.password_hash.encode("utf-8"))

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


class World(db.Model):
    __tablename__ = "worlds"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    cover_url: Mapped[str | None] = mapped_column(Text)
    # Визуальный пресет. Возможные значения смотри в SETTING_KEYS.
    # Применяется через data-setting на <html> только внутри страниц мира.
    setting: Mapped[str] = mapped_column(String(32), default="default", nullable=False)
    # Кастомные параметры темы. Используется только если setting='custom'.
    # Структура: {"brand": "#RRGGBB", "font": "Cormorant Garamond"}.
    custom_theme: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )

    owner: Mapped[User] = relationship(back_populates="worlds")
    categories: Mapped[list["Category"]] = relationship(
        back_populates="world", cascade="all, delete-orphan", order_by="Category.sort_order"
    )
    articles: Mapped[list["Article"]] = relationship(
        back_populates="world", cascade="all, delete-orphan"
    )
    relations: Mapped[list["Relation"]] = relationship(
        back_populates="world", cascade="all, delete-orphan"
    )
    tags: Mapped[list["Tag"]] = relationship(
        back_populates="world", cascade="all, delete-orphan", order_by="Tag.name"
    )

    def seed_default_categories(self) -> None:
        """Создаёт 5 предустановленных категорий, соответствующих self.setting."""
        preset = SETTING_PRESETS.get(self.setting or "default", SETTING_PRESETS["default"])
        for c in preset:
            self.categories.append(Category(**c))


class Category(db.Model):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    world_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("worlds.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(9), default="#3B82F6", nullable=False)
    icon: Mapped[str | None] = mapped_column(String(50))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    weight: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    template_fields: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    world: Mapped[World] = relationship(back_populates="categories")
    articles: Mapped[list["Article"]] = relationship(back_populates="category")

    __table_args__ = (
        UniqueConstraint("world_id", "name", name="uq_categories_world_name"),
        CheckConstraint("weight BETWEEN 1 AND 5", name="ck_categories_weight"),
    )


class Article(db.Model):
    __tablename__ = "articles"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    world_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("worlds.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("categories.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content_md: Mapped[str] = mapped_column(Text, default="", nullable=False)
    field_values: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(Text)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Когда был сделан последний автоматический снапшот версии. Стартует с
    # created_at и сдвигается каждый раз, когда автосейв создаёт авто-версию.
    last_auto_version_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, onupdate=_now, nullable=False
    )

    world: Mapped[World] = relationship(back_populates="articles")
    category: Mapped[Category | None] = relationship(back_populates="articles")
    relations_out: Mapped[list["Relation"]] = relationship(
        foreign_keys="Relation.source_article_id",
        back_populates="source",
        cascade="all, delete-orphan",
    )
    relations_in: Mapped[list["Relation"]] = relationship(
        foreign_keys="Relation.target_article_id",
        back_populates="target",
        cascade="all, delete-orphan",
    )
    versions: Mapped[list["ArticleVersion"]] = relationship(
        back_populates="article",
        cascade="all, delete-orphan",
        order_by="ArticleVersion.created_at.desc()",
    )
    tags: Mapped[list["Tag"]] = relationship(
        secondary="article_tags", back_populates="articles", order_by="Tag.name"
    )
    bookmarks: Mapped[list["Bookmark"]] = relationship(
        back_populates="article", cascade="all, delete-orphan"
    )

    # FTS-вектор. Generated/STORED — Postgres сам пересчитывает на каждый
    # UPDATE title/content_md, нам ничего трогать в коде не нужно.
    # Веса: A для заголовка, C для контента — заголовок ранкуется выше.
    search_vector: Mapped[str | None] = mapped_column(
        TSVECTOR,
        Computed(
            "setweight(to_tsvector('russian', coalesce(title, '')), 'A') || "
            "setweight(to_tsvector('russian', coalesce(content_md, '')), 'C')",
            persisted=True,
        ),
    )

    __table_args__ = (
        Index("ix_articles_world_updated", "world_id", "updated_at"),
        Index("ix_articles_search", "search_vector", postgresql_using="gin"),
    )


class ArticleVersion(db.Model):
    """Снапшот статьи. Два вида:
       - 'auto' — создаётся автосейвом раз в ~30 минут, максимум 3 слота (rolling).
       - 'manual' — пользователь жмёт «Сохранить версию», максимум 2 слота, не перезаписываются автоматически.
    """
    __tablename__ = "article_versions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    article_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(8), nullable=False)  # 'auto' | 'manual'
    name: Mapped[str | None] = mapped_column(String(100))  # только для manual

    # Снапшот контента статьи на момент создания версии
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content_md: Mapped[str] = mapped_column(Text, default="", nullable=False)
    field_values: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    category_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("categories.id", ondelete="SET NULL")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False, index=True
    )

    article: Mapped[Article] = relationship(back_populates="versions")

    __table_args__ = (
        CheckConstraint("kind IN ('auto', 'manual')", name="ck_article_versions_kind"),
    )


class AdminLog(db.Model):
    """Append-only журнал действий админа: блокировки, удаления, смены ролей."""
    __tablename__ = "admin_logs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    admin_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    target_user_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL")
    )
    target_world_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("worlds.id", ondelete="SET NULL")
    )
    details: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False, index=True
    )

    admin: Mapped[User] = relationship(foreign_keys=[admin_id])
    target_user: Mapped[User | None] = relationship(foreign_keys=[target_user_id])
    target_world: Mapped[World | None] = relationship(foreign_keys=[target_world_id])


class Relation(db.Model):
    __tablename__ = "relations"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    world_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("worlds.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_article_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_article_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    world: Mapped[World] = relationship(back_populates="relations")
    source: Mapped[Article] = relationship(
        foreign_keys=[source_article_id], back_populates="relations_out"
    )
    target: Mapped[Article] = relationship(
        foreign_keys=[target_article_id], back_populates="relations_in"
    )

    __table_args__ = (
        CheckConstraint(
            "source_article_id <> target_article_id", name="ck_relations_source_ne_target"
        ),
        UniqueConstraint(
            "source_article_id", "target_article_id", "label",
            name="uq_relations_source_target_label",
        ),
    )


# ─── Теги и М2М article_tags ───────────────────────────────

class Tag(db.Model):
    __tablename__ = "tags"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    world_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("worlds.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    # Цвет опционален. Если None — рендерится дефолтным брендовым.
    color: Mapped[str | None] = mapped_column(String(9))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    world: Mapped[World] = relationship(back_populates="tags")
    articles: Mapped[list[Article]] = relationship(secondary="article_tags", back_populates="tags")

    __table_args__ = (
        UniqueConstraint("world_id", "name", name="uq_tags_world_name"),
    )


# М2М без отдельной модели — простая ассоциация с каскадным удалением
# через FK constraints.
article_tags = db.Table(
    "article_tags",
    db.Column(
        "article_id", UUID(as_uuid=False),
        ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True,
    ),
    db.Column(
        "tag_id", UUID(as_uuid=False),
        ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True,
    ),
)


# ─── Закладки ──────────────────────────────────────────────

class Bookmark(db.Model):
    """Личные закладки пользователя на статьи. Кросс-мировые."""
    __tablename__ = "bookmarks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    article_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, nullable=False)

    user: Mapped[User] = relationship(back_populates="bookmarks")
    article: Mapped[Article] = relationship(back_populates="bookmarks")

    __table_args__ = (
        UniqueConstraint("user_id", "article_id", name="uq_bookmarks_user_article"),
    )


# ─── Каскад World.updated_at ────────────────────────────────
# При любом изменении/создании/удалении статьи или связи поднимаем
# World.updated_at — чтобы в списке миров «обновлено» отражало
# реальную активность, а не только правку названия/описания мира.

@event.listens_for(Session, "before_flush")
def _bump_world_updated_at(session, _flush_context, _instances) -> None:
    affected: set[str] = set()
    for obj in list(session.new) + list(session.dirty) + list(session.deleted):
        if isinstance(obj, (Article, Relation)) and getattr(obj, "world_id", None):
            affected.add(obj.world_id)
    deleted_world_ids = {w.id for w in session.deleted if isinstance(w, World)}
    affected -= deleted_world_ids
    if not affected:
        return
    session.query(World).filter(World.id.in_(affected)).update(
        {"updated_at": _now()}, synchronize_session=False
    )
