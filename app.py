import sqlite3, os, io, csv, secrets, datetime as dt
from flask import Flask, request, jsonify, g, send_file
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(HERE, 'factoryflow.db')
COMPANY = {'name': 'Sri Murugan Foods Pvt Ltd', 'gstin': '33AABCS1234F1Z5', 'state': 'Tamil Nadu'}
app = Flask(__name__); CORS(app); TOK = {}

def db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB); g.db.row_factory = sqlite3.Row
    return g.db
@app.teardown_appcontext
def _close(e):
    d = g.pop('db', None)
    if d: d.close()
def q(sql, a=()): return [dict(r) for r in db().execute(sql, a).fetchall()]
def q1(sql, a=()):
    r = q(sql, a); return r[0] if r else None
def run(sql, a=()):
    c = db().execute(sql, a); db().commit(); return c.lastrowid
CLOCK = [None]
def now(): return (CLOCK[0] + ' 10:30') if CLOCK[0] else dt.datetime.now().strftime('%Y-%m-%d %H:%M')
def today(): return CLOCK[0] or dt.date.today().isoformat()
def log(action, detail):
    run('insert into audit_log(ts,user,action,detail) values(?,?,?,?)', (now(), getattr(g, 'user', {}).get('username', 'system'), action, detail))
def bal(t, i): return db().execute('select coalesce(sum(qty),0) from stock_ledger where item_type=? and item_id=?', (t, i)).fetchone()[0]
def ledger(t, i, qty, cost, ref, rid, batch=None, expiry=None):
    run('insert into stock_ledger(ts,item_type,item_id,qty,unit_cost,ref_type,ref_id,batch,expiry) values(?,?,?,?,?,?,?,?,?)', (now(), t, i, qty, cost, ref, rid, batch, expiry))

