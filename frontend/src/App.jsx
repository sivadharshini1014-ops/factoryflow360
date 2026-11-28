import React, { useEffect, useState, useCallback } from 'react'
import { LayoutDashboard, ShoppingCart, Users, Package, Factory, FlaskConical, Boxes, Truck, Coins, FileText, Wallet, ShieldCheck, BarChart3, UserCog, Settings as Cog, Bell, Menu, LogOut, Search, RefreshCw } from 'lucide-react'
import { api, setToken, getToken, download, inr } from './api'

const NAV = [
  ['Command Center', LayoutDashboard, ['admin']], ['Orders', ShoppingCart, ['admin', 'salesman']], ['Customers', Users, ['admin', 'salesman']], ['Products', Package, ['admin']],
  ['Production Studio', Factory, ['admin']], ['BOM Intelligence', FlaskConical, ['admin']], ['Inventory', Boxes, ['admin', 'auditor']], ['Purchases', Truck, ['admin']],
  ['CostVision', Coins, ['admin', 'auditor']], ['GST AutoDesk', FileText, ['admin', 'auditor']], ['Payments', Wallet, ['admin']], ['Audit Vault', ShieldCheck, ['admin', 'auditor']],
  ['Reports', BarChart3, ['admin', 'auditor']], ['User Management', UserCog, ['admin']], ['Settings', Cog, ['admin']]]
const SEV = { normal: 'bg-mint text-emerald-800', warning: 'bg-amber-100 text-amber-800', critical: 'bg-red-100 text-red-700' }

const Logo = ({ s = 34 }) => (<svg width={s} height={s} viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="17" stroke="#14B8A6" strokeWidth="3" strokeDasharray="70 14" /><path d="M10 26V16l6 4v-4l6 4v-6h8v12z" fill="#14B8A6" /><path d="M31 8l3 4-4 1" stroke="#D1FAE5" strokeWidth="2" /></svg>)
const Badge = ({ s, children }) => <span className={'px-2 py-0.5 rounded-full text-xs font-semibold ' + SEV[s]}>{children || s}</span>
const Bar = ({ pct, color = '#14B8A6' }) => <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: Math.min(100, Math.max(2, pct)) + '%', background: color }} /></div>
const Empty = ({ t }) => <div className="text-center text-slate2 text-sm py-8">{t}</div>
const Table = ({ cols, rows, empty = 'Nothing here yet.' }) => rows.length ? <div className="overflow-x-auto"><table className="w-full"><thead><tr>{cols.map(c => <th key={c[0]}>{c[0]}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{cols.map(c => <td key={c[0]}>{c[1](r)}</td>)}</tr>)}</tbody></table></div> : <Empty t={empty} />
const Field = ({ label, children }) => <label className="block text-xs font-semibold text-slate2 space-y-1"><span>{label}</span>{children}</label>
function useLoad(path, dep = 0) { const [d, setD] = useState(null); const load = useCallback(() => api(path).then(setD).catch(() => setD([])), [path]); useEffect(() => { load() }, [load, dep]); return [d, load] }
const Skel = () => <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="skel" />)}</div>

