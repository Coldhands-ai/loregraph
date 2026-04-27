"""Все формы приложения. WTForms + Flask-WTF (для CSRF)."""
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, TextAreaField, SelectField, HiddenField, BooleanField
from wtforms.validators import DataRequired, Email, Length, EqualTo, Optional


class LoginForm(FlaskForm):
    email = StringField("Email", validators=[DataRequired(), Email(), Length(max=255)])
    password = PasswordField("Пароль", validators=[DataRequired(), Length(min=6, max=128)])
    remember = BooleanField("Запомнить меня")


class RegisterForm(FlaskForm):
    display_name = StringField(
        "Имя", validators=[DataRequired(), Length(min=1, max=100)]
    )
    email = StringField("Email", validators=[DataRequired(), Email(), Length(max=255)])
    password = PasswordField(
        "Пароль", validators=[DataRequired(), Length(min=6, max=128)]
    )
    confirm = PasswordField(
        "Повтори пароль",
        validators=[DataRequired(), EqualTo("password", message="Пароли не совпадают")],
    )


class WorldForm(FlaskForm):
    title = StringField(
        "Название", validators=[DataRequired(), Length(min=1, max=100)]
    )
    description = TextAreaField("Описание", validators=[Optional(), Length(max=500)])


class ArticleCreateForm(FlaskForm):
    title = StringField(
        "Название", validators=[DataRequired(), Length(min=1, max=200)]
    )
    category_id = SelectField("Категория", validators=[Optional()], choices=[])

    def set_category_choices(self, categories) -> None:
        self.category_id.choices = [("", "— без категории —")] + [
            (c.id, c.name) for c in categories
        ]


class RelationForm(FlaskForm):
    target_article_id = HiddenField(validators=[DataRequired()])
    label = StringField("Тип связи", validators=[DataRequired(), Length(min=1, max=100)])
    description = TextAreaField("Описание", validators=[Optional(), Length(max=500)])
