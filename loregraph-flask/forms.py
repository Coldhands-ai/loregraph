"""Все формы приложения. WTForms + Flask-WTF (для CSRF)."""
from flask_wtf import FlaskForm
from flask_wtf.file import FileField, FileAllowed, FileSize
from wtforms import (
    StringField, PasswordField, TextAreaField, SelectField, HiddenField,
    BooleanField, IntegerField, FieldList, FormField,
)
from wtforms.validators import DataRequired, Email, Length, EqualTo, Optional, NumberRange, Regexp


class LoginForm(FlaskForm):
    email = StringField("Email", validators=[DataRequired(), Email(), Length(max=255)])
    password = PasswordField("Пароль", validators=[DataRequired(), Length(min=6, max=128)])
    remember = BooleanField("Запомнить меня")


PASSWORD_RULES = [
    DataRequired(),
    Length(min=8, max=128, message="Минимум 8 символов."),
    Regexp(r".*\d.*", message="Хотя бы одна цифра."),
]


class RegisterForm(FlaskForm):
    display_name = StringField("Имя", validators=[DataRequired(), Length(min=1, max=100)])
    email = StringField("Email", validators=[DataRequired(), Email(), Length(max=255)])
    password = PasswordField("Пароль", validators=PASSWORD_RULES)
    confirm = PasswordField(
        "Повтори пароль",
        validators=[DataRequired(), EqualTo("password", message="Пароли не совпадают")],
    )


SETTING_CHOICES = [
    ("default",     "По умолчанию"),
    ("fantasy",     "Фэнтези"),
    ("darkfantasy", "Тёмное фэнтези"),
    ("scifi",       "Научная фантастика"),
    ("cyberpunk",   "Киберпанк"),
    ("steampunk",   "Стимпанк"),
    ("wasteland",   "Постапокалипсис"),
    ("custom",      "Кастом"),
]

CUSTOM_FONT_CHOICES = [
    ("Newsreader",           "Newsreader (классический серифный)"),
    ("Cinzel",               "Cinzel (капители)"),
    ("Cinzel Decorative",    "Cinzel Decorative (орнаментальные капители)"),
    ("MedievalSharp",        "MedievalSharp (готика, темное фэнтези)"),
    ("Orbitron",             "Orbitron (геометрический sans)"),
    ("Audiowide",            "Audiowide (футуристический неон)"),
    ("IM Fell English",      "IM Fell English (старая печать)"),
    ("Special Elite",        "Special Elite (печатная машинка)"),
    ("Rye",                  "Rye (потрёпанный вестерн)"),
]


class WorldForm(FlaskForm):
    title = StringField("Название", validators=[DataRequired(), Length(min=1, max=100)])
    description = TextAreaField("Описание", validators=[Optional(), Length(max=500)])
    setting = SelectField(
        "Сеттинг",
        validators=[DataRequired()],
        choices=SETTING_CHOICES,
        default="default",
    )
    # Кастомные параметры — применяются только если setting == 'custom'.
    custom_brand = StringField(
        "Brand-цвет",
        validators=[Optional(), Regexp(r"^#[0-9a-fA-F]{6}$", message="Формат: #RRGGBB")],
        default="#3B82F6",
    )
    custom_font = SelectField(
        "Display-шрифт",
        validators=[Optional()],
        choices=CUSTOM_FONT_CHOICES,
        default="Newsreader",
    )


class ArticleCreateForm(FlaskForm):
    title = StringField("Название", validators=[DataRequired(), Length(min=1, max=200)])
    category_id = SelectField("Категория", validators=[Optional()], choices=[])

    def set_category_choices(self, categories) -> None:
        self.category_id.choices = [("", "— без категории —")] + [
            (c.id, c.name) for c in categories
        ]


class RelationForm(FlaskForm):
    target_article_id = HiddenField(validators=[DataRequired()])
    label = StringField("Тип связи", validators=[DataRequired(), Length(min=1, max=100)])
    description = TextAreaField("Описание", validators=[Optional(), Length(max=500)])


class CategoryForm(FlaskForm):
    name = StringField("Название", validators=[DataRequired(), Length(min=1, max=100)])
    color = StringField(
        "Цвет",
        validators=[DataRequired(), Regexp(r"^#[0-9a-fA-F]{6}$", message="Формат: #RRGGBB")],
        default="#3B82F6",
    )
    icon = StringField("Иконка", validators=[Optional(), Length(max=50)])
    weight = IntegerField(
        "Вес узла на графе (1-5)",
        validators=[DataRequired(), NumberRange(min=1, max=5)],
        default=3,
    )
    sort_order = IntegerField("Порядок", validators=[Optional(), NumberRange(min=0, max=999)], default=0)
    # template_fields в форме обрабатываем сами (через JSON, отдельно)


class ProfileForm(FlaskForm):
    display_name = StringField("Имя", validators=[DataRequired(), Length(min=1, max=100)])


class PasswordChangeForm(FlaskForm):
    current_password = PasswordField("Текущий пароль", validators=[Optional()])
    new_password = PasswordField("Новый пароль", validators=PASSWORD_RULES)
    confirm = PasswordField(
        "Повтори новый пароль",
        validators=[DataRequired(), EqualTo("new_password", message="Пароли не совпадают")],
    )


class AvatarUploadForm(FlaskForm):
    avatar = FileField(
        "Аватар",
        validators=[
            FileAllowed(["jpg", "jpeg", "png", "webp", "gif"], "Только картинки."),
            FileSize(max_size=5 * 1024 * 1024, message="Макс. 5 МБ"),
        ],
    )


class CoverUploadForm(FlaskForm):
    cover = FileField(
        "Обложка статьи",
        validators=[
            FileAllowed(["jpg", "jpeg", "png", "webp", "gif"], "Только картинки."),
            FileSize(max_size=5 * 1024 * 1024, message="Макс. 5 МБ"),
        ],
    )
