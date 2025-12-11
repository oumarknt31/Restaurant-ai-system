from flask import Blueprint, request, jsonify
from sqlalchemy import func

from extensions import db
from models import User, Dish, Order, OrderItem, Feedback

recommendation_bp = Blueprint(
    "recommendations", __name__, url_prefix="/api/recommendations"
)


def _most_ordered_for_user(user_id, limit=5):
    """
    Return the user's most-ordered dishes with times_ordered.
    """
    rows = (
        db.session.query(
            Dish.id,
            Dish.name,
            Dish.description,
            Dish.price,
            Dish.image_url,
            Dish.is_vip_only,
            func.sum(OrderItem.quantity).label("times_ordered"),
        )
        .join(OrderItem, OrderItem.dish_id == Dish.id)
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Order.customer_id == user_id)
        .group_by(Dish.id)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "dish_id": d_id,
            "name": name,
            "description": description,
            "price": price,
            "image_url": image_url,
            "is_vip_only": is_vip_only,
            "times_ordered": int(times_ordered or 0),
        }
        for (
            d_id,
            name,
            description,
            price,
            image_url,
            is_vip_only,
            times_ordered,
        ) in rows
    ]


def _highest_rated_for_user(user_id, limit=5):
    """
    Return dishes *this user* has rated, sorted by their average rating.
    """
    rows = (
        db.session.query(
            Dish.id,
            Dish.name,
            Dish.description,
            Dish.price,
            Dish.image_url,
            Dish.is_vip_only,
            func.avg(Feedback.rating).label("avg_rating"),
            func.count(Feedback.id).label("rating_count"),
        )
        .join(Dish, Dish.id == Feedback.dish_id)
        .filter(
            Feedback.accuser_id == user_id,
            Feedback.dish_id.isnot(None),
            Feedback.rating.isnot(None),
        )
        .group_by(Dish.id)
        .order_by(func.avg(Feedback.rating).desc(), func.count(Feedback.id).desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "dish_id": d_id,
            "name": name,
            "description": description,
            "price": price,
            "image_url": image_url,
            "is_vip_only": is_vip_only,
            "avg_rating": float(avg_rating or 0),
            "rating_count": int(rating_count or 0),
        }
        for (
            d_id,
            name,
            description,
            price,
            image_url,
            is_vip_only,
            avg_rating,
            rating_count,
        ) in rows
    ]


def _global_most_popular(limit=5):
    """
    Return globally most ordered dishes.
    """
    rows = (
        db.session.query(
            Dish.id,
            Dish.name,
            Dish.description,
            Dish.price,
            Dish.image_url,
            Dish.is_vip_only,
            func.sum(OrderItem.quantity).label("times_ordered"),
        )
        .join(OrderItem, OrderItem.dish_id == Dish.id)
        .join(Order, Order.id == OrderItem.order_id)
        .group_by(Dish.id)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "dish_id": d_id,
            "name": name,
            "description": description,
            "price": price,
            "image_url": image_url,
            "is_vip_only": is_vip_only,
            "times_ordered": int(times_ordered or 0),
        }
        for (
            d_id,
            name,
            description,
            price,
            image_url,
            is_vip_only,
            times_ordered,
        ) in rows
    ]


def _global_highest_rated(limit=5):
    """
    Return globally highest-rated dishes based on Feedback.dish_id + rating.
    """
    rows = (
        db.session.query(
            Dish.id,
            Dish.name,
            Dish.description,
            Dish.price,
            Dish.image_url,
            Dish.is_vip_only,
            func.avg(Feedback.rating).label("avg_rating"),
            func.count(Feedback.id).label("rating_count"),
        )
        .join(Dish, Dish.id == Feedback.dish_id)
        .filter(
            Feedback.dish_id.isnot(None),
            Feedback.rating.isnot(None),
        )
        .group_by(Dish.id)
        .order_by(func.avg(Feedback.rating).desc(), func.count(Feedback.id).desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "dish_id": d_id,
            "name": name,
            "description": description,
            "price": price,
            "image_url": image_url,
            "is_vip_only": is_vip_only,
            "avg_rating": float(avg_rating or 0),
            "rating_count": int(rating_count or 0),
        }
        for (
            d_id,
            name,
            description,
            price,
            image_url,
            is_vip_only,
            avg_rating,
            rating_count,
        ) in rows
    ]


@recommendation_bp.route("/home-summary", methods=["GET"])
def home_summary():
    """
    Returns recommendation info for the Home page.

    Optional query param:
      ?user_id=<id>

    Response:
    {
      "user": { "id": ..., "name": ..., "role": ... } | null,
      "has_history": true/false,
      "personal": {
        "most_ordered": [...],
        "highest_rated": [...]
      },
      "global": {
        "most_popular": [...],
        "highest_rated": [...]
      }
    }
    """
    user_id = request.args.get("user_id", type=int)
    user = User.query.get(user_id) if user_id else None

    personal_most_ordered = []
    personal_highest_rated = []

    if user:
        personal_most_ordered = _most_ordered_for_user(user.id)
        personal_highest_rated = _highest_rated_for_user(user.id)

    has_history = bool(personal_most_ordered or personal_highest_rated)

    global_popular = _global_most_popular()
    global_highest = _global_highest_rated()

    return jsonify(
        {
            "user": {
                "id": user.id,
                "name": user.name,
                "role": user.role,
            }
            if user
            else None,
            "has_history": has_history,
            "personal": {
                "most_ordered": personal_most_ordered,
                "highest_rated": personal_highest_rated,
            },
            "global": {
                "most_popular": global_popular,
                "highest_rated": global_highest,
            },
        }
    ), 200
