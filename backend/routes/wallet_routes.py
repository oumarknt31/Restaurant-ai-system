from flask import Blueprint, request, jsonify

from extensions import db
from models import User

wallet_bp = Blueprint("wallet", __name__, url_prefix="/api/wallet")


@wallet_bp.route("/deposit", methods=["POST"])
def deposit():
    """
    Add funds to a user's deposit_balance.

    Expected JSON body:
    {
      "user_id": 1,
      "amount": 50.0
    }
    """
    data = request.get_json() or {}

    user_id = data.get("user_id")
    amount = data.get("amount")

    # Basic validation
    if user_id is None or amount is None:
        return jsonify({"error": "user_id and amount are required"}), 400

    try:
        amount = float(amount)
    except ValueError:
        return jsonify({"error": "amount must be a number"}), 400

    if amount <= 0:
        return jsonify({"error": "amount must be > 0"}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if not user.is_active or user.is_blacklisted:
        return jsonify({"error": "User is not allowed to deposit"}), 403

    # Update balance
    user.deposit_balance += amount
    db.session.commit()

    return jsonify(
        {
            "message": "Deposit successful",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "deposit_balance": user.deposit_balance,
            },
        }
    )
