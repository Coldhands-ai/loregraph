"""Закладки пользователя — кросс-мировая страница со всеми сохранёнными статьями."""
from collections import OrderedDict

from flask import Blueprint, render_template
from flask_login import current_user, login_required

from extensions import db
from models import Bookmark

bp = Blueprint("bookmarks", __name__, url_prefix="/bookmarks")


@bp.route("/", methods=["GET"])
@login_required
def index():
    bookmarks = db.session.execute(
        db.select(Bookmark)
        .filter_by(user_id=current_user.id)
        .order_by(Bookmark.created_at.desc())
    ).scalars().all()

    # Группировка по миру: сохраняем порядок «свежие сверху»
    grouped: "OrderedDict[str, dict]" = OrderedDict()
    for b in bookmarks:
        article = b.article
        if article is None:  # на всякий — каскад должен подчищать
            continue
        wid = article.world_id
        if wid not in grouped:
            grouped[wid] = {"world": article.world, "items": []}
        grouped[wid]["items"].append(article)

    return render_template("bookmarks/index.html", grouped=list(grouped.values()))