def seed_history():
    import random
    R = random.Random(7); c = app.test_client(); t0 = dt.date.today()
    def login(u, p): return {'Authorization': 'Bearer ' + c.post('/api/login', json={'username': u, 'password': p}).json['token']}
    A, S = login('admin', 'admin123'), login('sales', 'sales123')
    P = lambda path, h, j=None: c.post(path, json=j or {}, headers=h)
    YIELD = {1: 100, 2: 100, 3: 80, 4: 100}; inv = []
    for d in range(80, -1, -1):
        CLOCK[0] = (t0 - dt.timedelta(days=d)).isoformat()
        if d % 10 == 0 and d > 0:
            for mid, qty, rate in [(1, 300, 56), (2, 120, 132), (7, 150, 72), (8, 60, 112)]:
                P('/api/purchases', A, {'supplier': R.choice(['Sri Lakshmi Traders', 'Madurai Agro Foods', 'Coimbatore Oils']), 'material_id': mid, 'qty': qty, 'rate': round(rate * R.uniform(.95, 1.08), 2), 'batch': f'PB{d:02d}-{mid}', 'expiry': (t0 + dt.timedelta(days=200)).isoformat()})
        if d % 3 == 0:
            pid = (d // 3) % 4 + 1; b = R.choice([1, 2]); act = {}; spike = R.random() < .04
            for r in c.get(f'/api/bom/{pid}', headers=A).json:
                f = 1.09 if spike else 1.05 if (r['material_id'] == 2 and R.random() < .15) else R.uniform(.985, 1.015)
                act[str(r['material_id'])] = round(r['qty'] * b * f, 2)
            P('/api/production', A, {'product_id': pid, 'batches': b, 'actual': act, 'good_packets': round(YIELD[pid] * b * R.uniform(.94, .99)), 'damaged': R.randint(0, 4), 'wastage': round(R.uniform(.5, 3), 1), 'labour': 650 * b, 'gas': 220 * b, 'power': 180 * b, 'supervisor': R.choice(['Ravi', 'Selvam', 'Lakshmi'])})
        if d % 2 == 0 or d < 3:
            items = [{'product_id': p, 'qty': R.choice([20, 30, 40, 50, 60])} for p in R.sample([1, 2, 3, 4], R.randint(1, 3))]
            oid = P('/api/orders', S, {'customer_id': R.randint(1, 8), 'items': items}).json['id']
            if d >= 2: P(f'/api/orders/{oid}/approve', A)
            if d >= 3:
                r = P(f'/api/orders/{oid}/invoice', A)
                if r.status_code == 200: P(f'/api/orders/{oid}/dispatch', A); inv.append((r.json['id'], d))
    totals = {i['id']: i['total'] for i in c.get('/api/invoices', headers=A).json}
    for iid, d in inv:
        if d >= 12 and iid % 7 != 0:
            CLOCK[0] = (t0 - dt.timedelta(days=max(0, d - R.randint(3, 10)))).isoformat()
            amt = round(totals[iid] * (.6 if iid % 5 == 0 else 1), 2)
            P('/api/payments', A, {'invoice_id': iid, 'amount': amt, 'mode': R.choice(['UPI', 'Bank transfer', 'Cash', 'Cheque'])})
    CLOCK[0] = t0.isoformat()
    g8 = next(m for m in c.get('/api/materials', headers=A).json if m['id'] == 8)
    P('/api/adjust', A, {'item_type': 'material', 'item_id': 8, 'qty': -(g8['stock'] - 40), 'reason': 'spoilage'})
    CLOCK[0] = None

def init():
    c = sqlite3.connect(DB); schema = open(os.path.join(HERE, 'schema.sql')).read()
    new = c.execute('pragma user_version').fetchone()[0] < 2
    if new:
        for (t,) in c.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%'").fetchall(): c.execute(f'drop table {t}')
        c.executescript(schema); c.execute('pragma user_version=2')
    else: c.executescript(schema)
    c.commit(); c.close()
    if not new: return
    with app.app_context():
        for u in [('admin', 'admin123', 'admin', 'Anitha (Owner)'), ('sales', 'sales123', 'salesman', 'Karthik (Sales)'), ('auditor', 'audit123', 'auditor', 'Meera (CA Auditor)')]:
            run('insert into users(username,password,role,name) values(?,?,?,?)', (u[0], generate_password_hash(u[1]), u[2], u[3]))
        for c_ in [('Annachi Stores', '33AAACA1111A1Z1', 'Tamil Nadu', '9840011111', 'Chennai'), ('Kerala Mart', '32AAACK2222B1Z2', 'Kerala', '9847022222', 'Kochi'), ('Bengaluru Fresh', '29AAACB3333C1Z3', 'Karnataka', '9886033333', 'Bengaluru'), ('Madurai Retail', '33AAACM4444D1Z4', 'Tamil Nadu', '9944044444', 'Madurai'),
                   ('Coimbatore Super', '33AAACC5555E1Z5', 'Tamil Nadu', '9942055555', 'Coimbatore'), ('Hyderabad Foods', '36AAACH6666F1Z6', 'Telangana', '9848066666', 'Hyderabad'), ('Trichy Bazaar', '33AAACT7777G1Z7', 'Tamil Nadu', '9943077777', 'Tiruchirappalli'), ('Mumbai Snacks Hub', '27AAACM8888H1Z8', 'Maharashtra', '9820088888', 'Mumbai')]:
            run('insert into customers(name,gstin,state,phone,city) values(?,?,?,?,?)', c_)
        for m in [('Rice flour', 'raw', 'kg', 55, 150, 1500), ('Sunflower oil', 'raw', 'litre', 130, 80, 800), ('Salt', 'raw', 'kg', 20, 15, 150), ('Chilli powder', 'raw', 'kg', 300, 10, 100), ('Pouch', 'packaging', 'pieces', 1.2, 1000, 12000), ('Carton (20 pkts)', 'packaging', 'pieces', 15, 60, 800), ('Gram flour', 'raw', 'kg', 70, 80, 800), ('Groundnuts', 'raw', 'kg', 110, 60, 400)]:
            mid = run('insert into materials(name,kind,unit,avg_cost,reorder) values(?,?,?,?,?)', m[:5]); ledger('material', mid, m[5], m[3], 'opening', 0, 'OPEN', '2027-06-30')
        for p in [('Murukku 200g', '19059040', 12, 40, 100, 28), ('Banana Chips 150g', '20049000', 12, 35, 100, 24), ('Mixture 250g', '19059040', 12, 55, 80, 38), ('Ribbon Pakoda 200g', '19059040', 12, 42, 100, 29)]:
            pid = run('insert into products(name,hsn,gst_rate,price,expected_yield,avg_cost) values(?,?,?,?,?,?)', p); ledger('product', pid, 150, p[5], 'opening', 0)
        BOM = {1: [(1, 20), (2, 8), (3, .5), (4, .4), (5, 105), (6, 5)], 2: [(1, 5), (2, 12), (3, .6), (4, .2), (5, 105), (6, 5)], 3: [(7, 10), (8, 5), (2, 9), (3, .4), (4, .3), (5, 85), (6, 4)], 4: [(1, 10), (7, 8), (2, 8), (3, .5), (4, .3), (5, 105), (6, 5)]}
        for pid, rows in BOM.items():
            for m, qty in rows: run('insert into bom(product_id,material_id,qty) values(?,?,?)', (pid, m, qty))
        log('SEED', 'Database initialised')
    seed_history()

@app.before_request
def auth():
    if request.method == 'OPTIONS' or request.path == '/api/login' or not request.path.startswith('/api'): return
    t = request.headers.get('Authorization', '').replace('Bearer ', '') or request.args.get('token', '')
    if t not in TOK: return jsonify(error='Login required'), 401
    g.user = TOK[t]
    r = g.user['role']
    if r == 'auditor' and request.method != 'GET': return jsonify(error='Auditor has read-only access'), 403
    if r == 'salesman' and request.method != 'GET' and request.path != '/api/orders': return jsonify(error='Not allowed for salesman'), 403

@app.post('/api/login')
def login():
    d = request.json; u = q1('select * from users where username=?', (d.get('username'),))
    if not u or not check_password_hash(u['password'], d.get('password', '')): return jsonify(error='Wrong username or password'), 401
    t = secrets.token_hex(16); TOK[t] = {'username': u['username'], 'role': u['role'], 'name': u['name']}
    log('LOGIN', u['username']); return jsonify(token=t, user=TOK[t])

@app.get('/api/customers')
def customers(): return jsonify(q('select * from customers'))
@app.post('/api/customers')
def add_customer():
    d = request.json; i = run('insert into customers(name,gstin,state,phone,city) values(?,?,?,?,?)', (d['name'], d.get('gstin'), d['state'], d.get('phone'), d.get('city'))); log('CUSTOMER', d['name']); return jsonify(id=i)
@app.get('/api/products')
def products():
    ps = q('select * from products')
    for p in ps: p['stock'] = bal('product', p['id'])
    return jsonify(ps)
@app.post('/api/products')
def add_product():
    d = request.json; i = run('insert into products(name,hsn,gst_rate,price,expected_yield) values(?,?,?,?,?)', (d['name'], d['hsn'], d['gst_rate'], d['price'], d['expected_yield'])); log('PRODUCT', d['name']); return jsonify(id=i)
@app.get('/api/materials')
def materials():
    ms = q('select * from materials')
    for m in ms: m['stock'] = bal('material', m['id']); m['value'] = m['stock'] * m['avg_cost']
    return jsonify(ms)
@app.get('/api/bom/<int:pid>')
def bom(pid): return jsonify(q('select b.material_id,m.name,m.unit,m.kind,m.avg_cost,b.qty,b.qty*m.avg_cost cost from bom b join materials m on m.id=b.material_id where b.product_id=?', (pid,)))
@app.post('/api/bom/<int:pid>')
def set_bom(pid):
    run('delete from bom where product_id=?', (pid,))
    for r in request.json['items']: run('insert into bom(product_id,material_id,qty) values(?,?,?)', (pid, r['material_id'], r['qty']))
    log('BOM', f'BOM updated for product {pid}'); return jsonify(ok=True)

def order_full(o):
    o['customer'] = q1('select * from customers where id=?', (o['customer_id'],))['name']
    o['items'] = q('select i.*,p.name from order_items i join products p on p.id=i.product_id where order_id=?', (o['id'],))
    for i in o['items']: i['available'] = bal('product', i['product_id'])
    inv = q1('select id,number from invoices where order_id=?', (o['id'],)); o['invoice'] = inv
    return o
@app.get('/api/orders')
def orders():
    cid = request.args.get('customer_id')
    rows = q('select * from orders where customer_id=? order by id desc', (cid,)) if cid else q('select * from orders order by id desc')
    return jsonify([order_full(o) for o in rows])
@app.post('/api/orders')
def new_order():
    d = request.json; total = 0
    oid = run('insert into orders(customer_id,status,created,salesman) values(?,?,?,?)', (d['customer_id'], 'Submitted', now(), g.user['username']))
    for it in d['items']:
        p = q1('select * from products where id=?', (it['product_id'],)); amt = it['qty'] * p['price'] * (1 + p['gst_rate'] / 100); total += amt
        run('insert into order_items(order_id,product_id,qty,price,gst_rate) values(?,?,?,?,?)', (oid, p['id'], it['qty'], p['price'], p['gst_rate']))
    run('update orders set total=? where id=?', (round(total, 2), oid)); log('ORDER', f'Order #{oid} submitted'); return jsonify(id=oid)
@app.post('/api/orders/<int:oid>/approve')
def approve(oid):
    run("update orders set status='Approved' where id=? and status='Submitted'", (oid,)); log('APPROVE', f'Order #{oid}'); return jsonify(ok=True)

@app.post('/api/orders/<int:oid>/invoice')
def invoice(oid):
    o = q1('select * from orders where id=?', (oid,))
    if o['status'] != 'Approved': return jsonify(error='Order must be approved first'), 400
    c = q1('select * from customers where id=?', (o['customer_id'],)); items = q('select * from order_items where order_id=?', (oid,))
    for i in items:
        if bal('product', i['product_id']) < i['qty']: return jsonify(error='Insufficient finished goods stock'), 400
    taxable = sum(i['qty'] * i['price'] for i in items); tax = sum(i['qty'] * i['price'] * i['gst_rate'] / 100 for i in items)
    inter = c['state'] != COMPANY['state']
    n = db().execute('select count(*) from invoices').fetchone()[0] + 1; num = f'FF/2026-27/{n:04d}'
    iid = run('insert into invoices(number,order_id,customer_id,date,taxable,cgst,sgst,igst,total) values(?,?,?,?,?,?,?,?,?)', (num, oid, c['id'], today(), round(taxable, 2), 0 if inter else round(tax / 2, 2), 0 if inter else round(tax / 2, 2), round(tax, 2) if inter else 0, round(taxable + tax, 2)))
    run("update orders set status='Invoiced' where id=?", (oid,)); log('INVOICE', num); return jsonify(id=iid, number=num)
@app.post('/api/orders/<int:oid>/dispatch')
def dispatch(oid):
    o = q1('select * from orders where id=?', (oid,))
    if o['status'] != 'Invoiced': return jsonify(error='Invoice the order first'), 400
    for i in q('select * from order_items where order_id=?', (oid,)):
        p = q1('select * from products where id=?', (i['product_id'],)); ledger('product', p['id'], -i['qty'], p['avg_cost'], 'dispatch', oid)
    run("update orders set status='Dispatched' where id=?", (oid,)); log('DISPATCH', f'Order #{oid}'); return jsonify(ok=True)
@app.get('/api/invoices')
def invoices():
    r = q('select i.*,c.name customer,c.gstin,c.state,coalesce((select sum(amount) from payments where invoice_id=i.id),0) paid from invoices i join customers c on c.id=i.customer_id order by i.id desc')
    for x in r: x['due'] = round(x['total'] - x['paid'], 2)
    return jsonify(r)
@app.get('/api/invoices/<int:iid>/pdf')
def inv_pdf(iid):
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    inv = q1('select * from invoices where id=?', (iid,)); c = q1('select * from customers where id=?', (inv['customer_id'],))
    items = q('select i.*,p.name,p.hsn from order_items i join products p on p.id=i.product_id where order_id=?', (inv['order_id'],))
    b = io.BytesIO(); p = canvas.Canvas(b, pagesize=A4); y = 800
    def t(s, x=40, size=10, bold=False):
        nonlocal y; p.setFont('Helvetica-Bold' if bold else 'Helvetica', size); p.drawString(x, y, str(s))
    t(COMPANY['name'] + '  -  TAX INVOICE', size=14, bold=True); y -= 16; t(f"GSTIN {COMPANY['gstin']} | {COMPANY['state']}"); y -= 24
    t(f"Invoice No: {inv['number']}    Date: {inv['date']}", bold=True); y -= 16; t(f"Bill to: {c['name']}  GSTIN: {c['gstin']}  State: {c['state']}"); y -= 24
    for x, h in zip([40, 190, 260, 310, 370, 450], ['Item', 'HSN', 'Qty', 'Rate', 'GST%', 'Taxable']): p.setFont('Helvetica-Bold', 9); p.drawString(x, y, h)
    y -= 14
    for i in items:
        for x, v in zip([40, 190, 260, 310, 370, 450], [i['name'], i['hsn'], i['qty'], i['price'], i['gst_rate'], round(i['qty'] * i['price'], 2)]): p.setFont('Helvetica', 9); p.drawString(x, y, str(v))
        y -= 14
    y -= 14
    for k in ['taxable', 'cgst', 'sgst', 'igst']: t(f'{k.upper()}: Rs {inv[k]:.2f}', 380); y -= 14
    t(f"TOTAL: Rs {inv['total']:.2f}", 380, 12, True); p.save(); b.seek(0)
    return send_file(b, mimetype='application/pdf', download_name=inv['number'].replace('/', '-') + '.pdf')

@app.get('/api/purchases')
def purchases(): return jsonify(q('select p.*,m.name material,m.unit from purchases p join materials m on m.id=p.material_id order by p.id desc'))
@app.post('/api/purchases')
def add_purchase():
    d = request.json; m = q1('select * from materials where id=?', (d['material_id'],)); stock = bal('material', m['id'])
    new_avg = (stock * m['avg_cost'] + d['qty'] * d['rate']) / (stock + d['qty'])   # weighted average costing
    pid = run('insert into purchases(supplier,material_id,qty,rate,batch,expiry,date) values(?,?,?,?,?,?,?)', (d['supplier'], m['id'], d['qty'], d['rate'], d.get('batch'), d.get('expiry'), today()))
    run('update materials set avg_cost=? where id=?', (round(new_avg, 4), m['id'])); ledger('material', m['id'], d['qty'], d['rate'], 'purchase', pid, d.get('batch'), d.get('expiry'))
    log('PURCHASE', f"{d['qty']} {m['unit']} {m['name']}"); return jsonify(id=pid)
@app.post('/api/adjust')
def adjust():
    d = request.json; t = d['item_type']; row = q1(f"select * from {'materials' if t == 'material' else 'products'} where id=?", (d['item_id'],))
    ledger(t, d['item_id'], d['qty'], row['avg_cost'], 'adjustment:' + d.get('reason', ''), 0); log('ADJUST', f"{t} {d['item_id']} {d['qty']} ({d.get('reason')})"); return jsonify(ok=True)
@app.get('/api/ledger')
def get_ledger():
    return jsonify(q("select l.*,coalesce(m.name,p.name) item from stock_ledger l left join materials m on l.item_type='material' and m.id=l.item_id left join products p on l.item_type='product' and p.id=l.item_id order by l.id desc limit 200"))

@app.get('/api/production')
def prods():
    r = q('select pr.*,p.name product from productions pr join products p on p.id=pr.product_id order by pr.id desc')
    for x in r: x['materials'] = q('select pm.*,m.name,m.unit from production_materials pm join materials m on m.id=pm.material_id where production_id=?', (x['id'],))
    return jsonify(r)
@app.post('/api/production')
def add_prod():
    d = request.json; p = q1('select * from products where id=?', (d['product_id'],)); b = float(d['batches']); rows = []; mv = 0; rc = pc = 0
    for r in q('select b.*,m.kind,m.avg_cost from bom b join materials m on m.id=b.material_id where product_id=?', (p['id'],)):
        planned = r['qty'] * b; actual = float(d['actual'].get(str(r['material_id']), planned)); var = (actual - planned) / planned * 100 if planned else 0
        mv = max(mv, abs(var)); cost = actual * r['avg_cost']; rc += cost if r['kind'] == 'raw' else 0; pc += cost if r['kind'] == 'packaging' else 0
        rows.append((r['material_id'], planned, actual, round(var, 2), r['avg_cost']))
    exp = p['expected_yield'] * b; good = float(d['good_packets']); lab, gas, pw = float(d.get('labour', 0)), float(d.get('gas', 0)), float(d.get('power', 0))
    total = rc + pc + lab + gas + pw; cpp = total / good if good else 0; yld = good / exp * 100 if exp else 0
    status = 'critical' if mv > 7 or yld < 90 else 'warning' if mv > 3 or yld < 95 else 'normal'
    n = db().execute('select count(*) from productions').fetchone()[0] + 1; bn = f'B{dt.date.fromisoformat(today()):%y%m%d}-{n:03d}'
    pid = run('insert into productions(batch_no,product_id,date,supervisor,batches,expected_packets,good_packets,damaged,wastage,raw_cost,pack_cost,labour,gas,power,total_cost,cost_per_packet,max_variance,status) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', (bn, p['id'], today(), d.get('supervisor', ''), b, exp, good, float(d.get('damaged', 0)), float(d.get('wastage', 0)), rc, pc, lab, gas, pw, round(total, 2), round(cpp, 3), round(mv, 2), status))
    for m, pl, ac, v, cost in rows:
        run('insert into production_materials(production_id,material_id,planned,actual,variance_pct) values(?,?,?,?,?)', (pid, m, pl, ac, v)); ledger('material', m, -ac, cost, 'production_issue', pid, bn)
    old = bal('product', p['id']); newavg = (old * p['avg_cost'] + good * cpp) / (old + good) if old + good else cpp
    run('update products set avg_cost=? where id=?', (round(newavg, 3), p['id'])); ledger('product', p['id'], good, cpp, 'production_receipt', pid, bn)
    log('PRODUCTION', f'{bn} {status}'); return jsonify(id=pid, batch_no=bn, status=status)

@app.post('/api/payments')
def pay():
    d = request.json; run('insert into payments(invoice_id,amount,mode,date) values(?,?,?,?)', (d['invoice_id'], d['amount'], d['mode'], today())); log('PAYMENT', f"Invoice {d['invoice_id']} Rs {d['amount']}"); return jsonify(ok=True)
@app.get('/api/payments')
def payments(): return jsonify(q('select p.*,i.number,c.name customer from payments p join invoices i on i.id=p.invoice_id join customers c on c.id=i.customer_id order by p.id desc'))
@app.get('/api/users')
def users(): return jsonify(q('select id,username,role,name from users'))

def alerts():
    A = []
    for m in materials().json:
        if m['stock'] < m['reorder']: A.append(dict(sev='critical' if m['stock'] < m['reorder'] / 2 else 'warning', type='Low raw material stock', msg=f"{m['name']} is {m['stock']:.1f} {m['unit']} (reorder at {m['reorder']})"))
    for p in products().json:
        if p['stock'] < p['reorder']: A.append(dict(sev='warning', type='Finished goods shortage', msg=f"{p['name']} has only {p['stock']:.0f} packets"))
    for r in q('select pr.*,p.name product from productions pr join products p on p.id=pr.product_id order by id desc limit 5'):
        if r['status'] != 'normal': A.append(dict(sev=r['status'], type='Production variance', msg=f"{r['batch_no']} {r['product']}: max material variance {r['max_variance']}%"))
        if r['damaged'] > 0.03 * r['expected_packets']: A.append(dict(sev='warning', type='Damaged packaging', msg=f"{r['batch_no']}: {r['damaged']:.0f} damaged packs"))
        if r['wastage'] > 2.5 * r['batches']: A.append(dict(sev='warning', type='High wastage', msg=f"{r['batch_no']}: wastage {r['wastage']} kg"))
    n = db().execute("select count(*) from orders where status='Submitted'").fetchone()[0]
    if n: A.append(dict(sev='warning', type='Pending approvals', msg=f'{n} order(s) waiting for approval'))
    for i in q("select number,total-coalesce((select sum(amount) from payments where invoice_id=invoices.id),0) due,date from invoices"):
        if i['due'] > 0.5 and (dt.date.today() - dt.date.fromisoformat(i['date'])).days > 15: A.append(dict(sev='critical', type='Unpaid invoice', msg=f"{i['number']} unpaid Rs {i['due']:.0f} for over 15 days"))
    return A
@app.get('/api/alerts')
def alerts_api(): return jsonify(alerts())

@app.get('/api/dashboard')
def dash():
    t = today(); ms = materials().json; ps = products().json; inv = invoices().json; runs = q('select pr.*,p.name product from productions pr join products p on p.id=pr.product_id order by id desc limit 6')
    flow = {s: db().execute('select count(*) from orders where status=?', (s,)).fetchone()[0] for s in ['Submitted', 'Approved', 'Invoiced', 'Dispatched']}
    allr = q('select * from productions')
    return jsonify(revenue_today=sum(i['total'] for i in inv if i['date'] == t), orders_today=db().execute('select count(*) from orders where created like ?', (t + '%',)).fetchone()[0], pending=flow['Submitted'],
        output=sum(r['good_packets'] for r in allr), raw_value=sum(m['value'] for m in ms if m['kind'] == 'raw'), fg=[{'name': p['name'], 'stock': p['stock']} for p in ps],
        receivables=sum(i['due'] for i in inv), efficiency=round(sum(r['good_packets'] for r in allr) / max(sum(r['expected_packets'] for r in allr), 1) * 100, 1), flow=flow,
        stock=[{'name': m['name'], 'stock': m['stock'], 'reorder': m['reorder'], 'unit': m['unit']} for m in ms], runs=runs[::-1], alerts=alerts(),
        cost=[{'batch': r['batch_no'], 'cpp': r['cost_per_packet'], 'price': next(p['price'] for p in ps if p['id'] == r['product_id'])} for r in runs[::-1]])

@app.get('/api/insights')
def insights():
    out = []
    for r in q('select pm.*,m.name,pr.batch_no from production_materials pm join materials m on m.id=pm.material_id join productions pr on pr.id=pm.production_id order by pm.id desc limit 60'):
        if r['variance_pct'] > 3: out.append(f"{r['name']} consumption exceeded the BOM standard by {r['variance_pct']:.1f}% in batch {r['batch_no']}. Review the current production batch.")
    for m in materials().json:
        if m['stock'] < m['reorder']: out.append(f"{m['name']} stock is below the reorder level. Raise a purchase order.")
    top = q('select p.name,sum(i.qty) q from order_items i join products p on p.id=i.product_id group by p.id order by q desc limit 1')
    if top: out.append(f"{top[0]['name']} is the best-selling product ({top[0]['q']:.0f} packets ordered).")
    margin = q('select p.name,(p.price-p.avg_cost)/p.price*100 m from products p order by m asc limit 1')
    if margin: out.append(f"{margin[0]['name']} has the lowest margin at {margin[0]['m']:.1f}% on weighted-average cost.")
    return jsonify(insights=out or ['No exceptions detected. All metrics are within BOM standards.'],
        monthly=q("select strftime('%Y-%m',date) month,sum(total) sales from invoices group by 1"),
        products=q('select p.name,sum(i.qty) qty,sum(i.qty*i.price) value from order_items i join products p on p.id=i.product_id group by p.id'),
        customers=q('select c.name,sum(o.total) value,count(*) orders from orders o join customers c on c.id=o.customer_id group by c.id'),
        consumption=q('select m.name,sum(pm.planned) planned,sum(pm.actual) actual from production_materials pm join materials m on m.id=pm.material_id group by m.id'))

REPORTS = {
 'sales': 'select i.number,i.date,c.name customer,c.gstin,i.taxable,i.cgst,i.sgst,i.igst,i.total from invoices i join customers c on c.id=i.customer_id where i.date between :a and :b',
 'purchases': 'select p.date,p.supplier,m.name material,p.qty,p.rate,p.qty*p.rate amount,p.batch,p.expiry from purchases p join materials m on m.id=p.material_id where p.date between :a and :b',
 'gst': "select date,sum(taxable) taxable,sum(cgst) cgst,sum(sgst) sgst,sum(igst) igst,sum(total) total from invoices where date between :a and :b group by date",
 'stock': "select substr(l.ts,1,10) date,l.item_type,coalesce(m.name,p.name) item,l.qty,l.unit_cost,l.ref_type,l.batch from stock_ledger l left join materials m on l.item_type='material' and m.id=l.item_id left join products p on l.item_type='product' and p.id=l.item_id where substr(l.ts,1,10) between :a and :b",
 'variance': 'select pr.batch_no,pr.date,m.name material,pm.planned,pm.actual,pm.variance_pct from production_materials pm join productions pr on pr.id=pm.production_id join materials m on m.id=pm.material_id where pr.date between :a and :b',
 'costing': 'select pr.batch_no,pr.date,p.name product,pr.raw_cost,pr.pack_cost,pr.labour,pr.gas,pr.power,pr.total_cost,pr.good_packets,pr.cost_per_packet,p.price,p.price-pr.cost_per_packet profit_per_packet,pr.status from productions pr join products p on p.id=pr.product_id where pr.date between :a and :b',
 'payments': 'select p.date,i.number invoice,c.name customer,p.amount,p.mode from payments p join invoices i on i.id=p.invoice_id join customers c on c.id=i.customer_id where p.date between :a and :b',
 'activity': 'select ts,user,action,detail from audit_log where substr(ts,1,10) between :a and :b order by id desc'}
def report_rows(name, a, b):
    if name == 'ageing':
        rows = []
        for i in invoices().json:
            if i['due'] > 0.5:
                d = (dt.date.today() - dt.date.fromisoformat(i['date'])).days
                rows.append({'invoice': i['number'], 'customer': i['customer'], 'date': i['date'], 'due': i['due'], 'days': d, 'bucket': '0-15' if d <= 15 else '16-30' if d <= 30 else '30+'})
        return rows
    return q(REPORTS[name], {'a': a, 'b': b})
@app.get('/api/audit/<name>')
def audit(name):
    a, b = request.args.get('from', '2000-01-01'), request.args.get('to', '2999-12-31'); rows = report_rows(name, a, b); fmt = request.args.get('fmt', 'json')
    if fmt == 'json': return jsonify(rows)
    cols = list(rows[0].keys()) if rows else ['empty']
    if fmt == 'csv':
        s = io.StringIO(); w = csv.writer(s); w.writerow(cols); [w.writerow([r[c] for c in cols]) for r in rows]
        return send_file(io.BytesIO(s.getvalue().encode()), mimetype='text/csv', download_name=name + '.csv')
    if fmt == 'xlsx':
        from openpyxl import Workbook
        wb = Workbook(); ws = wb.active; ws.append(cols); [ws.append([r[c] for c in cols]) for r in rows]; bio = io.BytesIO(); wb.save(bio); bio.seek(0)
        return send_file(bio, download_name=name + '.xlsx')
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.pdfgen import canvas
    bio = io.BytesIO(); c = canvas.Canvas(bio, pagesize=landscape(A4)); y = 560; c.setFont('Helvetica-Bold', 12); c.drawString(30, 580, f'FactoryFlow 360 - {name} report ({a} to {b})'); c.setFont('Helvetica', 7)
    step = 780 / max(len(cols), 1)
    for i, h in enumerate(cols): c.drawString(30 + i * step, y, h[:int(step / 4)])
    for r in rows:
        y -= 11
        if y < 30: c.showPage(); y = 560; c.setFont('Helvetica', 7)
        for i, k in enumerate(cols): c.drawString(30 + i * step, y, str(r[k])[:int(step / 4)])
    c.save(); bio.seek(0); return send_file(bio, mimetype='application/pdf', download_name=name + '.pdf')

if __name__ == '__main__':
    init(); app.run(port=5000, debug=False)