/* ---------- Command Center ---------- */
function Command() {
  const [d] = useLoad('/dashboard'); if (!d || Array.isArray(d)) return <Skel />
  const K = [['Today’s revenue', inr(d.revenue_today)], ['Orders today', d.orders_today], ['Pending approvals', d.pending], ['Production output', d.output + ' pkts'], ['Raw material value', inr(d.raw_value)], ['Finished goods', d.fg.map(f => f.stock).reduce((a, b) => a + b, 0) + ' pkts'], ['Receivables', inr(d.receivables)], ['Efficiency', d.efficiency + '%']]
  return <div className="space-y-5">
    <div className="rounded-3xl bg-navy text-white p-6 flex flex-wrap gap-6 items-center">
      <div className="relative"><div className="w-24 h-24 rounded-full border-4 border-teal flex items-center justify-center text-2xl font-extrabold">{d.efficiency}%</div><span className="absolute inset-0 rounded-full border-4 border-teal/40 animate-ping" /></div>
      <div className="flex-1 min-w-[240px]"><div className="text-xs text-teal font-semibold">Factory Pulse</div><div className="text-xl font-bold">{d.alerts.filter(a => a.sev === 'critical').length} critical · {d.alerts.filter(a => a.sev === 'warning').length} warnings</div>
        <div className="mt-3 grid grid-cols-4 gap-2">{Object.entries(d.flow).map(([k, v]) => <div key={k} className="bg-white/10 rounded-xl p-2 text-center"><div className="text-lg font-bold">{v}</div><div className="text-[11px] text-mint">{k}</div></div>)}</div></div>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{K.map(k => <div key={k[0]} className="card"><div className="text-xs text-slate2">{k[0]}</div><div className="text-xl font-extrabold mt-1">{k[1]}</div></div>)}</div>
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card"><h3 className="font-bold mb-3">Stock Pulse</h3><div className="space-y-3">{d.stock.map(s => <div key={s.name}><div className="flex justify-between text-sm"><span>{s.name}</span><span>{s.stock.toFixed(0)} {s.unit}</span></div><Bar pct={s.stock / (s.reorder * 4) * 100} color={s.stock < s.reorder ? '#EF4444' : '#14B8A6'} /></div>)}</div></div>
      <div className="card"><h3 className="font-bold mb-3">Production Health · expected vs actual</h3>{d.runs.length ? d.runs.map(r => <div key={r.id} className="mb-3"><div className="flex justify-between text-xs"><span>{r.batch_no} {r.product}</span><Badge s={r.status} /></div><Bar pct={100} color="#CBD5E1" /><div className="h-1" /><Bar pct={r.good_packets / r.expected_packets * 100} color={r.status === 'normal' ? '#14B8A6' : r.status === 'warning' ? '#F59E0B' : '#EF4444'} /></div>) : <Empty t="No production runs yet." />}</div>
      <div className="card"><h3 className="font-bold mb-3">CostVision · cost vs selling price per packet</h3>{d.cost.length ? d.cost.map(c => <div key={c.batch} className="flex justify-between text-sm py-1 border-t first:border-0"><span>{c.batch}</span><span>₹{c.cpp} → ₹{c.price} <b className="text-teal-600">({((c.price - c.cpp) / c.price * 100).toFixed(0)}%)</b></span></div>) : <Empty t="No batches costed yet." />}</div>
      <div className="card"><h3 className="font-bold mb-3">Smart Alerts</h3><div className="space-y-2 max-h-64 overflow-auto">{d.alerts.map((a, i) => <div key={i} className="flex gap-2 items-start text-sm"><Badge s={a.sev} /><div><b>{a.type}</b><div className="text-slate2">{a.msg}</div></div></div>)}{!d.alerts.length && <Empty t="All clear." />}</div></div>
    </div></div>
}

