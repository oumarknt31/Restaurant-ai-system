from flask import Blueprint, request, jsonify

from extensions import db
from models import Dish

menu_bp = Blueprint("menu", __name__, url_prefix="/api/menu")


@menu_bp.route("/", methods=["GET"])
def get_menu():
    dishes = Dish.query.all()

    data = []
    for d in dishes:
        data.append(
            {
                "id": d.id,
                "name": d.name,
                "description": d.description,
                "price": d.price,
                "image_url": d.image_url,
                "is_vip_only": d.is_vip_only,
            }
        )

    return jsonify({"dishes": data})


@menu_bp.route("/", methods=["POST"])
def create_dish():
    """
    Simple dish creation endpoint.
    For now we don't enforce auth here — later we’ll limit to chef/manager.
    """
    data = request.get_json() or {}

    name = data.get("name", "").strip()
    description = data.get("description", "").strip()
    price = data.get("price")
    is_vip_only = bool(data.get("is_vip_only", False))

    if not name or not description or price is None:
        return jsonify({"error": "name, description, price are required"}), 400

    try:
        price = float(price)
    except ValueError:
        return jsonify({"error": "price must be a number"}), 400

    dish = Dish(
        name=name,
        description=description,
        price=price,
        is_vip_only=is_vip_only,
    )

    db.session.add(dish)
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Dish created",
                "dish": {
                    "id": dish.id,
                    "name": dish.name,
                    "description": dish.description,
                    "price": dish.price,
                    "image_url": dish.image_url,
                    "is_vip_only": dish.is_vip_only,
                },
            }
        ),
        201,
    )
