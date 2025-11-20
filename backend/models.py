from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

from extensions import db   # <-- use shared db instance


class User(db.Model):
    __tablename__ = "user"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), default="customer")

    deposit_balance = db.Column(db.Float, default=0.0)
    total_spent = db.Column(db.Float, default=0.0)
    order_count = db.Column(db.Integer, default=0)
    warnings = db.Column(db.Integer, default=0)
    is_blacklisted = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Dish(db.Model):
    __tablename__ = "dish"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    price = db.Column(db.Float, nullable=False)

    image_url = db.Column(db.String(500))
    is_vip_only = db.Column(db.Boolean, default=False)

    chef_id = db.Column(db.Integer, db.ForeignKey("user.id"))
    chef = db.relationship("User", backref="dishes")


class Order(db.Model):
    __tablename__ = "order"

    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

    status = db.Column(db.String(20), default="pending")
    total_price = db.Column(db.Float, default=0.0)
    discount_applied = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    customer = db.relationship("User", backref="orders")


class OrderItem(db.Model):
    __tablename__ = "order_item"

    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("order.id"), nullable=False)
    dish_id = db.Column(db.Integer, db.ForeignKey("dish.id"), nullable=False)

    quantity = db.Column(db.Integer, default=1)
    unit_price = db.Column(db.Float, nullable=False)

    order = db.relationship("Order", backref="items")
    dish = db.relationship("Dish")
