from datetime import datetime

from flask import Blueprint, request, jsonify

from sqlalchemy import func
from extensions import db
from models import User, Feedback, Order, Dish, DeliveryJob

reputation_bp = Blueprint("reputation", __name__, url_prefix="/api/reputation")


# ---------- Helper functions ----------

def normalize_star_rating(value):
    """
    Ensure rating is an int between 1 and 5.
    Raises ValueError if invalid.
    """
    r = int(value)
    if r < 1 or r > 5:
        raise ValueError("rating must be between 1 and 5")
    return r


def apply_customer_warning_rules(user: User):
    """
    Apply HR rules based on user.warnings.

    Rules:
    - Registered customers (role='customer') with 3 warnings are deregistered
      (we mark them inactive + blacklisted).
    - VIPs (role='vip') with 2 warnings are downgraded to registered customers
      and their warnings are cleared.
    - Delivery roles can accumulate warnings, but we do not auto-fire them here
      (manager can act manually via manager UI).
    """

    if user.warnings is None:
        return

    # VIP downgrade rule
    if user.role == "vip" and user.warnings >= 2:
        user.role = "customer"
        user.warnings = 0  # warnings cleared when demoted
        # keep them active and not blacklisted
        return

    # Customer deregister rule
    if user.role == "customer" and user.warnings >= 3:
        user.is_active = False
        user.is_blacklisted = True



def recalculate_chef_hr_actions(chef: User):
    """
    Chef HR rules:

    NEGATIVE SIDE:
    - average rating < 2 OR >= 3 upheld complaints:
        first time -> demote (chef -> junior_chef, with a pay cut)
        second time -> fire (deactivate + blacklist)

    POSITIVE SIDE:
    - average rating > 4 OR >= 3 compliments:
        -> bonus (pay raise)

    VIP customers' complaints/compliments are counted twice as important:
    - Their ratings count double in the average rating.
    - Their upheld complaints count as 2 in the complaint tally.
    - Their compliments also count as 2 in the compliment tally.
    """

    # Only apply to chef-like roles
    if chef.role not in ["chef", "junior_chef"]:
        return

    # ---------- Average rating (weighted by VIP) ----------
    rating_rows = (
        Feedback.query.filter(
            Feedback.target_user_id == chef.id,
            Feedback.rating.isnot(None),
        ).all()
    )
    avg_rating = None
    if rating_rows:
        total = 0
        count = 0
        for f in rating_rows:
            if f.rating is None:
                continue
            # double weight if accuser is VIP
            weight = 2 if (f.accuser is not None and f.accuser.role == "vip") else 1
            total += f.rating * weight
            count += weight

        if count > 0:
            avg_rating = total / count

    # ---------- Upheld complaints (weighted by VIP) ----------
    upheld_complaints = Feedback.query.filter(
        Feedback.target_user_id == chef.id,
        Feedback.type == "complaint",
        Feedback.status == "upheld",
    ).all()

    upheld_complaints_count = 0
    for f in upheld_complaints:
        weight = 2 if (f.accuser is not None and f.accuser.role == "vip") else 1
        upheld_complaints_count += weight

    # ---------- Compliments (weighted by VIP) ----------
    compliment_rows = Feedback.query.filter(
        Feedback.target_user_id == chef.id,
        Feedback.type == "compliment",
    ).all()

    compliments_count = 0
    for f in compliment_rows:
        weight = 2 if (f.accuser is not None and f.accuser.role == "vip") else 1
        compliments_count += weight

    # ---------- Decide HR action ----------

    negative_trigger = False
    if avg_rating is not None and avg_rating < 2:
        negative_trigger = True
    if upheld_complaints_count >= 3:
        negative_trigger = True

    positive_trigger = False
    if avg_rating is not None and avg_rating > 4:
        positive_trigger = True
    if compliments_count >= 3:
        positive_trigger = True

    # If both good and bad signals happen at the same time, bad wins.
    if negative_trigger:
        # First trigger: demote chef -> junior_chef AND cut pay
        if chef.role == "chef":
            chef.role = "junior_chef"
            if chef.pay_rate is not None:
                chef.pay_rate = round((chef.pay_rate or 0.0) * 0.8, 2)
        # Second trigger: fire (deactivate + blacklist)
        elif chef.role == "junior_chef":
            chef.is_active = False
            chef.is_blacklisted = True

        return

    # Only apply positive bonus if NOT in a negative trigger
    if positive_trigger:
        # Give a bonus raise (e.g., +10%)
        if chef.pay_rate is not None:
            chef.pay_rate = round((chef.pay_rate or 0.0) * 1.10, 2)



