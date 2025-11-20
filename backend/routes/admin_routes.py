from flask import Blueprint, jsonify, request

from extensions import db
from models import User, Order


admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@admin_bp.route("/users", methods=["GET"])
def list_users():
    """
    List all users with key stats.
    WARNING: In a real app this must be protected (manager/admin only).
    """

    users = User.query.order_by(User.id.asc()).all()
    data = []

    for u in users:
        data.append(
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "deposit_balance": u.deposit_balance,
                "total_spent": u.total_spent,
                "order_count": u.order_count,
                "warnings": u.warnings,
                "is_blacklisted": u.is_blacklisted,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat(),
            }
        )

    return jsonify({"users": data})


@admin_bp.route("/orders", methods=["GET"])
def list_all_orders():
    """
    List all orders in the system.
    WARNING: In a real app this must be protected (manager/admin only).
    """

    orders = Order.query.order_by(Order.created_at.desc()).all()
    data = []

    for o in orders:
        data.append(
            {
                "id": o.id,
                "customer_id": o.customer_id,
                "status": o.status,
                "total_price": o.total_price,
                "discount_applied": o.discount_applied,
                "created_at": o.created_at.isoformat(),
                "items": [
                    {
                        "dish_id": item.dish_id,
                        "quantity": item.quantity,
                        "unit_price": item.unit_price,
                    }
                    for item in o.items
                ],
            }
        )

    return jsonify({"orders": data})


@admin_bp.route("/users/<int:user_id>/status", methods=["PATCH"])
def update_user_status(user_id):
    """
    Update a user's active / blacklisted status.

    JSON body can include:
    {
      "is_active": true/false,
      "is_blacklisted": true/false
    }

    Any field omitted will be left unchanged.
    """

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}

    # Only update fields that are present
    if "is_active" in data:
        user.is_active = bool(data["is_active"])

    if "is_blacklisted" in data:
        user.is_blacklisted = bool(data["is_blacklisted"])

    db.session.commit()

    return jsonify(
        {
            "message": "User status updated",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role,
                "deposit_balance": user.deposit_balance,
                "total_spent": user.total_spent,
                "order_count": user.order_count,
                "warnings": user.warnings,
                "is_blacklisted": user.is_blacklisted,
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat(),
            },
        }
    )



@admin_bp.route("/orders/<int:order_id>/status", methods=["PATCH"])
def update_order_status(order_id):
    """
    Update an order's status.

    Expected JSON body:
    {
      "status": "pending" | "paid" | "preparing" | "on_the_way" | "delivered" | "cancelled"
    }
    """

    order = Order.query.get(order_id)
    if not order:
        return jsonify({"error": "Order not found"}), 404

    data = request.get_json() or {}
    new_status = data.get("status")

    if not new_status:
        return jsonify({"error": "status is required"}), 400

    allowed_statuses = {
      "pending",
      "paid",
      "preparing",
      "on_the_way",
      "delivered",
      "cancelled",
    }

    if new_status not in allowed_statuses:
        return jsonify(
            {
                "error": f"Invalid status. Must be one of {sorted(list(allowed_statuses))}."
            }
        ), 400

    order.status = new_status
    db.session.commit()

    return jsonify(
        {
            "message": "Order status updated",
            "order": {
                "id": order.id,
                "customer_id": order.customer_id,
                "status": order.status,
                "total_price": order.total_price,
                "discount_applied": order.discount_applied,
                "created_at": order.created_at.isoformat(),
                "items": [
                    {
                        "dish_id": item.dish_id,
                        "quantity": item.quantity,
                        "unit_price": item.unit_price,
                    }
                    for item in order.items
                ],
            },
        }
    )



@admin_bp.route("/users/<int:user_id>/role", methods=["PATCH"])
def update_user_role(user_id):
    """
    Update a user's role.

    Expected JSON body:
    {
      "role": "customer" | "vip" | "chef" | "manager" | "delivery"
    }
    """
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    new_role = data.get("role")

    if not new_role:
        return jsonify({"error": "role is required"}), 400

    allowed_roles = {"customer", "vip", "chef", "manager", "delivery"}

    if new_role not in allowed_roles:
        return (
            jsonify(
                {
                    "error": f"Invalid role. Must be one of {sorted(list(allowed_roles))}."
                }
            ),
            400,
        )

    user.role = new_role
    db.session.commit()

    return jsonify(
        {
            "message": "User role updated",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role,
                "deposit_balance": user.deposit_balance,
                "total_spent": user.total_spent,
                "order_count": user.order_count,
                "warnings": user.warnings,
                "is_blacklisted": user.is_blacklisted,
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat(),
            },
        }
    )
