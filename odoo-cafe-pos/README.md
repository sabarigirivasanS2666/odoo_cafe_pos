# ☕ Odoo Café POS — Smart Restaurant Management System

A complete digital solution for restaurant order management, kitchen operations, customer self-ordering, and analytics. Built for the **Odoo Café POS** hackathon problem statement.

## 🧱 Tech Stack

- **Frontend:** HTML5, CSS3 (vanilla, light theme + glassmorphism), JavaScript (vanilla, Fetch API)
- **Backend:** Python Flask
- **Database:** SQLite (via SQLAlchemy)
- **Charts:** Chart.js (CDN)
- No React/Vue/Bootstrap — pure HTML/CSS/JS as requested.

## 🚀 Quick Start

```bash
# 1. Create a virtual environment (recommended)
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the app
python app.py
```

The app will be available at **http://localhost:5000**

The SQLite database (`database.db`) is created automatically on first run and seeded with sample products, categories, tables, customers, coupons, and 25 historical orders so the Reports dashboard has data to show immediately.

## 🔑 Demo Credentials

| Role     | Email                     | Password      |
|----------|---------------------------|---------------|
| Admin    | admin@odoocafe.com        | admin123      |
| Employee | employee@odoocafe.com     | employee123   |
| Customer | customer@odoocafe.com     | customer123   |

## 📄 Pages

| Route          | Description                                         | Access          |
|-----------------|------------------------------------------------------|-----------------|
| `/`             | Landing page with hero, features, workflow           | Public          |
| `/login`        | Login & registration (role selectable)               | Public          |
| `/dashboard`    | Admin panel: products, categories, floors/tables, customers, coupons | Admin / Employee |
| `/pos`          | POS terminal: product grid, cart, checkout, payment   | Admin / Employee |
| `/kitchen`      | Kitchen Display System (KDS) with live order columns  | Admin / Employee |
| `/self-order`   | Customer-facing digital menu (QR code destination)    | Public          |
| `/self-order/<table_id>` | Same menu, pre-bound to a specific table     | Public          |
| `/reports`      | Analytics dashboard with Chart.js visualizations       | Admin           |

## 🗂️ Project Structure

```
project/
├── app.py                 # Flask app, all routes & API endpoints, DB seeding
├── models.py              # SQLAlchemy models (Users, Products, Orders, etc.)
├── requirements.txt
├── database.db            # Auto-generated SQLite DB (created on first run)
├── templates/
│   ├── index.html         # Landing page
│   ├── login.html         # Login / Register
│   ├── dashboard.html     # Admin dashboard (products, categories, floors, customers, coupons)
│   ├── pos.html           # POS terminal
│   ├── kitchen.html       # Kitchen Display System
│   ├── self_order.html    # Customer self-ordering menu
│   └── reports.html       # Analytics & reports
└── static/
    ├── css/style.css       # Global dark theme + glassmorphism styles
    ├── js/
    │   ├── utils.js        # Shared helpers (toast, api wrapper, auth check)
    │   ├── dashboard.js     # Admin CRUD logic
    │   ├── pos.js           # POS cart/checkout/payment logic
    │   ├── kitchen.js       # KDS polling & status updates
    │   ├── self_order.js    # Customer menu & ordering logic
    │   └── reports.js       # Chart.js rendering
    └── images/
        └── placeholder.svg
```

## 🔌 Key API Endpoints

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET/POST/PUT/DELETE   /api/categories[/<id>]
GET/POST/PUT/DELETE   /api/products[/<id>]
GET/POST/PUT/DELETE   /api/floors[/<id>]
POST                   /api/floors/<id>/duplicate
GET/POST/PUT/DELETE   /api/tables[/<id>]
POST                   /api/tables/<id>/duplicate
GET/POST/PUT/DELETE   /api/customers[/<id>]
GET                    /api/customer/me
GET                    /api/customer/orders
GET                    /api/customer/points
GET/POST              /api/coupons          # new coupons auto-expire 5 days after creation
GET                   /api/coupons/validate/<code>   # rejects inactive AND expired coupons