def apply_compliment_effect(target: User, weight: int = 1):
    """
    Compliment can cancel upheld complaints.

    - For ordinary customers: cancels 1 most recent 'upheld' complaint.
    - For VIP customers: we call this with weight=2, so it can cancel
      up to 2 upheld complaints (twice as important).
    - After cancelling, re-evaluate chef HR rules if target is a chef.
    """

    # Cancel up to `weight` upheld complaints (if they exist)
    for _ in range(max(weight, 1)):
        recent_complaint = (
            Feedback.query.filter(
                Feedback.target_user_id == target.id,
                Feedback.type == "complaint",
                Feedback.status == "upheld",
            )
            .order_by(Feedback.created_at.desc())
            .first()
        )

        if not recent_complaint:
            break

        recent_complaint.status = "cancelled_by_compliment"

    if target.role in ["chef", "junior_chef"]:
        recalculate_chef_hr_actions(target)


# ---------- Endpoints ----------


@reputation_bp.route("/file", methods=["POST"])
def file_feedback():
    """
    File a complaint or compliment.

    Body:
    {
      "accuser_id": 1,
      "target_user_id": 5,
      "type": "complaint" | "compliment",
      "rating": 5,           # optional (1-5)
      "reason": "text",      # optional
      "order_id": 10         # optional, REQUIRED for courier→customer feedback
    }
    """

    data = request.get_json() or {}

    accuser_id = data.get("accuser_id")
    target_user_id = data.get("target_user_id")
    ftype = (data.get("type") or "").lower()
    rating = data.get("rating")
    reason = (data.get("reason") or "").strip()
    order_id = data.get("order_id")

    if not accuser_id or not target_user_id or not ftype:
        return jsonify({"error": "accuser_id, target_user_id and type are required"}), 400

    if ftype not in ["complaint", "compliment"]:
        return jsonify({"error": "type must be 'complaint' or 'compliment'"}), 400

    if accuser_id == target_user_id:
        return jsonify({"error": "You cannot file feedback about yourself"}), 400

    accuser = User.query.get(accuser_id)
    target = User.query.get(target_user_id)

    if not accuser or not target:
        return jsonify({"error": "Accuser or target user not found"}), 404

    # --- ORDER-BASED RULES (customers & delivery) ---
    # If order_id is provided, enforce:
    # - Customers/VIPs can only file feedback for orders they placed.
    # - Delivery/courier users can only file feedback for orders they delivered,
    #   and only about the customer on that order, AFTER the job is delivered.
    order = None
    job = None
    if order_id is not None:
        order = Order.query.get(order_id)
        if not order:
            return jsonify({"error": "Order not found for given order_id"}), 404

        # Customers/VIPs: must own the order
        if accuser.role in ["customer", "vip"]:
            if order.customer_id != accuser.id:
                return jsonify(
                    {
                        "error": (
                            "Customers can only file order-based feedback "
                            "for orders they placed."
                        )
                    }
                ), 403

        # Delivery/courier: must be the assigned courier,
        # job must be delivered, and target must be the customer.
        if accuser.role in ["delivery", "courier"]:
            job = DeliveryJob.query.filter_by(
                order_id=order.id,
                courier_id=accuser.id,
            ).first()

            if not job:
                return jsonify(
                    {
                        "error": (
                            "Delivery people can only file feedback for "
                            "orders they actually delivered."
                        )
                    }
                ), 403

            # ✅ Must be delivered
            if job.status != "delivered":
                return jsonify(
                    {
                        "error": (
                            "Delivery people can only complain/compliment customers "
                            "after marking the delivery as 'delivered'."
                        )
                    }
                ), 403

            # ✅ Must be about the customer of that job
            if job.customer_id != target.id:
                return jsonify(
                    {
                        "error": (
                            "Delivery people can only complain/compliment the "
                            "customer they delivered to for this order."
                        )
                    }
                ), 403

    # Normalize rating
    rating_value = None
    if rating is not None:
        try:
            rating_value = int(rating)
        except ValueError:
            return jsonify({"error": "rating must be an integer"}), 400

    # ----- COMPLIMENT PATH -----
    if ftype == "compliment":
        feedback = Feedback(
            type="compliment",
            accuser_id=accuser.id,
            target_user_id=target.id,
            order_id=order_id,
            rating=rating_value if rating_value is not None else 5,  # default 5
            reason=reason or None,
            status="applied",
            created_at=datetime.utcnow(),
            resolved_at=datetime.utcnow(),
        )
        db.session.add(feedback)

        # Apply compliment effects (cancel exactly ONE upheld complaint, if any)
        apply_compliment_effect(target, weight=1)

        db.session.commit()
        
        return jsonify(
            {
                "id": feedback.id,
                "type": feedback.type,
                "status": feedback.status,
                "message": "Compliment recorded and applied.",
            }
        ), 201

    # ----- COMPLAINT PATH -----
    feedback = Feedback(
        type="complaint",
        accuser_id=accuser.id,
        target_user_id=target.id,
        order_id=order_id,
        rating=rating_value,
        reason=reason or None,
        status="pending",
        created_at=datetime.utcnow(),
    )
    db.session.add(feedback)
    db.session.commit()

    return jsonify(
        {
            "id": feedback.id,
            "type": feedback.type,
            "status": feedback.status,
            "message": "Complaint recorded and pending manager review.",
        }
    ), 201



