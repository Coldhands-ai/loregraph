"""Глобальный поиск: FTS по статьям во всех мирах текущего пользователя.
Результаты группируются по миру, сниппет подсвечен через ts_headline."""
from collections import OrderedDict

import bleach
from flask import Blueprint, render_template, request
from flask_login import current_user, login_required

from extensions import db
from models import Article, World
from routes.articles import build_tsquery

bp = Blueprint("search", __name__, url_prefix="/search")

# Параметры подсветки сниппета. <mark> добавит браузер; стили — в base/styles.css
_HEADLINE_OPTS = "StartSel=<mark>, StopSel=</mark>, MaxWords=24, MinWords=8, ShortWord=2, MaxFragments=1"


@bp.route("/", methods=["GET"])
@login_required
def index():
    q = request.args.get("q", "").strip()
    fts_str = build_tsquery(q) if q else None
    if not fts_str:
        return render_template("search/index.html", q=q, groups=[], total=0)

    ts_query = db.func.to_tsquery("russian", fts_str)
    rank = db.func.ts_rank(Article.search_vector, ts_query).label("rank")
    headline = db.func.ts_headline(
        "russian", Article.content_md, ts_query, _HEADLINE_OPTS
    ).label("headline")

    rows = db.session.execute(
        db.select(Article, headline, rank)
        .join(World, World.id == Article.world_id)
        .filter(World.user_id == current_user.id)
        .filter(Article.search_vector.op("@@")(ts_query))
        .order_by(rank.desc(), Article.updated_at.desc())
        .limit(50)
    ).all()

    # Группируем по миру, сохраняя порядок (первый мир — где лучшая статья)
    groups: "OrderedDict[str, dict]" = OrderedDict()
    for article, snippet, _ in rows:
        wid = article.world_id
        if wid not in groups:
            groups[wid] = {"world": article.world, "items": []}
        groups[wid]["items"].append({
            "article": article,
            "snippet": bleach.clean(snippet or "", tags=["mark"], attributes={}, strip=True),
        })

    return render_template(
        "search/index.html",
        q=q,
        groups=list(groups.values()),
        total=len(rows),
    )
