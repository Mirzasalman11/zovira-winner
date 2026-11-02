import * as XLSX from "xlsx";

export type Order = { name: string; phone: string; total: number };
export type Person = { name: string; phone: string; orders: number; value: number; tokens: number };

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function mask(p: string) {
  const d = String(p).replace(/\D/g, "").slice(-10);
  return d.length < 7 ? d || "—" : "0" + d.slice(0, 3) + "XXXX" + d.slice(-3);
}

/** Customer ID = name + phone. Tokens = floor(order total / step), summed per customer. */
export function buildPeople(orders: Order[], step: number): Person[] {
  const m = new Map<string, Person>();
  for (const o of orders) {
    const ph = String(o.phone || "").replace(/\D/g, "").slice(-10);
    const key = o.name.trim().toLowerCase() + "|" + ph;
    let p = m.get(key);
    if (!p) m.set(key, (p = { name: o.name.trim(), phone: ph, orders: 0, value: 0, tokens: 0 }));
    p.orders++;
    p.value += o.total;
    p.tokens += Math.floor(o.total / step);
  }
  return [...m.values()]
    .filter((p) => p.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens || b.value - a.value);
}

/** Unbiased random integer in [0, n) using the Web Crypto API. */
export function rnd(n: number) {
  const a = new Uint32Array(1);
  const lim = Math.floor(4294967296 / n) * n;
  do crypto.getRandomValues(a);
  while (a[0] >= lim);
  return a[0] % n;
}

const norm = (s: unknown) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const pick = (h: string[], pats: string[]) => {
  for (const p of pats) {
    const i = h.findIndex((x) => norm(x).includes(p));
    if (i >= 0) return i;
  }
  return -1;
};

export async function parseFile(f: File) {
  const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  const hi = rows.findIndex((r) => r.some((c) => /name/i.test(String(c))) && r.filter((c) => c !== "").length >= 2);
  if (hi < 0) throw new Error("Could not find a header row with a customer name column.");
  const h = rows[hi].map(String);
  const ci = pick(h, ["customername", "clientname", "name", "customer"]);
  const pi = pick(h, ["phone", "mobile", "contact", "cell", "whatsapp"]);
  const ti = pick(h, ["totalpkr", "grandtotal", "ordertotal", "total", "amount", "subtotal", "price", "value", "revenue"]);
  const si = pick(h, ["status"]);
  if (ci < 0) throw new Error("No customer name column found.");
  if (ti < 0) throw new Error("No order total / amount column found.");
  let skipped = 0;
  const orders: Order[] = [];
  for (const r of rows.slice(hi + 1)) {
    const name = String(r[ci]).trim();
    const v = parseFloat(String(r[ti]).replace(/[^0-9.\-]/g, ""));
    if (!name || isNaN(v)) continue;
    if (si >= 0 && /cancel|fail|return|refund/i.test(String(r[si]))) { skipped++; continue; }
    orders.push({ name, phone: pi >= 0 ? String(r[pi]) : "", total: v });
  }
  if (!orders.length) throw new Error("No valid rows found.");
  return { orders, skipped, cols: `name: ${h[ci]} · phone: ${pi >= 0 ? h[pi] : "—"} · amount: ${h[ti]}` };
}
