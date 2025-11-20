from flask import Blueprint, request, jsonify

from extensions import db
from models import User, Dish, Order, OrderItem

order_bp = Blueprint("orders", __name__, url_prefix="/api/orders")


def maybe_update_vip_status(user):
    """
    Promote a user to VIP based on simple rules.
    Returns True if the user was just promoted.
    """

    # Already VIP? Nothing to do.
    if user.role == "vip":
        return False

    # Example rules:
    # - total_spent >= 200 OR
    # - order_count >= 5
    if user.total_spent >= 200 or user.order_count >= 5:
        user.role = "vip"
        return True

    return False


@order_bp.route("/", methods=["POST"])
def create_order():
    """
    Create a new order.

    Expected JSON body:
    {
      "user_id": 1,
      "items": [
        {"dish_id": 1, "quantity": 2},
        {"dish_id": 3, "quantity": 1}
      ]
    }
    """
    data = request.get_json() or {}

    user_id = data.get("user_id")
    items = data.get("items", [])

    if not user_id or not items:
        return jsonify({"error": "user_id and items are required"}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if user.is_blacklisted or not user.is_active:
        return jsonify({"error": "User is not allowed to place orders"}), 403

    # Collect dish IDs and fetch them from DB
    dish_ids = [item.get("dish_id") for item in items]
    if any(d_id is None for d_id in dish_ids):
        return jsonify({"error": "Each item must include dish_id"}), 400

    dishes = Dish.query.filter(Dish.id.in_(dish_ids)).all()
    dishes_by_id = {d.id: d for d in dishes}

    # Check all requested dishes exist
    missing = [d_id for d_id in dish_ids if d_id not in dishes_by_id]
    if missing:
        return jsonify({"error": f"Unknown dish_id(s): {missing}"}), 400

    # Calculate total price and enforce VIP-only rules
    subtotal = 0.0
    normalized_items = []
    vip_only_dish_ids = []

    for item in items:
        dish_id = item["dish_id"]
        quantity = int(item.get("quantity", 1))
        if quantity <= 0:
            return jsonify({"error": "quantity must be >= 1"}), 400

        dish = dishes_by_id[dish_id]

        # If dish is VIP-only and user is NOT VIP, block the order
        if dish.is_vip_only and user.role != "vip":
            vip_only_dish_ids.append(dish_id)
            continue  # we can accumulate then fail later (or fail immediately)

        subtotal += dish.price * quantity
        normalized_items.append((dish, quantity))

    if vip_only_dish_ids and user.role != "vip":
        return jsonify(
            {
                "error": "Non-VIP users cannot order VIP-only dishes.",
                "vip_only_dish_ids": vip_only_dish_ids,
                "user_role": user.role,
            }
        ), 403


    # VIP discount: 5% for VIP customers
    discount = 0.0
    if user.role == "vip":
        discount = round(subtotal * 0.05, 2)

    total = subtotal - discount

    # Check balance
    if user.deposit_balance < total:
        return jsonify(
            {
                "error": "Insufficient balance",
                "required": total,
                "current_balance": user.deposit_balance,
            }
        ), 400

    # Create order + order items
    order = Order(
        customer_id=user.id,
        status="paid",  # we'll assume instant payment for now
        total_price=total,
        discount_applied=discount,
    )
    db.session.add(order)
    db.session.flush()  # get order.id before creating items

    for dish, qty in normalized_items:
        item = OrderItem(
            order_id=order.id,
            dish_id=dish.id,
            quantity=qty,
            unit_price=dish.price,
        )
        db.session.add(item)

    # Update user stats
    user.deposit_balance -= total
    user.total_spent += total
    user.order_count += 1

    # VIP promotion
    just_promoted = maybe_update_vip_status(user)

    db.session.commit()

    # Build response
    return jsonify(
        {
            "message": "Order created",
            "order": {
                "id": order.id,
                "customer_id": order.customer_id,
                "status": order.status,
                "subtotal": subtotal,
                "discount": discount,
                "total": total,
                "items": [
                    {
                        "dish_id": i.dish_id,
                        "quantity": i.quantity,
                        "unit_price": i.unit_price,
                    }
                    for i in order.items
                ],
            },
            "user_balance": user.deposit_balance,
            "vip_status": {
                "role": user.role,
                "just_promoted": just_promoted,
            },
        }
    ), 201


@order_bp.route("/user/<int:user_id>", methods=["GET"])
def list_orders_for_user(user_id):
    """Simple endpoint to fetch all orders for a given user_id."""
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    orders = (
        Order.query.filter_by(customer_id=user_id)
        .order_by(Order.created_at.desc())
        .all()
    )

    data = []
    for o in orders:
        data.append(
            {
                "id": o.id,
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