@reputation_bp.route("/rate-dish", methods=["POST"])
def rate_dish():
    """
    Customer rates the FOOD quality for a specific dish in an order.

    Body:
    {
      "customer_id": 1,
      "order_id": 10,
      "dish_id": 3,
      "rating": 4,          # 1–5
      "comment": "Tasty but a bit salty"   # optional
    }
    """
    data = request.get_json() or {}

    customer_id = data.get("customer_id")
    order_id = data.get("order_id")
    dish_id = data.get("dish_id")
    rating = data.get("rating")
    comment = (data.get("comment") or "").strip()

    if not customer_id or not order_id or not dish_id or rating is None:
        return jsonify({"error": "customer_id, order_id, dish_id, rating are required"}), 400

    customer = User.query.get(customer_id)
    if not customer:
        return jsonify({"error": "Customer not found"}), 404

    if customer.role not in ["customer", "vip"]:
        return jsonify({"error": "Only customers/VIPs can rate dishes"}), 403

    order = Order.query.get(order_id)
    if not order or order.customer_id != customer.id:
        return jsonify({"error": "Order not found or does not belong to this customer"}), 404

    if order.status != "delivered":
        return jsonify({"error": "You can only rate dishes from delivered orders"}), 400

    # Ensure dish is actually part of this order
    item = next((i for i in order.items if i.dish_id == dish_id), None)
    if not item:
        return jsonify({"error": "This dish is not part of the given order"}), 400

    dish = Dish.query.get(dish_id)
    if not dish:
        return jsonify({"error": "Dish not found"}), 404

    chef = dish.chef
    if not chef:
        return jsonify({"error": "Dish has no assigned chef and cannot be rated"}, 400)

    try:
        rating_value = normalize_star_rating(rating)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    # Store as a Feedback row with a rating (positive or negative).
    feedback = Feedback(
    type="compliment",
    accuser_id=customer.id,
    target_user_id=chef.id,
    order_id=order.id,
    dish_id=dish.id,   # 👈 tie rating to this dish
    rating=rating_value,
    reason=(
        f"Food rating for order #{order.id}, dish '{dish.name}': {rating_value} stars."
        + (f" Comment: {comment}" if comment else "")
    ),
    status="applied",
    created_at=datetime.utcnow(),
    resolved_at=datetime.utcnow(),
)

    db.session.add(feedback)

    # Recalculate chef HR-based rating rules (average rating, etc.)
    # (VIP ratings will be weighted double inside recalculate_chef_hr_actions)
    recalculate_chef_hr_actions(chef)

    db.session.commit()

    return jsonify(
        {
            "message": "Dish rating recorded.",
            "chef_id": chef.id,
            "chef_name": chef.name,
            "rating": rating_value,
        }
    ), 201

