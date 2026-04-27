"""SQLAlchemy-модели LoreGraph."""
from datetime import datetime, timezone
from uuid import uuid4

import bcrypt
from flask_login import UserMixin
from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    String,
    Text,
    Boolean,
    Integer,
    DateTime,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from extensions import db


def _uuid() -> str:
    return str(uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# Предустановленные категории — создаются при создании мира.
# weight задаёт важность (1-5) — влияет на размер узла в графе.
# template_fields — структурированные подсказки для авторов: при создании
# статьи такой категории показываются эти поля над текстом.
DEFAULT_CATEGORIES = [
    {
        "name": "Персонаж", "color": "#3B82F6", "icon": "user",
        "sort_order": 1, "weight": 4,
        "template_fields": [
            {"key": "race",       "label": "Раса",            "type": "text"},
            {"key": "occupation", "label": "Род деятельности", "type": "text"},
            {"key": "birth_date", "label": "Дата рождения",   "type": "text"},
            {"key": "status",     "label": "Статус",          "type": "text"},
        ],
    },
    {
        "name": "Локация", "color": "#10B981", "icon": "map-pin",
        "sort_order": 2, "weight": 4,
        "template_fields": [
            {"key": "kind",    "label": "Тип",     "type": "text"},
            {"key": "climate", "label": "Климат",  "type": "text"},
            {"key": "ruler",   "label": "Правитель", "type": "text"},
            {"key": "population", "label": "Население", "type": "text"},
        ],
    },
    {
        "name": "Событие", "color": "#F59E0B", "icon": "calendar",
        "sort_order": 3, "weight": 2,
        "template_fields": [
            {"key": "date",        "label": "Когда",    "type": "text"},
            {"key": "place",       "label": "Где",      "type": "text"},
            {"key": "participants", "label": "Участники", "type": "text"},
            {"key": "outcome",     "label": "Итог",     "type": "text"},
        ],
    },
    {
        "name": "Предмет", "color": "#EF4444", "icon": "sword",
        "sort_order": 4, "weight": 2,
        "template_fields": [
            {"key": "kind",     "label": "Тип",       "type": "text"},
            {"key": "material", "label": "Материал",  "type": "text"},
            {"key": "owner",    "label": "Владелец",  "type": "text"},
            {"key": "origin",   "label": "Происхождение", "type": "text"},
        ],
    },
    {
        "name": "Фракция", "color": "#8B5CF6", "icon": "shield",
        "sort_order": 5, "weight": 5,
        "template_fields": [
            {"key": "leader",      "label": "Лидер",      "type": "text"},
            {"key": "headquarters", "label": "Штаб",       "type": "text"},
            {"key": "motto",       "label": "Девиз",      "type": "text"},
            {"key": "goals",       "label": "Цели",       "type": "textarea"},
        ],
    },
]


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

    def seed_default_categories(self) -> None:
        for c in DEFAULT_CATEGORIES:
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

    __table_args__ = (
        Index("ix_articles_world_updated", "world_id", "updated_at"),
    )


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
