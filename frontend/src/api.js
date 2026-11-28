let token = localStorage.getItem('ff_token') || ''
export const setToken = t => { token = t; t ? localStorage.setItem('ff_token', t) : localStorage.removeItem('ff_token') }
export const getToken = () => token
export async function api(path, method = 'GET', body) {
  const r = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined })
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Request failed'); return j
}
export async function download(path, name) {
  const r = await fetch('/api' + path, { headers: { Authorization: 'Bearer ' + token } }); const b = await r.blob()
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click()
}
export const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