@reputation_bp.route("/my-customer-feedback/<int:accuser_id>", methods=["GET"])
def my_customer_feedback(accuser_id):
    """
    All complaints/compliments that THIS user (courier/delivery) filed
    about customers.
    Used in DeliveryJobsPage -> "My feedback about customers" tab.
    """

    accuser = User.query.get(accuser_id)
    if not accuser:
        return jsonify({"error": "User not found"}), 404

    # all feedback rows where this user is the accuser
    # and the target is a customer (role='customer' or 'vip' if you want)
    feedback_rows = (
        Feedback.query
        .join(User, Feedback.target_user_id == User.id)
        .filter(
            Feedback.accuser_id == accuser_id,
            Feedback.type.in_(["complaint", "compliment"]),
            # target is a customer-like role; tweak if you want VIP included
            User.role.in_(["customer", "vip"])
        )
        .order_by(Feedback.created_at.desc())
        .all()
    )

    result = []
    for f in feedback_rows:
        result.append(
            {
                "id": f.id,
                "type": f.type,  # "complaint" or "compliment"
                "status": f.status,  # "pending", "upheld", "dismissed", "applied", etc.
                "rating": f.rating,
                "reason": f.reason,
                "order_id": f.order_id,
                "target_user_id": f.target_user_id,
                "target_user_name": f.target_user.name if f.target_user else None,
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
        )

    return jsonify(result), 200


@reputation_bp.route("/performance-summary", methods=["GET"])
def performance_summary():
    """
    Aggregate performance metrics for chefs and couriers so the Manager
    can see them in a dashboard (charts).

    Returns JSON like:
    {
      "chefs": [
        {
          "id": 5,
          "name": "Chef Marco",
          "role": "chef",
          "average_rating": 4.3,
          "total_compliments": 10,
          "upheld_complaints": 1,
          "warnings": 0
        },
        ...
      ],
      "couriers": [
        {
          "id": 8,
          "name": "Courier Sam",
          "role": "courier",
          "deliveries_completed": 14,
          "average_delivery_rating": 4.8,
          "total_compliments": 7,
          "upheld_complaints": 0,
          "warnings": 1
        },
        ...
      ]
    }
    """

    # ---- CHEFS ----
    chefs = User.query.filter(User.role.in_(["chef", "junior_chef"])).all()
    chef_ids = [c.id for c in chefs]

    chef_avg_rating = {}
    chef_total_compliments = {}
    chef_upheld_complaints = {}

    if chef_ids:
        #
        # Average rating for each chef (uses Feedback.rating)
        #
        rows = (
            db.session.query(
                Feedback.target_user_id,
                func.avg(Feedback.rating)
            )
            .filter(
                Feedback.target_user_id.in_(chef_ids),
                Feedback.rating.isnot(None),
            )
            .group_by(Feedback.target_user_id)
            .all()
        )
        for uid, avg in rows:
            chef_avg_rating[uid] = float(avg or 0)

        #
        # Total compliments per chef
        #
        rows = (
            db.session.query(
                Feedback.target_user_id,
                func.count(Feedback.id),
            )
            .filter(
                Feedback.target_user_id.in_(chef_ids),
                Feedback.type == "compliment",
            )
            .group_by(Feedback.target_user_id)
            .all()
        )
        for uid, count in rows:
            chef_total_compliments[uid] = int(count or 0)

        #
        # Upheld complaints per chef
        #
        rows = (
            db.session.query(
                Feedback.target_user_id,
                func.count(Feedback.id),
            )
            .filter(
                Feedback.target_user_id.in_(chef_ids),
                Feedback.type == "complaint",
                Feedback.status == "upheld",
            )
            .group_by(Feedback.target_user_id)
            .all()
        )
        for uid, count in rows:
            chef_upheld_complaints[uid] = int(count or 0)

    chef_result = []
    for c in chefs:
        chef_result.append(
            {
                "id": c.id,
                "name": c.name,
                "role": c.role,
                "average_rating": chef_avg_rating.get(c.id, 0.0),
                "total_compliments": chef_total_compliments.get(c.id, 0),
                "upheld_complaints": chef_upheld_complaints.get(c.id, 0),
                "warnings": c.warnings or 0,
            }
        )

    # ---- COURIERS ----
    couriers = User.query.filter(User.role.in_(["courier", "delivery"])).all()
    courier_ids = [u.id for u in couriers]

    courier_deliveries_completed = {}
    courier_avg_delivery_rating = {}
    courier_total_compliments = {}
    courier_upheld_complaints = {}

    if courier_ids:
        #
        # Total completed deliveries per courier
        #
        rows = (
            db.session.query(
                DeliveryJob.courier_id,
                func.count(DeliveryJob.id),
            )
            .filter(
                DeliveryJob.courier_id.in_(courier_ids),
                DeliveryJob.status == "delivered",
            )
            .group_by(DeliveryJob.courier_id)
            .all()
        )
        for courier_id, count in rows:
            courier_deliveries_completed[courier_id] = int(count or 0)

        #
        # Average *delivery* rating per courier
        # (Feedback rows with rating where target_user is courier)
        #
        rows = (
            db.session.query(
                Feedback.target_user_id,
                func.avg(Feedback.rating),
            )
            .filter(
                Feedback.target_user_id.in_(courier_ids),
                Feedback.rating.isnot(None),
            )
            .group_by(Feedback.target_user_id)
            .all()
        )
        for uid, avg in rows:
            courier_avg_delivery_rating[uid] = float(avg or 0)

        #
        # Compliments per courier
        #
        rows = (
            db.session.query(
                Feedback.target_user_id,
                func.count(Feedback.id),
            )
            .filter(
                Feedback.target_user_id.in_(courier_ids),
                Feedback.type == "compliment",
            )
            .group_by(Feedback.target_user_id)
            .all()
        )
        for uid, count in rows:
            courier_total_compliments[uid] = int(count or 0)

        #
        # Upheld complaints per courier
        #
        rows = (
            db.session.query(
                Feedback.target_user_id,
                func.count(Feedback.id),
            )
            .filter(
                Feedback.target_user_id.in_(courier_ids),
                Feedback.type == "complaint",
                Feedback.status == "upheld",
            )
            .group_by(Feedback.target_user_id)
            .all()
        )
        for uid, count in rows:
            courier_upheld_complaints[uid] = int(count or 0)

    courier_result = []
    for u in couriers:
        courier_result.append(
            {
                "id": u.id,
                "name": u.name,
                "role": u.role,
                "deliveries_completed": courier_deliveries_completed.get(u.id, 0),
                "average_delivery_rating": courier_avg_delivery_rating.get(u.id, 0.0),
                "total_compliments": courier_total_compliments.get(u.id, 0),
                "upheld_complaints": courier_upheld_complaints.get(u.id, 0),
                "warnings": u.warnings or 0,
            }
        )

    return jsonify(
        {
            "chefs": chef_result,
            "couriers": courier_result,
        }
    ), 200


@reputation_bp.route("/rate-delivery", methods=["POST"])
def rate_delivery():
    """
    Customer rates the DELIVERY quality/manners for a delivered order.

    Body:
    {
      "customer_id": 1,
      "order_id": 10,
      "rating": 5,          # 1–5
      "comment": "Very polite and on time"
    }
    """
    data = request.get_json() or {}

    customer_id = data.get("customer_id")
    order_id = data.get("order_id")
    rating = data.get("rating")
    comment = (data.get("comment") or "").strip()

    if not customer_id or not order_id or rating is None:
        return jsonify({"error": "customer_id, order_id, rating are required"}), 400

    customer = User.query.get(customer_id)
    if not customer:
        return jsonify({"error": "Customer not found"}), 404

    if customer.role not in ["customer", "vip"]:
        return jsonify({"error": "Only customers/VIPs can rate deliveries"}), 403

    order = Order.query.get(order_id)
    if not order or order.customer_id != customer.id:
        return jsonify({"error": "Order not found or does not belong to this customer"}), 404

    if order.status != "delivered":
        return jsonify({"error": "You can only rate delivery for delivered orders"}), 400

    # Find the delivery job & courier
    job = DeliveryJob.query.filter_by(order_id=order.id).first()
    if not job or not job.courier_id:
        return jsonify({"error": "No courier is recorded for this order"}), 400

    courier = job.courier
    if not courier:
        return jsonify({"error": "Courier user not found"}), 404

    try:
        rating_value = normalize_star_rating(rating)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    feedback = Feedback(
        type="compliment",
        accuser_id=customer.id,
        target_user_id=courier.id,
        order_id=order.id,
        rating=rating_value,
        reason=(
            f"Delivery rating for order #{order.id}: {rating_value} stars."
            + (f" Comment: {comment}" if comment else "")
        ),
        status="applied",
        created_at=datetime.utcnow(),
        resolved_at=datetime.utcnow(),
    )
    db.session.add(feedback)
    db.session.commit()

    return jsonify(
        {
            "message": "Delivery rating recorded.",
            "courier_id": courier.id,
            "courier_name": courier.name,
            "rating": rating_value,
        }
    ), 201



@reputation_bp.route("/pending-complaints", methods=["GET"])
def list_pending_complaints():
    """
    Manager/staff/admin view of ALL pending complaints in the system.
    Each item includes accuser & target info so manager can decide to
    uphold or dismiss.
    """

    # Optional: restrict to manager-like roles if you have auth helpers
    # current_user = get_current_user()
    # if current_user.role not in ["manager", "admin", "staff"]:
    #     return jsonify({"error": "Forbidden"}), 403

    pending = (
        Feedback.query
        .filter(
            Feedback.type == "complaint",
            Feedback.status == "pending",
        )
        .order_by(Feedback.created_at.desc())
        .all()
    )

    results = []
    for f in pending:
        results.append(
            {
                "id": f.id,
                "type": f.type,
                "status": f.status,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "reason": f.reason,
                "rating": f.rating,
                "order_id": f.order_id,
                "accuser_id": f.accuser_id,
                "accuser_name": f.accuser.name if f.accuser else None,
                "target_user_id": f.target_user_id,
                "target_user_name": f.target_user.name if f.target_user else None,
            }
        )

    return jsonify(results), 200


@reputation_bp.route("/review-complaint", methods=["POST"])
def review_complaint():
    """
    Manager reviews a complaint and either upholds or dismisses it.

    Body:
    {
      "manager_user_id": 2,
      "feedback_id": 10,
      "decision": "upheld" | "dismissed"
    }

    Rules:
    - 'dismissed' complaint -> warning for accuser.
    - 3 warnings and role=customer -> deactivate + blacklist.
    - 'upheld' complaint vs chef -> apply chef HR rules
      (average < 2 or >= 3 upheld complaints -> demote, then fire)
    """

    data = request.get_json() or {}

    manager_user_id = data.get("manager_user_id")
    feedback_id = data.get("feedback_id")
    decision = (data.get("decision") or "").lower()

    if not manager_user_id or not feedback_id or not decision:
        return jsonify({"error": "manager_user_id, feedback_id, decision are required"}), 400

    if decision not in ["upheld", "dismissed"]:
        return jsonify({"error": "decision must be 'upheld' or 'dismissed'"}), 400

    manager = User.query.get(manager_user_id)
    if not manager:
        return jsonify({"error": "Manager user not found"}), 404

    if manager.role not in ["manager", "admin", "staff"]:
        return jsonify({"error": "Only staff/manager/admin can review complaints"}), 403

    feedback = Feedback.query.get(feedback_id)
    if not feedback:
        return jsonify({"error": "Feedback not found"}), 404

    if feedback.type != "complaint":
        return jsonify({"error": "Only complaints can be reviewed"}), 400

    if feedback.status != "pending":
        return jsonify({"error": f"Complaint is already {feedback.status}"}), 400

    accuser = feedback.accuser
    target = feedback.target_user

    # Apply decision
    feedback.manager_id = manager.id
    feedback.resolved_at = datetime.utcnow()

    # --- NEW: add a system note visible to both parties ---
    decision_note = (
        f"[System note {feedback.resolved_at.isoformat()}] "
        f"Complaint {decision} by manager {manager.name} (id={manager.id})."
    )

    if feedback.reason:
        feedback.reason = feedback.reason + "\n" + decision_note
    else:
        feedback.reason = decision_note

    if decision == "dismissed":
        feedback.status = "dismissed"

        # Warning to accuser (false / rejected complaint)
        accuser.warnings = (accuser.warnings or 0) + 1
        apply_customer_warning_rules(accuser)

        db.session.commit()

        return jsonify(
            {
                "id": feedback.id,
                "status": feedback.status,
                "accuser_warnings": accuser.warnings,
                "message": "Complaint dismissed. Accuser received a warning.",
            }
        ), 200

    # decision == 'upheld'
    feedback.status = "upheld"

    # 🔹 Warning goes to the TARGET of the complaint (chef, courier, or customer)
    target.warnings = (target.warnings or 0) + 1
    apply_customer_warning_rules(target)

    # 🔹 Chef-specific HR rules (demote/fire based on ratings + upheld complaints)
    if target.role in ["chef", "junior_chef"]:
        recalculate_chef_hr_actions(target)

    db.session.commit()

    return jsonify(
        {
            "id": feedback.id,
            "status": feedback.status,
            "target_warnings": target.warnings,
            "message": "Complaint upheld. Target received a warning and HR rules applied if needed.",
        }
    ), 200


@reputation_bp.route("/dispute", methods=["POST"])
def dispute_complaint():
    """
    The person targeted by a complaint can dispute it.

    Body:
    {
      "user_id": 5,          # the person being complained about
      "feedback_id": 10,
      "reason": "My side of the story"
    }

    Rules:
    - Only the target_user of a complaint can dispute it.
    - Only for 'pending' complaints (manager has not made a final decision yet).
    - We append the dispute text into the feedback.reason so the manager sees it.
    """

    data = request.get_json() or {}

    user_id = data.get("user_id")
    feedback_id = data.get("feedback_id")
    dispute_text = (data.get("reason") or "").strip()

    if not user_id or not feedback_id:
        return jsonify({"error": "user_id and feedback_id are required"}), 400

    feedback = Feedback.query.get(feedback_id)
    if not feedback:
        return jsonify({"error": "Feedback not found"}), 404

    if feedback.type != "complaint":
        return jsonify({"error": "Only complaints can be disputed"}), 400

    if feedback.target_user_id != user_id:
        return jsonify({"error": "You can only dispute complaints about yourself"}), 403

    if feedback.status != "pending":
        return jsonify({"error": f"Complaint is already {feedback.status} and cannot be disputed"}), 400

    # Append dispute text into reason so the manager can see it.
    if dispute_text:
        base_reason = feedback.reason or ""
        if base_reason:
            feedback.reason = base_reason + "\n[Dispute from target]: " + dispute_text
        else:
            feedback.reason = "[Dispute from target]: " + dispute_text

    db.session.commit()

    return jsonify(
        {
            "id": feedback.id,
            "status": feedback.status,
            "message": "Dispute submitted. Manager will review this complaint.",
            "reason": feedback.reason,
        }
    ), 200


@reputation_bp.route("/about-me/<int:user_id>", methods=["GET"])
def list_complaints_about_me(user_id):
    """
    Shows all complaints where this user is the target.
    Used so the user can dispute complaints about themselves.
    """

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    complaints = (
        Feedback.query.filter(
            Feedback.target_user_id == user_id,
            Feedback.type == "complaint"
        )
        .order_by(Feedback.created_at.asc())
        .all()
    )

    data = []
    for f in complaints:
        data.append({
            "id": f.id,
            "accuser_id": f.accuser_id,
            "accuser_name": f.accuser.name,
            "reason": f.reason,
            "status": f.status,
            "created_at": f.created_at.isoformat(),
            "order_id": f.order_id,
        })

    return jsonify(data), 200

@reputation_bp.route("/by-me/<int:user_id>", methods=["GET"])
def list_feedback_by_me(user_id):
    """
    Shows all complaints AND compliments that this user filed about others.
    Used so the user can see their own feedback history.
    """

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    feedback_rows = (
        Feedback.query
        .filter(
            Feedback.accuser_id == user_id,
            Feedback.type.in_(["complaint", "compliment"]),
        )
        .order_by(Feedback.created_at.desc())
        .all()
    )

    result = []
    for f in feedback_rows:
        result.append(
            {
                "id": f.id,
                "type": f.type,  # "complaint" or "compliment"
                "status": f.status,  # pending / upheld / dismissed / applied / cancelled_by_compliment / …
                "rating": f.rating,
                "reason": f.reason,
                "order_id": f.order_id,
                "target_user_id": f.target_user_id,
                "target_user_name": f.target_user.name if f.target_user else None,
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
        )

    return jsonify(result), 200