/* ---------- Orders ---------- */
function Orders({ user, toast }) {
  const [tick, setTick] = useState(0); const [orders] = useLoad('/orders', tick); const [cs] = useLoad('/customers'); const [ps] = useLoad('/products')
  const [cid, setCid] = useState(''); const [lines, setLines] = useState({}); const [drafts, setDrafts] = useState(JSON.parse(localStorage.getItem('ff_drafts') || '[]')); const admin = user.role === 'admin'
  const items = Object.entries(lines).filter(([, q]) => q > 0).map(([pid, qty]) => ({ product_id: +pid, qty: +qty }))
  const total = items.reduce((s, i) => { const p = ps.find(x => x.id === i.product_id); return s + i.qty * p.price * (1 + p.gst_rate / 100) }, 0)
  const saveDrafts = d => { setDrafts(d); localStorage.setItem('ff_drafts', JSON.stringify(d)) }
  const submit = async () => { try { await api('/orders', 'POST', { customer_id: +cid, items }); toast('Order submitted'); setLines({}); setTick(t => t + 1) } catch { saveDrafts([...drafts, { customer_id: +cid, items }]); toast('Offline — order saved as draft'); setLines({}) } }
  const sync = async () => { const left = []; for (const d of drafts) { try { await api('/orders', 'POST', d) } catch { left.push(d) } } saveDrafts(left); setTick(t => t + 1); toast(left.length ? 'Some drafts still pending' : 'Drafts synced') }
  useEffect(() => { window.addEventListener('online', sync); return () => window.removeEventListener('online', sync) })
  const act = async (id, a, msg) => { try { await api(`/orders/${id}/${a}`, 'POST'); toast(msg); setTick(t => t + 1) } catch (e) { toast(e.message, 1) } }
  if (!cs || !ps || !orders) return <Skel />
  return <div className="grid lg:grid-cols-3 gap-5">
    <div className="card space-y-3 h-fit"><h3 className="font-bold">New order</h3>
      <Field label="Customer"><select className="inp" value={cid} onChange={e => setCid(e.target.value)}><option value="">Select customer</option>{cs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      {ps.map(p => <div key={p.id} className="flex items-center gap-2"><div className="flex-1 text-sm">{p.name}<div className="text-xs text-slate2">₹{p.price} + {p.gst_rate}% GST</div></div><input type="number" min="0" className="inp !w-24" placeholder="Qty" value={lines[p.id] || ''} onChange={e => setLines({ ...lines, [p.id]: e.target.value })} /></div>)}
      <div className="flex justify-between font-bold"><span>Total incl. GST</span><span>{inr(total)}</span></div>
      <button className="btn w-full" disabled={!cid || !items.length} onClick={submit}>Submit order</button>
      {drafts.length > 0 && <button className="btn2 w-full flex items-center justify-center gap-2" onClick={sync}><RefreshCw size={14} />Sync {drafts.length} offline draft(s)</button>}</div>
    <div className="card lg:col-span-2"><h3 className="font-bold mb-2">Orders</h3>
      <Table empty="No orders yet. Create the first one." rows={orders} cols={[['#', o => o.id], ['Customer', o => o.customer], ['Items', o => o.items.map(i => `${i.name} × ${i.qty}` + (admin && o.status === 'Submitted' ? ` (stock ${i.available})` : '')).join(', ')], ['Total', o => inr(o.total)], ['Status', o => <Badge s={o.status === 'Submitted' ? 'warning' : 'normal'}>{o.status}</Badge>],
        ['', o => admin && <div className="flex gap-1">{o.status === 'Submitted' && <button className="btn2" onClick={() => act(o.id, 'approve', 'Order approved')}>Approve</button>}{o.status === 'Approved' && <button className="btn2" onClick={() => act(o.id, 'invoice', 'Invoice generated')}>Invoice</button>}{o.status === 'Invoiced' && <button className="btn2" onClick={() => act(o.id, 'dispatch', 'Dispatched')}>Dispatch</button>}{o.invoice && <button className="btn2" onClick={() => download(`/invoices/${o.invoice.id}/pdf`, 'invoice.pdf')}>PDF</button>}</div>]]} /></div></div>
}

/* ---------- Simple master pages ---------- */
function Master({ path, title, fields, cols, toast, readonly }) {
  const [t, setT] = useState(0); const [rows] = useLoad(path, t); const [f, setF] = useState({}); if (!rows) return <Skel />
  const add = async () => { try { await api(path, 'POST', f); setF({}); setT(t + 1); toast(title + ' added') } catch (e) { toast(e.message, 1) } }
  return <div className="grid lg:grid-cols-3 gap-5">{!readonly && <div className="card space-y-3 h-fit"><h3 className="font-bold">Add {title}</h3>{fields.map(([k, l]) => <Field key={k} label={l}><input className="inp" value={f[k] || ''} onChange={e => setF({ ...f, [k]: e.target.value })} /></Field>)}<button className="btn w-full" onClick={add}>Save {title}</button></div>}
    <div className={'card ' + (readonly ? 'lg:col-span-3' : 'lg:col-span-2')}><Table rows={rows} cols={cols} /></div></div>
}

/* ---------- BOM Intelligence ---------- */
function BOM() {
  const [ps] = useLoad('/products'); const [pid, setPid] = useState(1); const [size, setSize] = useState(1); const [b] = useLoad('/bom/' + pid, pid); if (!ps || !b) return <Skel />
  const p = ps.find(x => x.id == pid) || ps[0]; const total = b.reduce((s, r) => s + r.cost * size, 0)
  return <div className="space-y-4"><div className="card flex flex-wrap gap-4 items-end"><Field label="Product"><select className="inp" value={pid} onChange={e => setPid(e.target.value)}>{ps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
    <Field label="Batch size (multiplier)"><input type="number" min="1" className="inp" value={size} onChange={e => setSize(e.target.value)} /></Field><div className="text-sm">Expected yield: <b>{(p.expected_yield * size).toFixed(0)} packets</b> · Material cost: <b>{inr(total)}</b></div></div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{b.map(r => <div key={r.material_id} className="card"><div className="flex justify-between"><b>{r.name}</b><span className="text-xs text-slate2">{r.kind}</span></div><div className="text-2xl font-extrabold mt-2">{(r.qty * size).toFixed(2)} <span className="text-sm font-medium">{r.unit}</span></div><div className="text-xs text-slate2 mt-1">Standard {r.qty} {r.unit} · rate ₹{r.avg_cost.toFixed(2)} · cost {inr(r.cost * size)}</div></div>)}</div></div>
}

/* ---------- Production Studio ---------- */
function Production({ toast }) {
  const [t, setT] = useState(0); const [runs] = useLoad('/production', t); const [ps] = useLoad('/products'); const [pid, setPid] = useState(1); const [b, setB] = useState(1); const [bom] = useLoad('/bom/' + pid, pid)
  const [act, setAct] = useState({}); const [f, setF] = useState({ good_packets: '', damaged: 0, wastage: 0, labour: 0, gas: 0, power: 0, supervisor: '' }); if (!runs || !ps || !bom) return <Skel />
  const set = k => e => setF({ ...f, [k]: e.target.value })
  const save = async () => { try { const r = await api('/production', 'POST', { ...f, product_id: +pid, batches: +b, actual: act }); toast(`${r.batch_no} recorded (${r.status})`); setAct({}); setT(t + 1) } catch (e) { toast(e.message, 1) } }
  return <div className="grid xl:grid-cols-3 gap-5"><div className="card space-y-3 h-fit"><h3 className="font-bold">New production run</h3>
    <Field label="Product"><select className="inp" value={pid} onChange={e => { setPid(e.target.value); setAct({}) }}>{ps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
    <Field label="Batches"><input type="number" className="inp" value={b} onChange={e => setB(e.target.value)} /></Field><Field label="Supervisor"><input className="inp" value={f.supervisor} onChange={set('supervisor')} /></Field>
    <div className="text-xs font-semibold text-slate2">Material consumption (planned → actual)</div>
    {bom.map(r => <div key={r.material_id} className="flex items-center gap-2 text-sm"><span className="flex-1">{r.name}<div className="text-xs text-slate2">plan {(r.qty * b).toFixed(2)} {r.unit}</div></span><input type="number" className="inp !w-24" placeholder={(r.qty * b).toFixed(2)} value={act[r.material_id] ?? ''} onChange={e => setAct({ ...act, [r.material_id]: e.target.value })} /></div>)}
    <div className="grid grid-cols-2 gap-2">{[['good_packets', 'Good packets'], ['damaged', 'Damaged packs'], ['wastage', 'Wastage (kg)'], ['labour', 'Labour ₹'], ['gas', 'Gas ₹'], ['power', 'Power ₹']].map(([k, l]) => <Field key={k} label={l}><input type="number" className="inp" value={f[k]} onChange={set(k)} /></Field>)}</div>
    <button className="btn w-full" disabled={!f.good_packets} onClick={save}>Record run</button></div>
    <div className="xl:col-span-2 space-y-4">{runs.length ? runs.map(r => <div key={r.id} className="card"><div className="flex justify-between items-start"><div><div className="font-extrabold">{r.batch_no} · {r.product}</div><div className="text-xs text-slate2">{r.date} · {r.supervisor || '—'} · {r.batches} batch(es)</div></div><Badge s={r.status}>Batch health: {r.status}</Badge></div>
      <div className="grid sm:grid-cols-2 gap-5 mt-4"><div><div className="text-xs font-semibold text-slate2 mb-2">Planned vs actual</div>{r.materials.map(m => <div key={m.id} className="mb-2"><div className="flex justify-between text-xs"><span>{m.name}</span><span className={Math.abs(m.variance_pct) > 3 ? 'text-red2 font-bold' : ''}>{m.actual.toFixed(1)} / {m.planned.toFixed(1)} {m.unit} ({m.variance_pct > 0 ? '+' : ''}{m.variance_pct}%)</span></div><Bar pct={m.actual / m.planned * 50} color={Math.abs(m.variance_pct) > 3 ? '#F59E0B' : '#14B8A6'} /></div>)}</div>
        <div><div className="text-xs font-semibold text-slate2 mb-2">Yield performance</div><div className="text-3xl font-extrabold">{r.good_packets}<span className="text-sm text-slate2"> / {r.expected_packets} packets</span></div><Bar pct={r.good_packets / r.expected_packets * 100} /><div className="text-xs mt-2 text-slate2">Damaged {r.damaged} · Wastage {r.wastage} kg · Cost/packet ₹{r.cost_per_packet}</div></div></div>
      <div className="flex gap-1 mt-4 text-[11px]">{['Planned', 'Materials issued', 'Produced', 'Costed', 'Stocked'].map(s => <span key={s} className="flex-1 bg-mint text-emerald-900 rounded-lg py-1 text-center">{s}</span>)}</div></div>) : <div className="card"><Empty t="No production runs yet. Record your first batch." /></div>}</div></div>
}

/* ---------- Inventory ---------- */
function Inventory({ toast, user }) {
  const [t, setT] = useState(0); const [ms] = useLoad('/materials', t); const [ps] = useLoad('/products', t); const [led] = useLoad('/ledger', t); const [tab, setTab] = useState('raw'); const [adj, setAdj] = useState({ item: '', qty: '', reason: '' }); if (!ms || !ps || !led) return <Skel />
  const doAdj = async () => { const [type, id] = adj.item.split(':'); try { await api('/adjust', 'POST', { item_type: type, item_id: +id, qty: +adj.qty, reason: adj.reason }); toast('Adjustment posted to ledger'); setT(t + 1) } catch (e) { toast(e.message, 1) } }
  const list = tab === 'fg' ? ps.map(p => ({ ...p, unit: 'packets', stock: p.stock, value: p.stock * p.avg_cost })) : ms.filter(m => m.kind === tab)
  return <div className="space-y-4"><div className="flex gap-2 flex-wrap">{[['raw', 'Raw materials'], ['packaging', 'Packaging'], ['fg', 'Finished goods']].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={'px-4 py-2 rounded-xl text-sm font-semibold ' + (tab === k ? 'bg-navy text-white' : 'bg-white border')}>{l}</button>)}</div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{list.map(m => <div key={m.name} className="card"><div className="flex justify-between"><b>{m.name}</b>{m.stock < m.reorder && <Badge s="critical">Low</Badge>}</div><div className="text-2xl font-extrabold mt-1">{m.stock.toFixed(1)} <span className="text-sm">{m.unit}</span></div><Bar pct={m.stock / (m.reorder * 4) * 100} color={m.stock < m.reorder ? '#EF4444' : '#14B8A6'} /><div className="text-xs text-slate2 mt-1">Value {inr(m.value)} · avg cost ₹{(m.avg_cost || 0).toFixed(2)}</div></div>)}</div>
    {user.role === 'admin' && <div className="card flex flex-wrap gap-2 items-end"><Field label="Stock adjustment"><select className="inp" value={adj.item} onChange={e => setAdj({ ...adj, item: e.target.value })}><option value="">Item</option>{ms.map(m => <option key={'m' + m.id} value={'material:' + m.id}>{m.name}</option>)}{ps.map(p => <option key={'p' + p.id} value={'product:' + p.id}>{p.name}</option>)}</select></Field><Field label="Qty (+/−)"><input type="number" className="inp" value={adj.qty} onChange={e => setAdj({ ...adj, qty: e.target.value })} /></Field><Field label="Reason"><input className="inp" value={adj.reason} onChange={e => setAdj({ ...adj, reason: e.target.value })} /></Field><button className="btn" disabled={!adj.item || !adj.qty || !adj.reason} onClick={doAdj}>Post adjustment</button></div>}
    <div className="card"><h3 className="font-bold mb-2">Stock ledger · movement timeline</h3><Table rows={led} cols={[['Time', r => r.ts], ['Item', r => r.item], ['Movement', r => r.ref_type], ['Qty', r => <b className={r.qty < 0 ? 'text-red2' : 'text-teal-600'}>{r.qty > 0 ? '+' : ''}{r.qty}</b>], ['Unit cost', r => '₹' + (r.unit_cost || 0).toFixed(2)], ['Batch', r => r.batch || '—'], ['Expiry', r => r.expiry || '—']]} /></div></div>
}

/* ---------- Purchases ---------- */
function Purchases({ toast }) {
  const [t, setT] = useState(0); const [rows] = useLoad('/purchases', t); const [ms] = useLoad('/materials'); const [f, setF] = useState({ supplier: '', material_id: '', qty: '', rate: '', batch: '', expiry: '' }); if (!rows || !ms) return <Skel />
  const save = async () => { try { await api('/purchases', 'POST', { ...f, material_id: +f.material_id, qty: +f.qty, rate: +f.rate }); toast('Purchase received into raw stock'); setT(t + 1); setF({ supplier: '', material_id: '', qty: '', rate: '', batch: '', expiry: '' }) } catch (e) { toast(e.message, 1) } }
  const s = k => e => setF({ ...f, [k]: e.target.value })
  return <div className="grid lg:grid-cols-3 gap-5"><div className="card space-y-3 h-fit"><h3 className="font-bold">Record purchase</h3><Field label="Supplier"><input className="inp" value={f.supplier} onChange={s('supplier')} /></Field><Field label="Material"><select className="inp" value={f.material_id} onChange={s('material_id')}><option value="">Select</option>{ms.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}</select></Field>
    <div className="grid grid-cols-2 gap-2"><Field label="Quantity"><input type="number" className="inp" value={f.qty} onChange={s('qty')} /></Field><Field label="Rate ₹"><input type="number" className="inp" value={f.rate} onChange={s('rate')} /></Field><Field label="Batch"><input className="inp" value={f.batch} onChange={s('batch')} /></Field><Field label="Expiry"><input type="date" className="inp" value={f.expiry} onChange={s('expiry')} /></Field></div>
    <button className="btn w-full" disabled={!f.supplier || !f.material_id || !f.qty || !f.rate} onClick={save}>Save purchase</button></div>
    <div className="card lg:col-span-2"><Table rows={rows} cols={[['Date', r => r.date], ['Supplier', r => r.supplier], ['Material', r => r.material], ['Qty', r => r.qty + ' ' + r.unit], ['Rate', r => '₹' + r.rate], ['Batch', r => r.batch || '—']]} /></div></div>
}

/* ---------- CostVision ---------- */
function CostVision() {
  const [runs] = useLoad('/production'); if (!runs) return <Skel />; if (!runs.length) return <div className="card"><Empty t="Record a production run to see cost analysis." /></div>
  const C = [['raw_cost', 'Raw material', '#14B8A6'], ['pack_cost', 'Packaging', '#101828'], ['labour', 'Labour', '#F59E0B'], ['gas', 'Gas', '#64748B'], ['power', 'Power', '#D1FAE5']]
  return <div className="space-y-4">{runs.map(r => <div key={r.id} className="card"><div className="flex justify-between flex-wrap"><b>{r.batch_no} · {r.product}</b><span className="text-sm">Total {inr(r.total_cost)} · {r.good_packets} good packets · <b>₹{r.cost_per_packet}/packet</b></span></div>
    <div className="flex h-5 rounded-full overflow-hidden my-3">{C.map(([k, , col]) => <div key={k} style={{ width: r[k] / r.total_cost * 100 + '%', background: col }} title={k} />)}</div>
    <div className="flex flex-wrap gap-3 text-xs">{C.map(([k, l, col]) => <span key={k} className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: col }} />{l} {inr(r[k])}</span>)}</div></div>)}</div>
}