GET/POST               /api/orders            # table_id is required when order_type is 'pos'
GET                     /api/orders/<id>
PUT                     /api/orders/<id>/status   { status: to_cook|preparing|completed }
POST                    /api/orders/<id>/pay       { method: cash|card|upi }

GET                     /api/reports/summary
```

## 🛎️ Core Workflow

```
Select Table (required) → Choose Products → Add to Cart → Apply Coupon
   → Send to Kitchen → Payment → Generate Receipt
```

A table must be selected before an order can be sent to the kitchen or checked out from the POS cart.

Kitchen orders move through: **To Cook → Preparing → Completed** (visible live on `/kitchen`, polling every 5 seconds).

## 📱 Self-Ordering via QR

Each table generated in the admin dashboard gets a QR code (via the free `api.qrserver.com` QR image API) pointing to `/self-order/<table_id>`. Customers scan it, browse the digital menu, add items, and place the order — it appears instantly in the Kitchen Display System.

## 🪑 Floors & Tables

From **Dashboard → Floors & Tables** you can add, edit, and delete floors and tables. Each floor and each table also has a **Duplicate** action (📋):
- **Duplicate Table** clones the table's floor and seat count onto a brand-new table (with its own QR code) using the next available table number.
- **Duplicate Floor** clones the whole floor — including every table on it — onto a brand-new floor named "`<Floor Name>` (Copy)", so a full seating layout can be replicated in one click.

A floor with tables still on it can't be deleted; remove or move its tables first.

## 🎟️ Coupons

Every coupon created from **Dashboard → Coupons** automatically expires **5 days** after it's created — there's no manual expiry field to set. Expired coupons are rejected at validation/checkout time and are shown as "Expired" in the dashboard's coupon table alongside their expiry date.

## 💳 Payments

Supports **Cash**, **Card**, and **UPI** (UPI generates a scannable QR code for payment confirmation). On successful payment, a printable receipt is shown with a **Print Receipt** button (browser print dialog → can be saved as PDF).

## ⭐ Loyalty Points Program

Logged-in customers automatically earn and redeem loyalty points when ordering through their **Customer Dashboard** (`/customer-dashboard`):

- **Earning:** 1 point is credited for every ₹50 spent (based on the order's final paid total), once payment succeeds.
- **Redeeming:** Available points are automatically applied as a discount at checkout (1 point = ₹1 off), stacked on top of any coupon. The discount never exceeds the order's remaining payable amount, and never overdraws the customer's balance. Customers can opt out via a checkbox in the cart if they'd rather save their points.
- **Tracking:** The dashboard's "My Dashboard" overview shows the current points balance (and its ₹ value) plus a full earn/redeem history table.
- **Receipts:** Points earned and/or redeemed on an order are itemized on the printable receipt.

Relevant endpoints:
```
GET  /api/customer/points     # balance + history for the logged-in customer
POST /api/orders              # accepts use_points (bool) and points_to_redeem (optional cap)
POST /api/orders/<id>/pay     # response includes points_earned
```

## 📊 Reports

The `/reports` page (admin-only) shows:
- Total Orders, Total Revenue, Average Order Value
- Monthly Sales Trend (line chart)
- Top 5 Products (bar chart)
- Top Categories by Revenue (doughnut chart)
- Orders Overview (bar chart)

## ⚠️ Notes

- This is a **development-ready** build using SQLite — for production, swap in PostgreSQL/MySQL and set a proper `SECRET_KEY`.
- Passwords are hashed with Werkzeug's `generate_password_hash`.
- Sessions are server-side via Flask's signed cookie session.
- Re-running `python app.py` will **not** re-seed the database if data already exists (checked via `User.query.first()`). Delete `database.db` to reseed from scratch.
