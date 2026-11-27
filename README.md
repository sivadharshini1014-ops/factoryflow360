# FACTORYFLOW 360 — From Every Order to Every Audit

## Run (2 terminals)
**Backend** (Flask + SQLite, auto-creates DB + demo data on first run)
```
cd backend && pip install -r requirements.txt && python app.py      # http://localhost:5000
```
**Frontend** (React + Vite + Tailwind)
```
cd frontend && npm install && npm run dev                           # http://localhost:5173
```
Dataset: ~80 days of demo orders, invoices, payments, production runs and purchases are seeded automatically (old DB is rebuilt on first start).
Logins: admin/admin123 · sales/sales123 (orders only) · auditor/audit123 (read-only)

## Database
SQLite file `backend/factoryflow.db` (schema in `backend/schema.sql`). Stock is never overwritten: every balance = SUM of `stock_ledger`
(purchase → raw stock → production issue → finished goods → dispatch). Weighted-average cost is updated on purchases and production receipts.
To use MySQL/PostgreSQL later, replace the `db()/q()/run()` helpers in `app.py`.