/* ---------- GST AutoDesk ---------- */
function GST() {
  const [rows] = useLoad('/invoices'); if (!rows) return <Skel />
  return <div className="card"><h3 className="font-bold mb-2">Tax invoices</h3><Table empty="No invoices yet. Approve an order and generate one." rows={rows} cols={[['Invoice', r => r.number], ['Date', r => r.date], ['Customer', r => r.customer], ['GSTIN', r => r.gstin], ['Taxable', r => inr(r.taxable)], ['CGST', r => inr(r.cgst)], ['SGST', r => inr(r.sgst)], ['IGST', r => inr(r.igst)], ['Total', r => <b>{inr(r.total)}</b>], ['', r => <button className="btn2" onClick={() => download(`/invoices/${r.id}/pdf`, r.number.replace(/\//g, '-') + '.pdf')}>PDF</button>]]} /></div>
}

/* ---------- Payments ---------- */
function Payments({ toast }) {
  const [t, setT] = useState(0); const [inv] = useLoad('/invoices', t); const [pay] = useLoad('/payments', t); const [f, setF] = useState({ invoice_id: '', amount: '', mode: 'UPI' }); if (!inv || !pay) return <Skel />
  const save = async () => { try { await api('/payments', 'POST', { ...f, invoice_id: +f.invoice_id, amount: +f.amount }); toast('Payment recorded'); setT(t + 1); setF({ invoice_id: '', amount: '', mode: 'UPI' }) } catch (e) { toast(e.message, 1) } }
  return <div className="grid lg:grid-cols-3 gap-5"><div className="card space-y-3 h-fit"><h3 className="font-bold">Record payment</h3><Field label="Invoice"><select className="inp" value={f.invoice_id} onChange={e => setF({ ...f, invoice_id: e.target.value })}><option value="">Select</option>{inv.filter(i => i.due > 0.5).map(i => <option key={i.id} value={i.id}>{i.number} · {i.customer} · due {inr(i.due)}</option>)}</select></Field>
    <Field label="Amount ₹"><input type="number" className="inp" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></Field><Field label="Mode"><select className="inp" value={f.mode} onChange={e => setF({ ...f, mode: e.target.value })}>{['UPI', 'Cash', 'Bank transfer', 'Cheque'].map(m => <option key={m}>{m}</option>)}</select></Field><button className="btn w-full" disabled={!f.invoice_id || !f.amount} onClick={save}>Save payment</button></div>
    <div className="card lg:col-span-2"><Table rows={pay} cols={[['Date', r => r.date], ['Invoice', r => r.number], ['Customer', r => r.customer], ['Amount', r => inr(r.amount)], ['Mode', r => r.mode]]} /></div></div>
}

/* ---------- Audit Vault ---------- */
const REP = ['sales', 'purchases', 'gst', 'stock', 'variance', 'costing', 'payments', 'ageing', 'activity']
function Audit() {
  const [r, setR] = useState('sales'); const [from, setFrom] = useState('2026-01-01'); const [to, setTo] = useState('2027-12-31'); const [rows, setRows] = useState(null)
  useEffect(() => { setRows(null); api(`/audit/${r}?from=${from}&to=${to}`).then(setRows).catch(() => setRows([])) }, [r, from, to])
  const cols = rows && rows[0] ? Object.keys(rows[0]).map(k => [k, x => String(x[k])]) : []
  return <div className="space-y-4"><div className="card flex flex-wrap gap-3 items-end"><Field label="Register"><select className="inp" value={r} onChange={e => setR(e.target.value)}>{REP.map(x => <option key={x}>{x}</option>)}</select></Field><Field label="From"><input type="date" className="inp" value={from} onChange={e => setFrom(e.target.value)} /></Field><Field label="To"><input type="date" className="inp" value={to} onChange={e => setTo(e.target.value)} /></Field>
    {['csv', 'xlsx', 'pdf'].map(f => <button key={f} className="btn2" onClick={() => download(`/audit/${r}?from=${from}&to=${to}&fmt=${f}`, `${r}.${f}`)}>Export {f.toUpperCase()}</button>)}<span className="text-xs text-slate2">Read-only for auditors</span></div>
    <div className="card">{rows ? <Table rows={rows} cols={cols} empty="No records in this date range." /> : <div className="skel" />}</div></div>
}

/* ---------- Reports / Insights ---------- */
function Reports() {
  const [d] = useLoad('/insights'); if (!d || Array.isArray(d)) return <Skel />; const mx = k => Math.max(1, ...d[k].map(x => x.value || x.sales || x.planned || 0))
  return <div className="space-y-4"><div className="card"><h3 className="font-bold mb-2">Insights <span className="text-xs text-slate2 font-normal">(rule-based, explainable — not AI)</span></h3><ul className="space-y-2 text-sm">{d.insights.map((i, k) => <li key={k} className="bg-mint/60 rounded-xl px-3 py-2">{i}</li>)}</ul></div>
    <div className="grid lg:grid-cols-2 gap-4">{[['Monthly sales', 'monthly', x => x.month, x => x.sales], ['Product performance', 'products', x => x.name, x => x.value], ['Customer performance', 'customers', x => x.name, x => x.value]].map(([t, k, l, v]) => <div key={k} className="card"><h3 className="font-bold mb-3">{t}</h3>{d[k].length ? d[k].map((x, i) => <div key={i} className="mb-2"><div className="flex justify-between text-xs"><span>{l(x)}</span><span>{inr(v(x))}</span></div><Bar pct={v(x) / Math.max(1, ...d[k].map(v)) * 100} /></div>) : <Empty t="No data yet." />}</div>)}
      <div className="card"><h3 className="font-bold mb-3">Material consumption · planned vs actual</h3>{d.consumption.length ? d.consumption.map(x => <div key={x.name} className="mb-2"><div className="flex justify-between text-xs"><span>{x.name}</span><span>{x.actual.toFixed(1)} / {x.planned.toFixed(1)}</span></div><Bar pct={x.actual / Math.max(x.planned, x.actual) * 100} color={x.actual > x.planned * 1.03 ? '#F59E0B' : '#14B8A6'} /></div>) : <Empty t="No production yet." />}</div></div></div>
}

function Users_() { const [u] = useLoad('/users'); return u ? <div className="card"><Table rows={u} cols={[['Name', r => r.name], ['Username', r => r.username], ['Role', r => r.role]]} /></div> : <Skel /> }
const Settings = () => <div className="card max-w-lg space-y-1 text-sm"><h3 className="font-bold mb-2">Company</h3><div>Sri Murugan Foods Pvt Ltd</div><div>GSTIN 33AABCS1234F1Z5 · Tamil Nadu</div><div className="text-slate2 pt-2">Weighted-average costing · Sequential invoices FF/2026-27/NNNN · Intra-state CGST+SGST, inter-state IGST</div></div>

/* ---------- Shell ---------- */
export default function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('ff_user') || 'null')); const [page, setPage] = useState(null); const [open, setOpen] = useState(true); const [mob, setMob] = useState(false); const [toastMsg, setToastMsg] = useState(null); const [bell, setBell] = useState(false); const [alerts, setAlerts] = useState([]); const [lf, setLf] = useState({ username: 'admin', password: 'admin123' }); const [err, setErr] = useState('')
  const toast = (m, bad) => { setToastMsg({ m, bad }); setTimeout(() => setToastMsg(null), 3000) }
  const nav = user ? NAV.filter(n => n[2].includes(user.role)) : []; const cur = page || nav[0]?.[0]
  useEffect(() => { if (user && user.role === 'admin') api('/alerts').then(setAlerts).catch(() => { }) }, [cur, user])
  const login = async () => { try { const r = await api('/login', 'POST', lf); setToken(r.token); localStorage.setItem('ff_user', JSON.stringify(r.user)); setUser(r.user) } catch (e) { setErr(e.message) } }
  const logout = () => { setToken(''); localStorage.removeItem('ff_user'); setUser(null); setPage(null) }
  if (!user || !getToken()) return <div className="min-h-screen bg-navy flex items-center justify-center p-4"><div className="bg-white rounded-3xl p-8 w-full max-w-sm space-y-4"><div className="flex items-center gap-2"><Logo s={44} /><div><div className="font-extrabold text-xl">FACTORYFLOW 360</div><div className="text-xs text-slate2">From Every Order to Every Audit — One Connected System.</div></div></div>
    <Field label="Username"><input className="inp" value={lf.username} onChange={e => setLf({ ...lf, username: e.target.value })} /></Field><Field label="Password"><input type="password" className="inp" value={lf.password} onChange={e => setLf({ ...lf, password: e.target.value })} onKeyDown={e => e.key === 'Enter' && login()} /></Field>
    {err && <div className="text-red2 text-sm">{err}</div>}<button className="btn w-full" onClick={login}>Sign in</button><div className="text-xs text-slate2">Demo: admin/admin123 · sales/sales123 · auditor/audit123</div></div></div>
  const P = { 'Command Center': <Command />, Orders: <Orders user={user} toast={toast} />, Customers: <Master path="/customers" title="customer" toast={toast} readonly={user.role !== 'admin'} fields={[['name', 'Name'], ['gstin', 'GSTIN'], ['state', 'State'], ['city', 'City'], ['phone', 'Phone']]} cols={[['Name', r => r.name], ['GSTIN', r => r.gstin], ['State', r => r.state], ['City', r => r.city], ['Phone', r => r.phone]]} />,
    Products: <Master path="/products" title="product" toast={toast} fields={[['name', 'Name'], ['hsn', 'HSN'], ['gst_rate', 'GST %'], ['price', 'Selling price'], ['expected_yield', 'Expected packets / batch']]} cols={[['Product', r => r.name], ['HSN', r => r.hsn], ['GST', r => r.gst_rate + '%'], ['Price', r => '₹' + r.price], ['Stock', r => r.stock + ' pkts'], ['Avg cost', r => '₹' + r.avg_cost]]} />,
    'Production Studio': <Production toast={toast} />, 'BOM Intelligence': <BOM />, Inventory: <Inventory toast={toast} user={user} />, Purchases: <Purchases toast={toast} />, CostVision: <CostVision />, 'GST AutoDesk': <GST />, Payments: <Payments toast={toast} />, 'Audit Vault': <Audit />, Reports: <Reports />, 'User Management': <Users_ />, Settings: <Settings /> }
  const Side = <div className="min-h-full bg-navy text-white flex flex-col p-3 gap-0.5"><div className="flex items-center gap-2 px-2 py-3"><Logo />{open && <span className="font-extrabold tracking-tight">FACTORYFLOW 360</span>}</div>
    {nav.map(([n, I]) => <button key={n} onClick={() => { setPage(n); setMob(false) }} className={'flex items-center gap-3 px-3 py-1.5 rounded-xl text-sm text-left transition shrink-0 ' + (cur === n ? 'bg-teal text-white font-semibold' : 'text-slate-300 hover:bg-white/10')}><I size={18} />{open && n}</button>)}</div>
  return <div className="flex h-[100dvh] overflow-hidden"><aside className={'hidden md:block shrink-0 transition-all overflow-y-auto bg-navy ' + (open ? 'w-60' : 'w-16')}>{Side}</aside>{mob && <div className="fixed inset-0 z-40 flex"><div className="w-64 overflow-y-auto bg-navy">{Side}</div><div className="flex-1 bg-black/40" onClick={() => setMob(false)} /></div>}
    <main className="flex-1 flex flex-col min-w-0 min-h-0"><header className="bg-white border-b px-4 py-3 flex items-center gap-3"><button onClick={() => (window.innerWidth < 768 ? setMob(true) : setOpen(!open))}><Menu /></button><div className="text-sm text-slate2 hidden sm:block">FactoryFlow / <b className="text-navy">{cur}</b></div>
      <div className="flex-1 max-w-sm mx-auto relative"><Search size={14} className="absolute left-3 top-3 text-slate2" /><input className="inp !pl-8" placeholder="Search pages" onChange={e => { const m = nav.find(n => n[0].toLowerCase().includes(e.target.value.toLowerCase())); if (e.target.value && m) setPage(m[0]) }} /></div>
      {user.role === 'admin' && <div className="relative"><button onClick={() => setBell(!bell)} className="relative"><Bell />{alerts.length > 0 && <span className="absolute -top-1 -right-1 bg-red2 text-white text-[10px] rounded-full px-1">{alerts.length}</span>}</button>{bell && <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto bg-white border rounded-2xl shadow-lg p-3 z-30 space-y-2">{alerts.map((a, i) => <div key={i} className="text-xs"><Badge s={a.sev} /> <b>{a.type}</b><div className="text-slate2">{a.msg}</div></div>)}{!alerts.length && <Empty t="No alerts" />}</div>}</div>}
      <div className="text-sm text-right hidden sm:block"><div className="font-semibold">{user.name}</div><div className="text-xs text-slate2">{user.role}</div></div><button onClick={() => confirm('Sign out of FactoryFlow 360?') && logout()}><LogOut size={18} /></button></header>
      <div className="flex-1 overflow-auto p-4 md:p-6">{P[cur]}</div></main>
    {toastMsg && <div className={'fixed bottom-5 right-5 px-4 py-3 rounded-xl text-white text-sm shadow-lg ' + (toastMsg.bad ? 'bg-red2' : 'bg-navy')}>{toastMsg.m}</div>}</div>
}
