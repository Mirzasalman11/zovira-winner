"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SAMPLE } from "@/lib/sample";
import { buildPeople, fmt, mask, parseFile, rnd, type Order } from "@/lib/draw";

type Phase = "idle" | "shake" | "open";
type Particle = { x: number; y: number; vx: number; vy: number; w: number; h: number; r: number; vr: number; c: string; l: number };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Home() {
  const [orders, setOrders] = useState<Order[]>(() => SAMPLE.map((r) => ({ name: r[0], phone: r[1], total: r[2] })));
  const [step, setStep] = useState(1000);
  const [fileName, setFileName] = useState("Sample data");
  const [fileMeta, setFileMeta] = useState("Using built-in sample");
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [winners, setWinners] = useState<string[]>([]);
  const [status, setStatus] = useState("Click the button to open the gift.");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const arenaRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  const people = useMemo(() => buildPeople(orders, Math.max(1, step || 1000)), [orders, step]);
  const totalTok = useMemo(() => people.reduce((a, p) => a + p.tokens, 0), [people]);
  const totalValue = useMemo(() => orders.reduce((a, o) => a + o.total, 0), [orders]);

  const burst = useCallback(() => {
    const cv = cvRef.current, ar = arenaRef.current;
    if (!cv || !ar) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    const cx = cv.getContext("2d")!;
    const r = ar.getBoundingClientRect();
    const ox = (r.left + r.width / 2) * dpr, oy = (r.bottom - 170) * dpr;
    const cols = ["#16a34a", "#34d27b", "#f5b942", "#fde68a", "#ffffff", "#14532d"];
    let ps: Particle[] = Array.from({ length: 160 }, (_, i) => {
      const a = Math.random() * Math.PI * 2, s = (6 + Math.random() * 12) * dpr;
      return { x: ox, y: oy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 8 * dpr, w: (5 + Math.random() * 7) * dpr, h: (3 + Math.random() * 5) * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: cols[i % cols.length], l: 1 };
    });
    cancelAnimationFrame(rafRef.current);
    const tick = () => {
      cx.clearRect(0, 0, cv.width, cv.height);
      ps = ps.filter((p) => p.l > 0);
      for (const p of ps) {
        p.vy += 0.35 * dpr; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.l -= 0.008;
        cx.save(); cx.globalAlpha = Math.max(p.l, 0); cx.translate(p.x, p.y); cx.rotate(p.r);
        cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore();
      }
      if (ps.length) rafRef.current = requestAnimationFrame(tick); else cx.clearRect(0, 0, cv.width, cv.height);
    };
    tick();
  }, []);

  const load = useCallback(async (f: File) => {
    try {
      const res = await parseFile(f);
      setOrders(res.orders); setWinner(null); setWinners([]); setPhase("idle");
      setStatus("Click the button to open the gift.");
      setFileName(f.name); setFileMeta(res.cols);
      setMsg({ t: `${res.orders.length} orders loaded${res.skipped ? ` (${res.skipped} cancelled/failed skipped)` : ""}.`, ok: true });
    } catch (e) {
      setMsg({ t: e instanceof Error ? e.message : "Could not read this file.", ok: false });
    }
  }, []);

  useEffect(() => {
    const over = (e: DragEvent) => { e.preventDefault(); setDragging(true); };
    const leave = (e: DragEvent) => { e.preventDefault(); if (!e.relatedTarget) setDragging(false); };
    const drop = (e: DragEvent) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer?.files[0]; if (f) load(f); };
    addEventListener("dragover", over); addEventListener("dragleave", leave); addEventListener("drop", drop);
    return () => { removeEventListener("dragover", over); removeEventListener("dragleave", leave); removeEventListener("drop", drop); };
  }, [load]);

  async function announce() {
    if (busy || !totalTok) return;
    setBusy(true);
    if (phase === "open") { setPhase("idle"); setStatus("Wrapping a new gift…"); await wait(900); }
    const pool: number[] = [];
    people.forEach((p, i) => { for (let k = 0; k < p.tokens; k++) pool.push(i); });
    const wi = pool[rnd(pool.length)], p = people[wi];
    setWinner(wi); setStatus("Shaking the gift…"); setPhase("shake");
    await wait(1550);
    setPhase("open"); await wait(550); burst(); await wait(500); burst();
    setStatus(`${p.name} · ${mask(p.phone)} · ${p.tokens} of ${totalTok} tokens (${((p.tokens / totalTok) * 100).toFixed(1)}% chance)`);
    setWinners((w) => [...w, p.name]);
    setBusy(false);
    document.getElementById("r" + wi)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  const w = winner !== null ? people[winner] : null;

  return (
    <>
      <canvas id="cf" ref={cvRef} />
      <div className="wrap">
        <nav><div className="brand"><div className="logo">Z</div>Zovira <small>Winner Draw</small></div></nav>

        <input ref={fileRef} type="file" accept=".csv,.tsv,.xlsx,.xls,.xlsm" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ""; }} />
        <div className={"drop" + (dragging ? " on" : "")} onClick={() => fileRef.current?.click()}>
          <div className="ic">⬆</div>
          <div><b>Drag &amp; drop your orders file</b><span>CSV or Excel · columns are detected automatically · or click to browse</span></div>
          <div className="r"><b style={{ fontSize: 14, color: "var(--ink)" }}>{fileName}</b><span>{fileMeta}</span></div>
        </div>
        <div id="msg" className={msg ? (msg.ok ? "o" : "e") : ""}>{msg?.t}</div>

        <div className="kpis">
          <div className="card k"><span>Orders</span><b>{orders.length}</b></div>
          <div className="card k"><span>Customers</span><b>{people.length}</b></div>
          <div className="card k"><span>Total tokens</span><b>{totalTok}</b></div>
          <div className="card k"><span>Total value</span><b>{fmt(totalValue)}</b></div>
        </div>

        <div className="card stage">
          <div className="title">Ready to pick a winner?</div>
          <div className="sub">Every customer’s chance is proportional to their tokens.</div>
          <div className="rule">1 token per
            <input type="number" min={1} value={step} onChange={(e) => setStep(parseFloat(e.target.value) || 0)} />
            of each order total
          </div>
          <div className={"arena" + (phase === "open" ? " open" : "")} ref={arenaRef}>
            <div className="glow" /><div className="floor" />
            <div className="card-w"><div className="wc"><small>Winner</small><strong>{w ? w.name : "—"}</strong></div></div>
            <div className={"gift " + (phase === "shake" ? "shake" : phase === "idle" ? "idle" : "")}>
              <div className="gbox" />
              <div className="lidwrap"><div className="lid"><div className="bow"><i /><i /><u /></div></div></div>
            </div>
          </div>
          <div className="res">{status}</div>
          <button className="btn p" disabled={busy || !totalTok} onClick={announce}>{winners.length ? "Draw Again" : "Announce Winner"}</button>
          {winners.length > 0 && <div className="hist">Previous draws: {winners.join("  →  ")}</div>}
        </div>

        <div className="sec"><h2>Participants</h2><span>{people.length} eligible</span></div>
        <div className="card box">
          <table>
            <thead><tr><th>Customer</th><th>Phone</th><th className="n">Orders</th><th className="n">Total value</th><th className="n">Tokens</th><th className="n">Win chance</th></tr></thead>
            <tbody>
              {people.map((p, i) => {
                const c = totalTok ? (p.tokens / totalTok) * 100 : 0;
                return (
                  <tr key={p.name + p.phone} id={"r" + i} className={winner === i && phase === "open" ? "w" : ""}>
                    <td><span className="av">{p.name.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase()}</span>{p.name}</td>
                    <td>{mask(p.phone)}</td>
                    <td className="n">{p.orders}</td>
                    <td className="n">{fmt(p.value)}</td>
                    <td className="n"><span className="pill">{p.tokens}</span></td>
                    <td className="n">{c.toFixed(1)}%<div className="bar"><i style={{ width: Math.min(100, c * 6) + "%" }} /></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <footer>Runs entirely in your browser — your file is never uploaded.</footer>
      </div>
    </>
  );
}
