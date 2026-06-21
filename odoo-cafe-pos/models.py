"""
Odoo Café POS - Database Models
SQLAlchemy models for the Smart Restaurant Management System
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

# ---------------------------------------------------------------------------
# Loyalty / Points Program
# ---------------------------------------------------------------------------
POINTS_EARN_RATE = 50.0     # customer earns 1 point for every ₹50 spent (paid orders)
POINTS_REDEEM_VALUE = 1.0   # each point is worth ₹1 discount when redeemed


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='employee')  # admin, employee, customer
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'email': self.email,
            'role': self.role, 'created_at': self.created_at.isoformat()
        }


class Customer(db.Model):
    __tablename__ = 'customers'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120))
    phone = db.Column(db.String(20))
    address = db.Column(db.String(255))
    loyalty_points = db.Column(db.Integer, default=0, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    points_ledger = db.relationship('PointsLedger', backref='customer', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'email': self.email,
            'phone': self.phone, 'address': self.address,
            'loyalty_points': self.loyalty_points,
            'points_value': round(self.loyalty_points * POINTS_REDEEM_VALUE, 2)
        }


class Category(db.Model):
    __tablename__ = 'categories'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    color = db.Column(db.String(20), default='#FF7A00')
    products = db.relationship('Product', backref='category', lazy=True)

    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'color': self.color}


class Product(db.Model):
    __tablename__ = 'products'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'))
    price = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20), default='pcs')
    tax = db.Column(db.Float, default=5.0)  # percentage
    description = db.Column(db.String(255))
    image = db.Column(db.String(255), default='/static/images/placeholder.svg')
    status = db.Column(db.String(20), default='active')  # active, inactive

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name,
            'category_id': self.category_id,
            'category_name': self.category.name if self.category else None,
            'category_color': self.category.color if self.category else '#FF7A00',
            'price': self.price, 'unit': self.unit, 'tax': self.tax,
            'description': self.description, 'image': self.image,
            'status': self.status
        }


class Floor(db.Model):
    __tablename__ = 'floors'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    tables = db.relationship('Table', backref='floor', lazy=True)

    def to_dict(self):
        return {'id': self.id, 'name': self.name}


class Table(db.Model):
    __tablename__ = 'tables'
    id = db.Column(db.Integer, primary_key=True)
    number = db.Column(db.Integer, nullable=False)
    floor_id = db.Column(db.Integer, db.ForeignKey('floors.id'))
    seats = db.Column(db.Integer, default=4)
    status = db.Column(db.String(20), default='available')  # available, occupied
    qr_code = db.Column(db.String(255))

    def to_dict(self):
        return {
            'id': self.id, 'number': self.number,
            'floor_id': self.floor_id,
            'floor_name': self.floor.name if self.floor else None,
            'seats': self.seats, 'status': self.status,
            'qr_code': self.qr_code
        }


class Coupon(db.Model):
    __tablename__ = 'coupons'
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(30), unique=True, nullable=False)
    discount_type = db.Column(db.String(20), default='percentage')  # percentage, fixed
    discount_value = db.Column(db.Float, nullable=False)
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # Every coupon automatically expires 5 days after it is created.
    expiry_date = db.Column(db.DateTime, nullable=True)

    def is_expired(self):
        return bool(self.expiry_date) and datetime.utcnow() > self.expiry_date

    def to_dict(self):
        return {
            'id': self.id, 'code': self.code,
            'discount_type': self.discount_type,
            'discount_value': self.discount_value,
            'active': self.active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'expiry_date': self.expiry_date.isoformat() if self.expiry_date else None,
            'is_expired': self.is_expired()
        }


class Promotion(db.Model):
    __tablename__ = 'promotions'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255))
    active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id, 'title': self.title,
            'description': self.description, 'active': self.active
        }


class Order(db.Model):
    __tablename__ = 'orders'
    id = db.Column(db.Integer, primary_key=True)
    order_number = db.Column(db.String(30), unique=True, nullable=False)
    table_id = db.Column(db.Integer, db.ForeignKey('tables.id'), nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    order_type = db.Column(db.String(20), default='pos')  # pos, self_order
    status = db.Column(db.String(20), default='to_cook')  # to_cook, preparing, completed
    subtotal = db.Column(db.Float, default=0.0)
    discount = db.Column(db.Float, default=0.0)
    tax_amount = db.Column(db.Float, default=0.0)
    grand_total = db.Column(db.Float, default=0.0)
    coupon_code = db.Column(db.String(30), nullable=True)
    points_redeemed = db.Column(db.Integer, default=0)     # points spent on this order's discount
    points_discount = db.Column(db.Float, default=0.0)     # ₹ discount granted from those points
    points_earned = db.Column(db.Integer, default=0)        # points credited once order is paid
    payment_status = db.Column(db.String(20), default='unpaid')  # unpaid, paid
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    items = db.relationship('OrderItem', backref='order', lazy=True, cascade='all, delete-orphan')
    payments = db.relationship('Payment', backref='order', lazy=True)

    def to_dict(self):
        table = Table.query.get(self.table_id) if self.table_id else None
        return {
            'id': self.id, 'order_number': self.order_number,
            'table_id': self.table_id,
            'table_number': table.number if table else None,
            'customer_id': self.customer_id,
            'order_type': self.order_type, 'status': self.status,
            'subtotal': self.subtotal, 'discount': self.discount,
            'tax_amount': self.tax_amount, 'grand_total': self.grand_total,
            'coupon_code': self.coupon_code,
            'points_redeemed': self.points_redeemed,
            'points_discount': self.points_discount,
            'points_earned': self.points_earned,
            'payment_status': self.payment_status,
            'created_at': self.created_at.isoformat(),
            'items': [i.to_dict() for i in self.items]
        }


class OrderItem(db.Model):
    __tablename__ = 'order_items'
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    product_name = db.Column(db.String(100))
    quantity = db.Column(db.Integer, default=1)
    price = db.Column(db.Float, nullable=False)
    tax = db.Column(db.Float, default=0.0)
    subtotal = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            'id': self.id, 'order_id': self.order_id,
            'product_id': self.product_id,
            'product_name': self.product_name,
            'quantity': self.quantity, 'price': self.price,
            'tax': self.tax, 'subtotal': self.subtotal
        }


class Payment(db.Model):
    __tablename__ = 'payments'
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    method = db.Column(db.String(20), nullable=False)  # cash, card, upi
    amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, success
    transaction_ref = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id, 'order_id': self.order_id,
            'method': self.method, 'amount': self.amount,
            'status': self.status, 'transaction_ref': self.transaction_ref,
            'created_at': self.created_at.isoformat()
        }


class PointsLedger(db.Model):
    """History of loyalty points earned and redeemed by a customer, one row per event."""
    __tablename__ = 'points_ledger'
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=True)
    change = db.Column(db.Integer, nullable=False)        # positive = earned, negative = redeemed
    reason = db.Column(db.String(20), nullable=False)      # earned, redeemed
    balance_after = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id, 'customer_id': self.customer_id,
            'order_id': self.order_id, 'change': self.change,
            'reason': self.reason, 'balance_after': self.balance_after,
            'created_at': self.created_at.isoformat()
        }
