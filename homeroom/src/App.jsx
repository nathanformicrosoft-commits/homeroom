import { supabase } from "./supabaseClient";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Plus, Check, X, ChevronLeft, ChevronRight, ArrowUp, Upload, Sparkles, Trash2,
  BookOpen, ListChecks, MessageCircle, Pencil, ChevronDown, CalendarDays,
  List as ListIcon, Gamepad2, Shield, Copy, Search, Music,
} from "lucide-react";

/* ───────────────────────── tokens (CSS variables, so dark mode just works) ───────────────────────── */

const C = {
  bg: "var(--bg)", paper: "var(--paper)", ink: "var(--ink)", muted: "var(--muted)",
  faint: "var(--faint)", line: "var(--line)", wash: "var(--wash)", accent: "var(--accent)",
  accentInk: "#FFFFFF", danger: "var(--danger)", ok: "var(--ok)", okbg: "var(--okbg)",
  errbg: "var(--errbg)", body: "var(--body)",
};

const SERIF = `"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif`;
const SANS = `-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif`;

const SUBJ = {
  Mathematics: "#5A7FA8",
  "Values Education": "#B38A2E",
  "Araling Panlipunan": "#8A877A",
  Filipino: "#5F8B6D",
};

const PAL = ["#C4684A", "#8B6B86", "#4F8A8B", "#9A7B4F", "#6E7FA3"];
const subjColor = (s) =>
  SUBJ[s] || PAL[[...(s || "x")].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length];

// The account with this username is the admin. Change it to something only you know,
// then create that account yourself before you share the app with anyone.
const ADMIN_USERNAME = "hr_owner";

const TYPES = ["Homework", "Mini Task", "Quiz", "Study", "Project", "Exam"];
const REVIEW_TYPES = ["Quiz", "Study", "Exam"];
const PRIORITIES = ["High", "Medium", "Low"];
const STATUSES = [["todo", "Not started"], ["progress", "In progress"], ["done", "Done"]];
const DEFAULT_SUBJECTS = Object.keys(SUBJ);
const API = "https://api.anthropic.com/v1/messages";

/* ───────────────────────── dates ───────────────────────── */

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());
const parse = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (iso, n) => { const d = parse(iso); d.setDate(d.getDate() + n); return toISO(d); };
const diffDays = (iso) => Math.round((parse(iso) - parse(todayISO())) / 864e5);
const fmtDate = (iso) => parse(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const todayLong = () => parse(todayISO()).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const relLabel = (iso) => {
  const n = diffDays(iso);
  if (n === -1) return "Yesterday";
  if (n < -1) return `${-n} days ago`;
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n < 7) return parse(iso).toLocaleDateString(undefined, { weekday: "long" });
  return fmtDate(iso);
};
const fmtShort = (iso) => parse(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const weekStartOf = (iso) => { const d = parse(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return toISO(d); }; // weeks start Monday
const weekLabel = (ws) => `${fmtShort(ws)} to ${fmtShort(addDays(ws, 6))}`;

function weekData(ws, tasks, materials) {
  const we = addDays(ws, 6);
  const ts = tasks.filter((t) => t.deadline >= ws && t.deadline <= we);
  const ids = new Set(ts.map((t) => t.id));
  const from = parse(ws).getTime(), to = parse(addDays(ws, 7)).getTime();
  const ms = materials.filter((m) => ids.has(m.taskId) || (m.at >= from && m.at < to));
  return { ts, ms };
}

const timeAgo = (ts) => {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Yesterday" : `${d} days ago`;
};

const summarize = (list) =>
  list.slice(0, 3).map((t) => t.title).join(", ") + (list.length > 3 ? `and ${list.length - 3} more` : "");

/* ───────────────────────── storage ───────────────────────── */

const LS = "hr:";
const store = {
  async get(key, shared = false) {
    if (!shared) {
      try { const v = localStorage.getItem(LS + key); return v ? JSON.parse(v) : null; } catch { return null; }
    }
    try {
      const { data, error } = await supabase.from("kv").select("value").eq("key", key).maybeSingle();
      if (error) { console.error("kv get failed", error); return null; }
      return data ? data.value : null;
    } catch { return null; }
  },
  async set(key, val, shared = false) {
    if (!shared) {
      try { localStorage.setItem(LS + key, JSON.stringify(val)); return true; } catch { return false; }
    }
    try {
      const { error } = await supabase
        .from("kv")
        .upsert({ key, value: val, updated_at: new Date().toISOString() });
      if (error) { console.error("kv set failed", error); return false; }
      return true;
    } catch (e) { console.error("kv set failed", e); return false; }
  },
  async del(key, shared = false) {
    if (!shared) { try { localStorage.removeItem(LS + key); } catch {} return; }
    try { await supabase.from("kv").delete().eq("key", key); } catch {}
  },
  async listShared(prefix) {
    try {
      const { data, error } = await supabase.from("kv").select("key,value").like("key", `${prefix}%`);
      if (error) return [];
      return data || [];
    } catch { return []; }
  },
};

const sha = async (s) => {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
};
const randHex = () => [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, "0")).join("");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

/* ───────────────────────── sound: effects and a little generative lo-fi, all synthesized ───────────────────────── */

const Sound = (() => {
  let ctx = null, master = null, musicBus = null, noise = null;
  let sfxOn = true, musicOn = false, vol = 0.5, timer = null, step = 0, nextTime = 0;
  const EIGHTH = 60 / 72 / 2;
  const CHORDS = [[130.81, 164.81, 196.0, 246.94], [110.0, 130.81, 164.81, 196.0], [146.83, 174.61, 220.0, 261.63], [98.0, 123.47, 146.83, 174.61]];
  const ROOTS = [65.41, 55.0, 73.42, 49.0];
  const PENT = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
      musicBus.connect(lp); lp.connect(master);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };

  const tone = (f, t, dur, o = {}) => {
    const { type = "sine", vol: v = 0.1, attack = 0.012, dest = master, lp } = o;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    let out = g;
    if (lp) { const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = lp; g.connect(fl); out = fl; }
    out.connect(dest);
    osc.start(t); osc.stop(t + dur + 0.05);
  };

  const hit = (t, dur, v, hp) => {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(musicBus); s.start(t); s.stop(t + dur + 0.02);
  };

  const kick = (t) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.25);
  };

  const schedule = () => {
    while (nextTime < ctx.currentTime + 1.2) {
      const bar = Math.floor(step / 8) % 4, s = step % 8;
      const t = nextTime + (s % 2 === 1 ? 0.035 : 0);
      if (s === 0) CHORDS[bar].forEach((f) => tone(f, t, EIGHTH * 8 + 0.4, { vol: 0.03, attack: 0.5, dest: musicBus, lp: 900 }));
      if (s === 0 || s === 4) tone(ROOTS[bar], t, EIGHTH * 3, { vol: 0.1, attack: 0.02, dest: musicBus });
      if (s === 0 || s === 5) kick(t);
      if (s === 2 || s === 6) hit(t, 0.12, 0.05, 1800);
      if (s % 2 === 1) hit(t, 0.04, 0.018, 7000);
      if (Math.random() < 0.38) tone(PENT[Math.floor(Math.random() * PENT.length)], t, 0.9, { type: "triangle", vol: 0.045, dest: musicBus, lp: 2000 });
      nextTime += EIGHTH; step++;
    }
  };

  const SFX = {
    tap: (t) => tone(760, t, 0.05, { type: "triangle", vol: 0.035 }),
    done: (t) => { tone(523.25, t, 0.28, { vol: 0.09 }); tone(659.25, t + 0.08, 0.28, { vol: 0.09 }); tone(783.99, t + 0.16, 0.45, { vol: 0.1 }); },
    undo: (t) => tone(392, t, 0.18, { type: "triangle", vol: 0.07 }),
    add: (t) => { tone(587.33, t, 0.2, { vol: 0.08 }); tone(880, t + 0.08, 0.35, { vol: 0.08 }); },
    send: (t) => tone(698.46, t, 0.12, { type: "triangle", vol: 0.06 }),
    pop: (t) => tone(987.77, t, 0.18, { vol: 0.05 }),
    err: (t) => { tone(233, t, 0.16, { type: "triangle", vol: 0.08 }); tone(185, t + 0.12, 0.25, { type: "triangle", vol: 0.08 }); },
    bell: (t) => { tone(1318.5, t, 1.1, { vol: 0.08 }); tone(1975.5, t, 0.7, { vol: 0.03 }); tone(2637, t, 0.4, { vol: 0.015 }); },
  };

  return {
    play(name) { if (!sfxOn || !ensure()) return; try { SFX[name] && SFX[name](ctx.currentTime + 0.001); } catch {} },
    setSfx(v) { sfxOn = v; },
    setVolume(v) { vol = v; if (ctx && musicBus) musicBus.gain.setTargetAtTime(musicOn ? vol * 0.9 : 0, ctx.currentTime, 0.1); },
    startMusic() {
      if (!ensure() || musicOn) return;
      musicOn = true; step = 0; nextTime = ctx.currentTime + 0.1;
      schedule(); timer = setInterval(schedule, 250);
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setTargetAtTime(vol * 0.9, ctx.currentTime, 0.6);
    },
    stopMusic() {
      if (!ctx || !musicOn) return;
      musicOn = false; musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      const tm = timer; timer = null; setTimeout(() => clearInterval(tm), 900);
    },
    isMusic: () => musicOn,
    pause() { if (ctx && musicOn && ctx.state === "running") ctx.suspend(); },
    resume() { if (ctx && musicOn && ctx.state === "suspended") ctx.resume(); },
  };
})();

/* ───────────────────────── files ───────────────────────── */

const readAsDataURL = (file) =>
  new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

async function imageToJpegBase64(file) {
  const url = await readAsDataURL(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85).split(",")[1];
}

async function extractFromFile(file) {
  const system = "You turn study material into clean study notes. Plain text only, no markdown symbols, no emojis. Keep headings and lists as plain lines. Describe diagrams or tables briefly in words. Keep the result under 650 words, condensing if the source is long, and keep every important fact, term, formula and date.";
  let block;
  if (file.type === "application/pdf" || /.pdf$/i.test(file.name)) {
    const data = (await readAsDataURL(file)).split(",")[1];
    block = { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  } else {
    block = { type: "image", source: { type: "base64", media_type: "image/jpeg", data: await imageToJpegBase64(file) } };
  }
  return callClaude(system, [{ role: "user", content: [block, { type: "text", text: "Turn this into study notes." }] }]);
}

/* ───────────────────────── AI ───────────────────────── */

async function callClaude(system, messages) {
  const res = await fetch(API, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system, messages }),
  });
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

// Streams text as it is written. Falls back to a normal request if streaming isn't available.
async function streamClaude(system, messages, onText) {
  try {
    const res = await fetch(API, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system, messages, stream: true }),
    });
    if (!res.ok || !res.body) throw new Error("no stream");
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", full = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const d = line.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try {
          const ev = JSON.parse(d);
          if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") { full += ev.delta.text; onText(full); }
        } catch {}
      }
    }
    if (!full) throw new Error("empty");
    return full;
  } catch {
    const full = await callClaude(system, messages);
    onText(full);
    return full;
  }
}

function parseJSON(t) {
  const s = (t || "").replace(/```json|```/g, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b < 0) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

const statusLabel = (s) => (STATUSES.find((x) => x[0] === (s || "todo")) || STATUSES[0])[1];

function buildContext(tasks, materials, progress, user) {
  const list = tasks
    .map((t) => `[${t.id}] ${t.title} | subject: ${t.subject} | type: ${t.type} | priority: ${t.priority} | due ${t.deadline} (${parse(t.deadline).toLocaleDateString("en-US", { weekday: "long" })}) | ${user}'s status: ${statusLabel(progress[t.id])} | notes: ${t.notes || "none"} | added by ${t.addedBy}`)
    .join("\n");
  const mats = materials
    .map((m) => `--- Review material "${m.title}" for [${m.taskId}], by ${m.by}\n${m.text.slice(0, 2500)}`)
    .join("\n").slice(0, 12000);
  return { today: todayLong(), list: list || "(no tasks yet)", mats: mats || "(no review material yet)" };
}

/* ───────────────────────── styles ───────────────────────── */

const CSS = `
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
.hr{--bg:#FAF9F5;--paper:#FFFFFF;--ink:#1F1E1D;--muted:#73716A;--faint:#A9A69B;--line:#E7E4D9;--wash:#F2EFE6;--accent:#C4694A;--danger:#B4432F;--ok:#5F8B6D;--okbg:#F1F6F2;--errbg:#FBF1EE;--body:#3D3C39;color-scheme:light}
.hr[data-theme="dark"]{--bg:#1B1A18;--paper:#252421;--ink:#F1EFE8;--muted:#A9A69B;--faint:#7A776E;--line:#35332F;--wash:#2C2A27;--accent:#D98262;--danger:#E58A74;--ok:#7FAE8C;--okbg:#1F2B23;--errbg:#33211D;--body:#D8D5CC;color-scheme:dark}
.hr{font-family:${SANS};color:${C.ink};background:${C.bg};height:100vh;height:100dvh;display:flex;flex-direction:column;max-width:640px;margin:0 auto;position:relative;font-size:15px;line-height:1.45;overflow:hidden}
.hr button{font-family:inherit;color:inherit;cursor:pointer}
.hr input,.hr textarea{font-family:inherit;font-size:16px;color:${C.ink}}
.hr ::placeholder{color:${C.faint}}
.hr :focus-visible{outline:2px solid ${C.accent};outline-offset:2px}
.serif{font-family:${SERIF};letter-spacing:-.01em}
.scroll{flex:1;overflow-y:auto;overflow-x:hidden;padding:0 20px 120px;overscroll-behavior-y:contain}
.head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 10px}
.mark{font-family:${SERIF};font-size:22px;letter-spacing:-.02em}
.avatar{width:34px;height:34px;border-radius:50%;border:1px solid ${C.line};background:${C.paper};font-family:${SERIF};font-size:15px;display:grid;place-items:center}
.hdrRight{display:flex;gap:8px;align-items:center}
.hdrBtn{display:inline-flex;align-items:center;justify-content:center;gap:6px;width:34px;height:34px;border:1px solid ${C.line};background:none;border-radius:50%;color:${C.muted};padding:0;transition:background .12s}
.hdrBtn:active{background:${C.wash}}
.hdrBtn span{display:none;font-size:13.5px}
@media (min-width:440px){.hdrBtn.wide{width:auto;padding:0 12px;border-radius:999px}.hdrBtn.wide span{display:inline}}
.tabs{position:absolute;left:0;right:0;bottom:0;display:flex;background:${C.bg};border-top:1px solid ${C.line};padding:6px 12px calc(8px + env(safe-area-inset-bottom));z-index:4}
.tab{position:relative;flex:1;background:none;border:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 0;font-size:12px;color:${C.faint}}
.tab[aria-current="page"]{color:${C.ink}}
.tab[aria-current="page"] svg{color:${C.accent}}
.badge{position:absolute;top:0;left:calc(50% + 4px);min-width:17px;height:17px;border-radius:9px;background:${C.accent};color:#fff;font-size:11px;display:grid;place-items:center;padding:0 5px}
.fab{position:absolute;right:20px;bottom:84px;width:52px;height:52px;border-radius:50%;border:0;background:${C.ink};color:${C.bg};display:grid;place-items:center;box-shadow:0 6px 18px rgba(0,0,0,.22);z-index:3;transition:transform .12s}
.fab:active{transform:scale(.94)}
.h1{font-family:${SERIF};font-size:30px;line-height:1.15;letter-spacing:-.02em;margin:10px 0 6px;font-weight:400}
.sub{color:${C.muted};margin:0 0 18px}
.stats{display:flex;gap:28px;padding:14px 0 18px;border-bottom:1px solid ${C.line};margin-bottom:14px}
.stat b{display:block;font-family:${SERIF};font-weight:400;font-size:28px;line-height:1}
.stat span{font-size:13px;color:${C.muted}}
.seg{display:inline-flex;background:${C.wash};border-radius:10px;padding:3px;gap:2px;flex-wrap:wrap}
.seg button{border:0;background:none;padding:6px 12px;border-radius:8px;font-size:14px;color:${C.muted}}
.seg button[aria-pressed="true"]{background:${C.paper};color:${C.ink};box-shadow:0 1px 2px rgba(0,0,0,.1)}
.chips{display:flex;gap:8px;overflow-x:auto;padding:12px 0 6px;scrollbar-width:none}
.chips::-webkit-scrollbar{display:none}
.chip{flex:none;border:1px solid ${C.line};background:none;border-radius:999px;padding:6px 13px;font-size:14px;color:${C.muted};display:inline-flex;align-items:center;gap:7px;transition:background .12s}
.chip:active{background:${C.wash}}
.chip[aria-pressed="true"]{border-color:${C.ink};color:${C.ink};background:${C.paper}}
.group{margin-top:22px}
.group h3{font-family:${SERIF};font-weight:400;font-size:17px;margin:0 0 2px;display:flex;align-items:baseline;gap:8px}
.group h3 small{font-family:${SANS};font-size:13px;color:${C.faint}}
.swipe{position:relative;touch-action:pan-y;overflow:hidden}
.under{position:absolute;inset:0;display:flex;justify-content:space-between;align-items:center;padding:0 18px;background:${C.wash};color:${C.muted};font-size:14px}
.under span{display:inline-flex;align-items:center;gap:6px;transition:opacity .1s}
.row{display:flex;gap:14px;align-items:flex-start;padding:14px 0;border-bottom:1px solid ${C.line};cursor:pointer;width:100%;background:${C.bg};border-left:0;border-right:0;border-top:0;text-align:left;position:relative}
.row:active{background:${C.wash}}
.check{flex:none;width:22px;height:22px;border-radius:50%;border:1.5px solid ${C.faint};background:none;display:grid;place-items:center;margin-top:1px;padding:0;color:${C.accentInk};transition:background .15s,border-color .15s}
.check[data-s="done"]{background:${C.accent};border-color:${C.accent}}
.check[data-s="progress"]{border-color:${C.accent};background:linear-gradient(90deg,${C.accent} 50%,transparent 50%)}
.rowMain{flex:1;min-width:0}
.rowTitle{font-weight:500;overflow:hidden;text-overflow:ellipsis}
.rowTitle[data-done="1"]{color:${C.faint};text-decoration:line-through}
.rowMeta{display:flex;flex-wrap:wrap;gap:3px 12px;font-size:13px;color:${C.muted};margin-top:3px;align-items:center}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px}
.rowRight{text-align:right;flex:none;font-size:13px}
.late{color:${C.danger}}
.pri{color:${C.faint};margin-top:2px}
.pri[data-p="High"]{color:${C.accent}}
.empty{padding:48px 8px;text-align:center;color:${C.muted}}
.empty .serif{font-size:20px;color:${C.ink};margin-bottom:6px}
.btn{border:0;border-radius:12px;padding:12px 18px;font-size:15px;font-weight:500;background:${C.ink};color:${C.bg};transition:transform .1s,opacity .15s}
.btn:active{transform:scale(.98)}
.btn.accent{background:${C.accent};color:${C.accentInk}}
.btn.ghost{background:none;border:1px solid ${C.line};color:${C.ink}}
.btn:disabled{opacity:.45;cursor:default}
.btn.full{width:100%}
.small{padding:8px 13px;font-size:14px;border-radius:10px}
.field{margin-bottom:18px}
.field label{display:block;font-size:13px;color:${C.muted};margin-bottom:6px}
.input{width:100%;border:1px solid ${C.line};background:${C.paper};border-radius:12px;padding:12px 14px}
.input:focus{outline:2px solid ${C.accent};outline-offset:-1px;border-color:transparent}
textarea.input{resize:vertical;min-height:84px;line-height:1.45}
.overlay{position:fixed;inset:0;z-index:50;display:flex;align-items:flex-end;justify-content:center}
.scrim{position:absolute;inset:0;background:rgba(10,10,9,.4);animation:fade .18s ease-out}
.sheet{position:relative;width:100%;max-width:640px;max-height:92%;overflow-y:auto;background:${C.bg};border-radius:20px 20px 0 0;padding:20px 20px 32px;animation:rise .22s ease-out}
.sheetHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.iconBtn{background:none;border:0;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:${C.muted}}
.iconBtn:active{background:${C.wash}}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes rise{from{transform:translateY(24px);opacity:.4}to{transform:none;opacity:1}}
@keyframes rot{to{transform:rotate(360deg)}}
@keyframes draw{0%{stroke-dashoffset:1;opacity:1}55%{stroke-dashoffset:0;opacity:1}85%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}
@keyframes shim{from{background-position:200% 0}to{background-position:-200% 0}}
@keyframes sweep{from{background-position:-40% 0}to{background-position:140% 0}}
@keyframes blink{0%,80%,100%{opacity:.25}40%{opacity:1}}
@keyframes lift{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.back{background:none;border:0;display:inline-flex;align-items:center;gap:2px;color:${C.muted};padding:8px 0;font-size:14px}
.sectionTitle{font-family:${SERIF};font-size:19px;font-weight:400;margin:26px 0 8px}
.mat{border-bottom:1px solid ${C.line}}
.matHead{width:100%;display:flex;justify-content:space-between;gap:10px;align-items:center;background:none;border:0;padding:13px 0;text-align:left}
.matBody{white-space:pre-wrap;color:${C.body};padding:0 0 16px;font-size:14.5px;line-height:1.55}
.tag{font-size:12px;color:${C.muted};border:1px solid ${C.line};border-radius:6px;padding:1px 7px;margin-left:8px;font-weight:400}
.chat{display:flex;flex-direction:column;height:100%;min-height:0}
.msgs{flex:1;overflow-y:auto;padding:4px 20px 12px}
.msg{margin:14px 0;max-width:88%;white-space:pre-wrap;line-height:1.5}
.msg.me{margin-left:auto;background:${C.wash};padding:10px 14px;border-radius:16px 16px 4px 16px}
.msg.ai{font-family:${SERIF};font-size:16.5px;line-height:1.55}
.added{margin-top:10px;border-left:2px solid ${C.accent};padding:2px 0 2px 12px;font-family:${SANS};font-size:14px;color:${C.muted}}
.added b{display:block;color:${C.ink};font-weight:500}
.composer{display:flex;gap:8px;align-items:flex-end;padding:10px 16px 12px;border-top:1px solid ${C.line};background:${C.bg}}
.composer textarea{flex:1;border:1px solid ${C.line};background:${C.paper};border-radius:20px;padding:10px 16px;resize:none;max-height:120px;line-height:1.4}
.send{width:40px;height:40px;border-radius:50%;border:0;background:${C.accent};color:#fff;display:grid;place-items:center;flex:none;transition:transform .1s}
.send:active{transform:scale(.92)}
.send:disabled{background:${C.line};color:${C.faint}}
.suggest{display:flex;flex-direction:column;align-items:flex-start;gap:8px;margin-top:18px}
.suggest button{border:1px solid ${C.line};background:none;border-radius:14px;padding:9px 14px;font-size:14.5px;text-align:left;color:${C.ink}}
.suggest button:active{background:${C.wash}}
.opt{width:100%;text-align:left;border:1px solid ${C.line};background:${C.paper};border-radius:12px;padding:13px 15px;margin-bottom:10px;font-size:15px;display:flex;gap:12px}
.opt[data-s="right"]{border-color:${C.ok};background:${C.okbg}}
.opt[data-s="wrong"]{border-color:${C.danger};background:${C.errbg}}
.opt:disabled{cursor:default}
.err{color:${C.danger};font-size:14px;margin:0 0 14px}
.bar{height:3px;background:${C.line};border-radius:2px;overflow:hidden;margin:6px 0 22px}
.bar i{display:block;height:100%;background:${C.accent};transition:width .25s}
.note{border-left:2px solid ${C.accent};padding:2px 0 2px 14px;margin:0 0 18px;display:flex;justify-content:space-between;gap:8px}
.note p{margin:0 0 6px;color:${C.muted};font-size:14.5px;line-height:1.5}
.note p span{color:${C.ink};font-weight:500}
.ann{background:${C.wash};border-radius:14px;padding:14px 8px 14px 16px;margin-bottom:14px;display:flex;justify-content:space-between;gap:8px;animation:lift .25s ease-out}
.ann small{display:block;font-size:12.5px;color:${C.muted};margin-bottom:4px}
.ann p{margin:0;font-family:${SERIF};font-size:16.5px;line-height:1.5;white-space:pre-wrap}
.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-top:10px}
.calHead{font-size:12px;color:${C.faint};text-align:center;padding:6px 0}
.day{border:0;background:none;border-radius:12px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 0 8px;font-size:14px;min-height:54px}
.day[data-sel="1"]{background:${C.wash}}
.day .num{width:27px;height:27px;border-radius:50%;display:grid;place-items:center}
.day[data-today="1"] .num{background:${C.accent};color:#fff}
.pips{display:flex;gap:3px;height:6px}
.pips i{width:6px;height:6px;border-radius:50%;display:block}
.ico{display:inline-flex;background:${C.wash};border-radius:10px;padding:3px}
.ico button{border:0;background:none;width:34px;height:30px;border-radius:8px;display:grid;place-items:center;color:${C.muted}}
.ico button[aria-pressed="true"]{background:${C.paper};color:${C.ink};box-shadow:0 1px 2px rgba(0,0,0,.1)}
.fr{display:grid;grid-template-columns:1fr 1fr 36px;gap:8px;margin-bottom:8px;align-items:center}
.item{padding:16px 0;border-bottom:1px solid ${C.line}}
.meta{font-size:13px;color:${C.muted}}
.cmd{background:${C.wash};border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-all;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;user-select:all;margin:12px 0 10px}
.toast{position:absolute;left:20px;right:84px;bottom:84px;z-index:20;background:${C.ink};color:${C.bg};border-radius:14px;padding:11px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:14.5px;animation:lift .2s ease-out;box-shadow:0 6px 20px rgba(0,0,0,.25)}
.toast button{background:none;border:0;color:${C.accent};font-weight:600;font-size:14.5px;padding:2px 4px}
.sync{position:absolute;left:0;right:0;top:0;height:2px;z-index:6;background:linear-gradient(90deg,transparent,${C.accent},transparent);background-size:40% 100%;background-repeat:no-repeat;animation:sweep 1.1s ease-in-out infinite;pointer-events:none}
.ptr{display:flex;align-items:center;justify-content:center;overflow:hidden}
.spin{width:20px;height:20px;border:2px solid ${C.line};border-top-color:${C.accent};border-radius:50%;animation:rot .7s linear infinite}
.spin.idle{animation:none}
.ell{display:inline-flex;gap:3px;vertical-align:middle;margin-left:4px}
.ell i{width:5px;height:5px;border-radius:50%;background:currentColor;animation:blink 1.2s infinite}
.ell i:nth-child(2){animation-delay:.18s}
.ell i:nth-child(3){animation-delay:.36s}
.splash{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding-bottom:40px}
.splash .mark{font-size:44px;animation:lift .6s ease-out}
.splashLine{font-family:${SERIF};font-style:italic;color:${C.muted};margin-top:12px;animation:lift .4s ease-out;min-height:22px}
.squig path{stroke-dasharray:1;animation:draw 2.2s ease-in-out infinite}
.sk{display:flex;gap:14px;padding:16px 0;border-bottom:1px solid ${C.line}}
.sk i{display:block;border-radius:6px;background:linear-gradient(90deg,${C.wash} 0%,${C.line} 50%,${C.wash} 100%);background-size:200% 100%;animation:shim 1.6s linear infinite}
.skC{width:22px;height:22px;border-radius:50%!important;flex:none}
.skL{height:13px;margin-bottom:9px}
.skL.s{height:10px;margin-bottom:0}
.fcard{width:100%;min-height:230px;border:1px solid ${C.line};background:${C.paper};border-radius:18px;padding:28px 24px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px}
.fcard .t{font-family:${SERIF};font-size:22px;line-height:1.4;animation:fade .2s}
.fcard .k{font-size:13px;color:${C.muted}}
.cmt{padding:12px 0;border-bottom:1px solid ${C.line}}
.cmt b{font-weight:500}
.cmtIn{display:flex;gap:8px;align-items:flex-end;margin-top:14px}
.cmtIn textarea{flex:1;min-height:44px;max-height:110px;resize:none;border:1px solid ${C.line};background:${C.paper};border-radius:14px;padding:10px 14px;line-height:1.4}
.intro{flex:1;display:flex;flex-direction:column;padding:24px 26px calc(22px + env(safe-area-inset-bottom));overflow-y:auto}
.introTop{display:flex;align-items:baseline;gap:10px}
.introMid{flex:1;display:flex;flex-direction:column;justify-content:center;animation:lift .3s ease-out;min-height:0}
.introIcon{width:62px;height:62px;border-radius:50%;background:var(--wash);border:1px solid ${C.line};display:grid;place-items:center;color:var(--accent);margin-bottom:26px}
.mono{width:62px;height:62px;border-radius:50%;border:1px solid ${C.line};background:${C.paper};font-family:${SERIF};font-size:23px;display:grid;place-items:center;margin-bottom:26px}
.introH{font-family:${SERIF};font-size:31px;line-height:1.18;letter-spacing:-.02em;font-weight:400;margin:0 0 14px}
.introBody{font-family:${SERIF};font-size:17.5px;line-height:1.6;color:${C.body};margin:0}
.introSmall{font-size:13.5px;color:${C.faint};margin:16px 0 0}
.introFoot{padding-top:16px}
.introDots{display:flex;gap:6px;justify-content:center;margin-bottom:16px}
.introDots i{width:6px;height:6px;border-radius:50%;background:${C.line};transition:background .2s}
.introDots i.on{background:${C.accent}}
.introPow{display:flex;align-items:center;justify-content:center;gap:7px;font-size:12.5px;color:${C.faint};margin:16px 0 0}
@keyframes bdraw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
.burst path{stroke-dasharray:1;animation:bdraw .7s ease-out both}
@media (prefers-reduced-motion:reduce){.scrim,.sheet,.toast,.ann,.splash .mark,.splashLine{animation:none}.squig path,.sync,.sk i,.spin,.ell i,.burst path{animation:none}.squig path{stroke-dashoffset:0}.burst path{stroke-dashoffset:0}}
`;/* ───────────────────────── small pieces ───────────────────────── */

function Sheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="scrim" onClick={onClose} />
      <div className="sheet">
        <div className="sheetHead">
          <h2 className="serif" style={{ fontSize: 22, fontWeight: 400, margin: 0 }}>{title}</h2>
          <button className="iconBtn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Segmented({ value, options, onChange }) {
  return (
    <div className="seg" role="group">
      {options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return <button key={v} aria-pressed={value === v} onClick={() => { if (value !== v) Sound.play("tap"); onChange(v); }}>{l}</button>;
      })}
    </div>
  );
}

const Dots = () => <span className="ell" aria-hidden="true"><i /><i /><i /></span>;

function Squiggle({ width = 150 }) {
  return (
    <svg className="squig" width={width} height={14} viewBox="0 0 160 14" fill="none" aria-hidden="true">
      <path d="M2 9 C 30 2, 60 14, 90 7 S 140 5, 158 8" pathLength="1" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Splash() {
  const lines = ["Gathering today's tasks", "Checking deadlines", "Sharpening pencils", "Opening the class list"];
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((x) => (x + 1) % lines.length), 1500); return () => clearInterval(id); }, []);
  return (
    <div className="splash" role="status" aria-label="Loading">
      <div className="mark">Homeroom</div>
      <Squiggle width={170} />
      <div className="splashLine" key={i}>{lines[i]}</div>
    </div>
  );
}

/* NEW — starburst for the welcome tour, in the Claude style */
function Starburst({ size = 44 }) {
  const rays = [
    "M16 3.5v7", "M16 21.5v7", "M3.5 16h7", "M21.5 16h7",
    "M7.2 7.2l4.9 4.9", "M19.9 19.9l4.9 4.9", "M24.8 7.2l-4.9 4.9", "M12.1 19.9l-4.9 4.9",
  ];
  return (
    <svg className="burst" width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {rays.map((d, i) => (
        <path key={i} d={d} pathLength="1" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" style={{ animationDelay: `${i * 0.07}s` }} />
      ))}
    </svg>
  );
}

/* NEW — first-run welcome tour, shown once to brand-new accounts */
function Intro({ user, classLabel, onDone }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      icon: <div className="introIcon"><Starburst size={42} /></div>,
      title: "Welcome to Homeroom.",
      body: "This is your class's shared list. Everything that's due — homework, quizzes, exams — lives here, added by anyone and seen by everyone. You check off your own work, and the class sees how many people have finished.",
    },
    {
      icon: <div className="introIcon"><BookOpen size={24} /></div>,
      title: "It also helps you study.",
      body: "Open any task to share notes — paste text or upload a PDF or a photo, and the assistant turns it into clean study notes. Make reviewers, practice quizzes and flashcards, or ask what's due and let it plan your evening.",
    },
    {
      icon: <div className="mono">NV</div>,
      title: "Made by Nathaniel Visaya.",
      body: "Built for this class so nobody misses a deadline — and so everyone can earn their way back onto the Minecraft server. Finish your tasks, share your notes, and good luck out there.",
    },
  ];
  const next = () => { Sound.play("tap"); step < steps.length - 1 ? setStep(step + 1) : onDone(); };
  return (
    <div className="intro">
      <div className="introTop">
        <span className="mark" style={{ fontSize: 20 }}>Homeroom</span>
        {classLabel && <span className="meta">{classLabel}</span>}
      </div>
      <div className="introMid" key={step}>
        {steps[step].icon}
        <h1 className="introH">{steps[step].title}</h1>
        <p className="introBody">{steps[step].body}</p>
        {step === 0 && <p className="introSmall">Signed in as {user}.</p>}
      </div>
      <div className="introFoot">
        <div className="introDots" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((_, i) => <i key={i} className={i === step ? "on" : ""} />)}
        </div>
        <button className="btn accent full" onClick={next}>{step < steps.length - 1 ? "Continue" : "Get started"}</button>
        <div style={{ display: "flex", justifyContent: step === 0 ? "center" : "space-between", marginTop: 6 }}>
          {step > 0 && <button className="back" onClick={() => { Sound.play("tap"); setStep(step - 1); }}>Back</button>}
          {step < steps.length - 1 && <button className="back" onClick={onDone}>Skip</button>}
        </div>
      </div>
      <p className="introPow"><Starburst size={11} /> Assistant powered by Claude</p>
    </div>
  );
}

function Waiting({ lines }) {
  const [i, setI] = useState(0);
  useEffect(() => { const id = setInterval(() => setI((x) => (x + 1) % lines.length), 1800); return () => clearInterval(id); }, []);
  return (
    <div className="empty" role="status">
      <Squiggle />
      <div className="serif" style={{ marginTop: 10 }} key={i}>{lines[i]}</div>
      <span style={{ fontSize: 14 }}>This takes a few seconds.</span>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div className="sk" key={i}>
          <i className="skC" />
          <div style={{ flex: 1 }}>
            <i className="skL" style={{ width: `${55 + ((i * 13) % 30)}%` }} />
            <i className="skL s" style={{ width: `${30 + ((i * 17) % 22)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Scroll({ onRefresh, children, style }) {
  const ref = useRef(null);
  const y0 = useRef(null);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = (e) => { y0.current = ref.current && ref.current.scrollTop <= 0 ? e.touches[0].clientY : null; };
  const move = (e) => {
    if (y0.current == null || busy || !onRefresh) return;
    const dy = e.touches[0].clientY - y0.current;
    setPull(dy > 0 ? Math.min(dy * 0.5, 72) : 0);
  };
  const end = async () => {
    if (pull >= 52 && onRefresh && !busy) {
      setBusy(true); setPull(44); Sound.play("tap");
      try { await onRefresh(); } finally { setBusy(false); }
    }
    setPull(0); y0.current = null;
  };
  const h = busy ? 44 : pull;
  return (
    <div className="scroll" ref={ref} onTouchStart={start} onTouchMove={move} onTouchEnd={end} style={style}>
      <div className="ptr" style={{ height: h, transition: pull && !busy ? "none" : "height .2s" }}>
        {h > 14 && <span className={busy ? "spin" : "spin idle"} style={{ opacity: Math.min(1, h / 44), transform: busy ? undefined : `rotate(${h * 5}deg)` }} />}
      </div>
      {children}
    </div>
  );
}

/* ───────────────────────── auth ───────────────────────── */

function ClassPicker({ classes, value, onPick, onCreated }) {
  const [adding, setAdding] = useState(false);
  const [year, setYear] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const create = async () => {
    const y = year.trim(), n = name.trim();
    const id = `${y}-${n}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!y || !n || !id) return setErr("Add both a year and a class.");
    const cur = (await store.get("classes", true)) || [];
    let next = cur;
    if (!cur.some((c) => c.id === id)) {
      next = [...cur, { id, year: y, name: n, label: `${y}-${n}`, createdAt: Date.now() }];
      await store.set("classes", next, true);
    }
    onCreated(next); onPick(id); Sound.play("add");
    setAdding(false); setYear(""); setName(""); setErr("");
  };
  const sorted = [...classes].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  return (
    <div className="field">
      <label>Your class</label>
      <div className="chips" style={{ flexWrap: "wrap", overflow: "visible", padding: 0 }}>
        {sorted.map((c) => <button key={c.id} className="chip" aria-pressed={value === c.id} onClick={() => onPick(c.id)}>{c.label}</button>)}
        <button className="chip" aria-pressed={adding} onClick={() => setAdding(!adding)}><Plus size={14} />{classes.length ? "My class isn't here" : "Add your class"}</button>
      </div>
      {adding && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="input" placeholder="Year, like 8" value={year} onChange={(e) => setYear(e.target.value)} />
            <input className="input" placeholder="Class, like 16" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {err && <p className="err" style={{ marginTop: 8, marginBottom: 0 }}>{err}</p>}
          <button className="btn ghost small" style={{ marginTop: 10 }} onClick={create}>Add class</button>
        </div>
      )}
      <p className="meta" style={{ marginTop: 10, lineHeight: 1.5 }}>Everything you add or upload is shared only with people in your class.</p>
    </div>
  );
}

function ClassGate({ classes, setClasses, onChoose }) {
  const [cls, setCls] = useState(null);
  return (
    <div className="scroll" style={{ paddingTop: 40 }}>
      <h1 className="h1">Pick your class</h1>
      <p className="sub">Tasks and notes are shared only with the people in your class.</p>
      <ClassPicker classes={classes} value={cls} onPick={setCls} onCreated={setClasses} />
      <button className="btn accent full" disabled={!cls} onClick={() => onChoose(cls)}>Continue</button>
    </div>
  );
}

function Auth({ onAuthed }) {
  const [classes, setClasses] = useState([]);
  const [cls, setCls] = useState(null);
  useEffect(() => { store.get("classes", true).then((c) => setClasses(c || [])); }, []);
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr("");
    const u = name.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/.test(u)) return setErr("Usernames are 3 to 20 characters: letters, numbers, dots or underscores.");
    if (pw.length < 6) return setErr("Use a password with at least 6 characters.");
    setBusy(true);
    try {
      const existing = await store.get(`users:${u}`, true);
      if (mode === "signup") {
        if (existing) { setErr("That username is taken. Try another."); Sound.play("err"); return; }
        if (!cls) { setErr("Choose your class first, or add it if it isn't listed."); Sound.play("err"); return; }
        const salt = randHex();
        const hash = await sha(salt + pw);
        const ok = await store.set(`users:${u}`, { salt, hash, createdAt: Date.now(), classId: cls }, true);
        if (!ok) { setErr("Couldn't create the account. Check your connection and try again."); return; }
        await store.set(`progress:${u}`, {});
        await store.set("session", { username: u });
        Sound.play("add");
        onAuthed(u, cls);
      } else {
        if (!existing) { setErr("No account with that username. Create one below."); Sound.play("err"); return; }
        const hash = await sha(existing.salt + pw);
        if (hash !== existing.hash) { setErr("That password doesn't match."); Sound.play("err"); return; }
        await store.set("session", { username: u });
        Sound.play("add");
        onAuthed(u, existing.classId || null);
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="scroll" style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: 40 }}>
      <div className="mark" style={{ fontSize: 38, marginBottom: 10 }}>Homeroom</div>
      <p style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 1.45, color: C.muted, margin: "0 0 34px", maxWidth: 360 }}>
        Everything your class has due, in one place that everyone shares.
      </p>
      <div className="field">
        <label htmlFor="u">Username</label>
        <input id="u" className="input" value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="username" />
      </div>
      <div className="field">
        <label htmlFor="p">Password</label>
        <input id="p" className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} onKeyDown={(e) => e.key === "Enter" && submit()} />
      </div>
      {mode === "signup" && <ClassPicker classes={classes} value={cls} onPick={setCls} onCreated={setClasses} />}
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn accent full" onClick={submit} disabled={busy || !name || !pw}>
        {busy ? <>One moment<Dots /></> : mode === "signup" ? "Create account" : "Sign in"}
      </button>
      <button className="back" style={{ marginTop: 14, alignSelf: "center" }} onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setErr(""); }}>
        {mode === "signup" ? "I already have an account" : "New here? Create an account"}
      </button>
      <p style={{ fontSize: 13, color: C.faint, marginTop: 22, lineHeight: 1.5 }}>
        You stay signed in on this device. Use a password you don't use anywhere else, since this app is shared with your class.
      </p>
    </div>
  );
}

/* ───────────────────────── task form ───────────────────────── */

function QuickAdd({ subjects, onFill }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    if (!q.trim() || busy) return;
    setBusy(true); setErr("");
    const system = `Turn the student's one-line note into a task. Today is ${todayLong()}. Existing subjects: ${subjects.join(", ")}. Respond ONLY with JSON: {"title":string,"subject":string,"taskType":one of ${TYPES.join(", ")},"priority":"High"|"Medium"|"Low","deadline":"YYYY-MM-DD","notes":string}. Reuse an existing subject name when one fits. Resolve weekdays and words like tomorrow against today. If no date is given use tomorrow. Notes hold extra detail such as pages or topics, otherwise an empty string.`;
    try {
      const out = parseJSON(await callClaude(system, [{ role: "user", content: q }]));
      if (!out?.title) throw new Error("bad");
      onFill(out); Sound.play("pop"); setQ("");
    } catch {
      setErr("Couldn't read that one. You can fill the form below instead."); Sound.play("err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="field" style={{ paddingBottom: 18, borderBottom: `1px solid ${C.line}` }}>
      <label htmlFor="qa">Quick add</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input id="qa" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="math quiz friday, chapter 2"
          onKeyDown={(e) => e.key === "Enter" && go()} />
        <button className="btn ghost" onClick={go} disabled={!q.trim() || busy} aria-label="Fill the form from this note">
          {busy ? <Dots /> : <Sparkles size={17} />}
        </button>
      </div>
      {err && <p className="err" style={{ marginTop: 8, marginBottom: 0 }}>{err}</p>}
    </div>
  );
}

function TaskForm({ initial, subjects, onSave, onCancel }) {
  const [f, setF] = useState(
    initial || { title: "", subject: "", type: "Homework", priority: "High", deadline: addDays(todayISO(), 1), notes: "" }
  );
  const [newSubj, setNewSubj] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.title.trim() && f.subject.trim() && f.deadline;
  const fill = (o) => {
    setF((p) => ({
      ...p,
      title: o.title || p.title,
      subject: o.subject || p.subject,
      type: TYPES.includes(o.taskType) ? o.taskType : p.type,
      priority: PRIORITIES.includes(o.priority) ? o.priority : p.priority,
      deadline: /^\d{4}-\d{2}-\d{2}$/.test(o.deadline || "") ? o.deadline : p.deadline,
      notes: o.notes || p.notes,
    }));
    setNewSubj(!!o.subject && !subjects.includes(o.subject));
  };
  return (
    <div>
      {!initial && <QuickAdd subjects={subjects} onFill={fill} />}
      <div className="field">
        <label htmlFor="t">What is it?</label>
        <input id="t" className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Math quiz 2.2" />
      </div>
      <div className="field">
        <label>Subject</label>
        <div className="chips" style={{ flexWrap: "wrap", overflow: "visible", padding: 0 }}>
          {subjects.map((s) => (
            <button key={s} className="chip" aria-pressed={f.subject === s && !newSubj} onClick={() => { setNewSubj(false); set("subject", s); }}>
              <span className="dot" style={{ background: subjColor(s), margin: 0 }} />{s}
            </button>
          ))}
          <button className="chip" aria-pressed={newSubj} onClick={() => { setNewSubj(true); set("subject", ""); }}>
            <Plus size={14} /> New subject
          </button>
        </div>
        {newSubj && <input className="input" style={{ marginTop: 10 }} autoFocus value={f.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Subject name" />}
      </div>
      <div className="field">
        <label>Kind</label>
        <div className="chips" style={{ flexWrap: "wrap", overflow: "visible", padding: 0 }}>
          {TYPES.map((k) => <button key={k} className="chip" aria-pressed={f.type === k} onClick={() => set("type", k)}>{k}</button>)}
        </div>
      </div>
      <div className="field">
        <label>Priority</label>
        <Segmented value={f.priority} options={PRIORITIES} onChange={(v) => set("priority", v)} />
      </div>
      <div className="field">
        <label htmlFor="d">Due date</label>
        <input id="d" type="date" className="input" value={f.deadline} onChange={(e) => set("deadline", e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="n">Guidelines or notes</label>
        <textarea id="n" className="input" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Pages, what to bring, how it's graded" />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn accent" style={{ flex: 1 }} disabled={!valid} onClick={() => onSave({ ...f, title: f.title.trim(), subject: f.subject.trim() })}>
          {initial ? "Save changes" : "Add to class"}
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── tasks tab ───────────────────────── */

function TaskRow({ t, status, finished, onOpen, onToggle, onEdit }) {
  const n = diffDays(t.deadline);
  const done = status === "done";
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const g = useRef({ x: 0, y: 0, lock: null, moved: false });
  const dxRef = useRef(0);
  const start = (e) => { const p = e.touches[0]; g.current = { x: p.clientX, y: p.clientY, lock: null, moved: false }; };
  const move = (e) => {
    const p = e.touches[0], s = g.current;
    const ddx = p.clientX - s.x, ddy = p.clientY - s.y;
    if (!s.lock && (Math.abs(ddx) > 10 || Math.abs(ddy) > 10)) s.lock = Math.abs(ddx) > Math.abs(ddy) ? "x" : "y";
    if (s.lock === "x") {
      s.moved = true; setDrag(true);
      const v = Math.max(-120, Math.min(120, ddx));
      dxRef.current = v; setDx(v);
    }
  };
  const end = () => {
    const s = g.current, v = dxRef.current;
    if (s.lock === "x") {
      if (v > 80) onToggle();
      else if (v < -80 && onEdit) onEdit();
    }
    dxRef.current = 0; setDrag(false); setDx(0);
  };
  return (
    <div className="swipe" onTouchStart={start} onTouchMove={move} onTouchEnd={end} onTouchCancel={end}>
      <div className="under" aria-hidden="true">
        <span style={{ opacity: dx > 24 ? 1 : 0 }}><Check size={16} />{done ? "Undo" : "Done"}</span>
        <span style={{ opacity: dx < -24 ? 1 : 0 }}>Edit <Pencil size={16} /></span>
      </div>
      <div className="row" role="button" tabIndex={0}
        style={{ transform: `translateX(${dx}px)`, transition: drag ? "none" : "transform .2s ease-out" }}
        onClick={() => { if (g.current.moved) return; onOpen(); }}
        onKeyDown={(e) => e.key === "Enter" && onOpen()}>
        <button className="check" data-s={status} aria-label={done ? "Mark as not done" : "Mark as done"} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {done && <Check size={14} strokeWidth={3} />}
        </button>
        <div className="rowMain">
          <div className="rowTitle" data-done={done ? 1 : 0}>{t.title}</div>
          <div className="rowMeta">
            <span><span className="dot" style={{ background: subjColor(t.subject) }} />{t.subject}</span>
            <span>{t.type}</span>
            {status === "progress" && <span style={{ color: C.accent }}>In progress</span>}
            {finished > 0 && <span>{finished} finished</span>}
          </div>
        </div>
        <div className="rowRight">
          <div className={n < 0 && !done ? "late" : ""}>{relLabel(t.deadline)}</div>
          <div className="pri" data-p={t.priority}>{t.priority}</div>
        </div>
      </div>
    </div>
  );
}

function CalendarView({ tasks, month, progress, completions, user, selDay, setSelDay, openTask, editTask, setStatus }) {
  const lead = (new Date(month.y, month.m, 1).getDay() + 6) % 7; // weeks start Monday
  const count = new Date(month.y, month.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= count; d++) cells.push(toISO(new Date(month.y, month.m, d)));
  const byDay = {};
  tasks.forEach((t) => { (byDay[t.deadline] = byDay[t.deadline] || []).push(t); });
  const today = todayISO();
  const dayTasks = selDay ? byDay[selDay] || [] : [];
  const st = (t) => progress[t.id] || "todo";
  return (
    <div>
      <div className="cal" role="grid" aria-label="Month">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i} className="calHead">{d}</div>)}
        {cells.map((iso, i) =>
          iso ? (
            <button key={iso} className="day" data-sel={selDay === iso ? 1 : 0} data-today={iso === today ? 1 : 0}
              onClick={() => { Sound.play("tap"); setSelDay(iso); }} aria-label={`${fmtDate(iso)}, ${(byDay[iso] || []).length} due`}>
              <span className="num">{parse(iso).getDate()}</span>
              <span className="pips">
                {(byDay[iso] || []).slice(0, 3).map((t) => (
                  <i key={t.id} style={{ background: subjColor(t.subject), opacity: st(t) === "done" ? 0.3 : 1 }} />
                ))}
              </span>
            </button>
          ) : <span key={`b${i}`} />
        )}
      </div>
      {selDay && (
        <section className="group">
          <h3>{relLabel(selDay) === fmtDate(selDay) ? fmtDate(selDay) : `${relLabel(selDay)}, ${fmtDate(selDay)}`} <small>{dayTasks.length}</small></h3>
          {dayTasks.length === 0 && <p style={{ color: C.muted, margin: "10px 0" }}>Nothing due this day.</p>}
          {dayTasks.map((t) => (
            <TaskRow key={t.id} t={t} status={st(t)} finished={(completions[t.id] || []).filter((u) => u !== user).length}
              onOpen={() => openTask(t.id)} onEdit={() => editTask(t.id)}
              onToggle={() => setStatus(t.id, st(t) === "done" ? "todo" : "done")} />
          ))}
        </section>
      )}
    </div>
  );
}

function TasksTab({ user, tasks, progress, completions, announcements, weeklies, onOpenWeekly, dismissAnn, setStatus, openTask, editTask, ui, setUi, loading, onRefresh, onPlan }) {
  const [hideNote, setHideNote] = useState(false);
  const [hideWk, setHideWk] = useState(false);
  const [selDay, setSelDay] = useState(todayISO());
  const [month, setMonth] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const subjects = useMemo(() => [...new Set(tasks.map((t) => t.subject))], [tasks]);
  const { view, mode } = ui;
  const subj = ui.subj === "All" || subjects.includes(ui.subj) ? ui.subj : "All";
  const setView = (v) => setUi((u) => ({ ...u, view: v }));
  const setSubj = (v) => setUi((u) => ({ ...u, subj: v }));
  const setMode = (v) => { Sound.play("tap"); setUi((u) => ({ ...u, mode: v })); };
  const shiftMonth = (n) => { Sound.play("tap"); setMonth(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; }); };
  const monthLabel = new Date(month.y, month.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const st = (t) => progress[t.id] || "todo";
  const fin = (t) => (completions[t.id] || []).filter((u) => u !== user).length;
  const prio = { High: 0, Medium: 1, Low: 2 };
  const filtered = tasks
    .filter((t) => subj === "All" || t.subject === subj)
    .filter((t) => ui.kind === "All" || t.type === ui.kind)
    .filter((t) => (view === "done" ? st(t) === "done" : view === "upcoming" ? st(t) !== "done" : true))
    .sort((a, b) => a.deadline.localeCompare(b.deadline) || prio[a.priority] - prio[b.priority] || a.title.localeCompare(b.title));
  const mine = tasks.filter((t) => st(t) !== "done");
  const overdueList = mine.filter((t) => diffDays(t.deadline) < 0);
  const todayList = mine.filter((t) => diffDays(t.deadline) === 0);
  const tomorrowList = mine.filter((t) => diffDays(t.deadline) === 1);
  const week = mine.filter((t) => { const n = diffDays(t.deadline); return n >= 0 && n <= 7; }).length;
  const overdue = overdueList.length, today = todayList.length;
  const reminders = [["Overdue", overdueList], ["Due today", todayList], ["Due tomorrow", tomorrowList]].filter(([, l]) => l.length);
  const anns = [...announcements].sort((a, b) => b.at - a.at).slice(0, 2);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const kinds = [...new Set(tasks.map((t) => t.type))];
  const dow = new Date().getDay();
  const thisWk = weekStartOf(todayISO());
  const wkBanner = tasks.length > 0 && (dow === 0 || dow === 1)
    ? (() => {
        const ws = dow === 0 ? thisWk : addDays(thisWk, -7);
        const which = dow === 0 ? "this week's" : "last week's";
        const saved = weeklies.some((w) => w.weekStart === ws);
        return { ws, title: dow === 0 ? "This week is wrapping up." : "A new week.", text: saved ? `The reviewer for ${which} is ready to read.` : `Make ${which} reviewer from everything the class added.` };
      })()
    : null;
  const groups = [];
  if (ui.group === "subject") {
    subjects.forEach((s) => { const items = filtered.filter((t) => t.subject === s); if (items.length) groups.push({ key: s, items }); });
  } else if (view === "done") {
    groups.push({ key: "Completed", items: filtered });
  } else {
    const defs = [
      ["Overdue", (n) => n < 0], ["Today", (n) => n === 0], ["Tomorrow", (n) => n === 1],
      ["Later this week", (n) => n > 1 && n <= 7], ["After that", (n) => n > 7],
    ];
    defs.forEach(([key, fn]) => {
      const items = filtered.filter((t) => fn(diffDays(t.deadline)) && !(view === "all" && st(t) === "done" && key === "Overdue"));
      if (items.length) groups.push({ key, items });
    });
  }
  return (
    <Scroll onRefresh={onRefresh}>
      <h1 className="h1">{greet}, {user}.</h1>
      <p className="sub">
        {today + overdue === 0 ? "Nothing urgent right now." : `${today} due today${overdue ? `, ${overdue} overdue` : ""}.`}
      </p>
      {anns.map((a) => (
        <div className="ann" key={a.id}>
          <div>
            <small>From your admin, {timeAgo(a.at)}</small>
            <p>{a.text}</p>
          </div>
          <button className="iconBtn" style={{ width: 28, height: 28, flex: "none" }} onClick={() => dismissAnn(a.id)} aria-label="Dismiss announcement"><X size={16} /></button>
        </div>
      ))}
      {!hideNote && reminders.length > 0 && (
        <div className="note" role="status">
          <div>{reminders.map(([label, l]) => <p key={label}><span>{label}: </span>{summarize(l)}</p>)}</div>
          <button className="iconBtn" style={{ width: 28, height: 28, flex: "none" }} onClick={() => setHideNote(true)} aria-label="Dismiss reminder"><X size={16} /></button>
        </div>
      )}
      {wkBanner && !hideWk && (
        <div className="note" role="status">
          <div>
            <p><span>{wkBanner.title}</span> {wkBanner.text}</p>
            <button className="btn ghost small" onClick={() => onOpenWeekly(wkBanner.ws)}>Open the weekly reviewer</button>
          </div>
          <button className="iconBtn" style={{ width: 28, height: 28, flex: "none" }} onClick={() => setHideWk(true)} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}
      <div className="stats">
        <div className="stat"><b style={overdue ? { color: C.danger } : {}}>{overdue}</b><span>Overdue</span></div>
        <div className="stat"><b>{today}</b><span>Due today</span></div>
        <div className="stat"><b>{week}</b><span>Next 7 days</span></div>
      </div>
      <button className="btn ghost small" style={{ marginBottom: 16 }} onClick={onPlan}>
        <Sparkles size={14} style={{ verticalAlign: -2, marginRight: 7 }} />Plan my evening
      </button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        {mode === "list" ? (
          <Segmented value={view} onChange={setView} options={[["upcoming", "Upcoming"], ["all", "All"], ["done", "Done"]]} />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button className="iconBtn" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft size={20} /></button>
            <span className="serif" style={{ fontSize: 19, minWidth: 128, textAlign: "center" }}>{monthLabel}</span>
            <button className="iconBtn" onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight size={20} /></button>
          </div>
        )}
        <div className="ico" role="group" aria-label="View">
          <button aria-pressed={mode === "list"} onClick={() => setMode("list")} aria-label="List view"><ListIcon size={17} /></button>
          <button aria-pressed={mode === "calendar"} onClick={() => setMode("calendar")} aria-label="Calendar view"><CalendarDays size={17} /></button>
        </div>
      </div>
      <div className="chips">
        {["All", ...subjects].map((s) => (
          <button key={s} className="chip" aria-pressed={subj === s} onClick={() => { Sound.play("tap"); setSubj(s); }}>
            {s !== "All" && <span className="dot" style={{ background: subjColor(s), margin: 0 }} />}{s}
          </button>
        ))}
      </div>
      {kinds.length > 1 && (
        <div className="chips" style={{ paddingTop: 0 }}>
          {["All", ...kinds].map((k) => (
            <button key={k} className="chip" aria-pressed={ui.kind === k} onClick={() => { Sound.play("tap"); setUi((u) => ({ ...u, kind: k })); }}>
              {k === "All" ? "Any kind" : k}
            </button>
          ))}
        </div>
      )}
      {mode === "list" && tasks.length > 0 && (
        <div style={{ margin: "6px 0 2px" }}>
          <Segmented value={ui.group} onChange={(v) => setUi((u) => ({ ...u, group: v }))} options={[["date", "By date"], ["subject", "By subject"]]} />
        </div>
      )}
      {loading && tasks.length === 0 && <SkeletonRows />}
      {!loading && mode === "list" && groups.length === 0 && (
        <div className="empty">
          <div className="serif">{view === "done" ? "Nothing finished yet" : "You're all caught up"}</div>
          {view === "done" ? "Tasks you check off will collect here." : "Add something with the plus button, or ask the assistant."}
        </div>
      )}
      {mode === "list" && groups.map((g) => (
        <section className="group" key={g.key}>
          <h3>{g.key}<small>{g.items.length}</small></h3>
          {g.items.map((t) => (
            <TaskRow key={t.id} t={t} status={st(t)} finished={fin(t)}
              onOpen={() => openTask(t.id)} onEdit={() => editTask(t.id)}
              onToggle={() => setStatus(t.id, st(t) === "done" ? "todo" : "done")} />
          ))}
        </section>
      ))}
      {mode === "calendar" && (
        <CalendarView tasks={tasks.filter((t) => subj === "All" || t.subject === subj)} month={month} progress={progress}
          completions={completions} user={user} selDay={selDay} setSelDay={setSelDay}
          openTask={openTask} editTask={editTask} setStatus={setStatus} />
      )}
    </Scroll>
  );
}

/* ───────────────────────── plan my evening ───────────────────────── */

function PlanPanel({ tasks, progress }) {
  const [mins, setMins] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async (m) => {
    setMins(m); setText(""); setBusy(true); setErr("");
    const open = tasks
      .filter((t) => (progress[t.id] || "todo") !== "done")
      .map((t) => `${t.title} | ${t.subject} | ${t.type} | priority ${t.priority} | due ${t.deadline} (${diffDays(t.deadline)} days from today) | ${statusLabel(progress[t.id])} | ${t.notes || ""}`)
      .join("\n") || "(nothing open)";
    const system = `You help a student plan tonight's work. Today is ${todayLong()}. The student has about ${m} minutes. Open tasks:\n${open}\n\nPick what to do tonight and in what order, weighing due date first, then priority, then how long each kind of task usually takes (quizzes and exams need study time, homework less). Give each step as one line: the task, then a rough number of minutes. End with one short line about what can safely wait. Plain text only, no markdown symbols, no emojis, under 160 words. If nothing is open, say so warmly in one sentence.`;
    try {
      await streamClaude(system, [{ role: "user", content: "Plan my evening." }], (t) => setText(t));
      Sound.play("pop");
    } catch {
      setErr("The assistant couldn't plan that just now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };
  if (mins === null) {
    return (
      <div>
        <p style={{ margin: "0 0 16px", color: C.muted }}>How much time do you have tonight?</p>
        <div className="chips" style={{ flexWrap: "wrap", overflow: "visible", padding: 0 }}>
          {[[30, "30 minutes"], [60, "1 hour"], [120, "2 hours"], [180, "3 hours"]].map(([m, l]) => (
            <button key={m} className="chip" onClick={() => run(m)}>{l}</button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      {busy && !text && <Waiting lines={["Looking at your deadlines", "Weighing what matters most", "Putting it in order"]} />}
      {text && <div className="serif" style={{ fontSize: 17, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{text}</div>}
      {err && <p className="err">{err}</p>}
      {!busy && <button className="btn ghost small" style={{ marginTop: 20 }} onClick={() => { setMins(null); setText(""); }}>Change the time</button>}
    </div>
  );
}

/* ───────────────────────── search ───────────────────────── */

function SearchPanel({ tasks, materials, onTask, onMaterial }) {
  const [q, setQ] = useState("");
  const s = q.trim().toLowerCase();
  const tr = s ? tasks.filter((t) => [t.title, t.subject, t.type, t.notes].join(" ").toLowerCase().includes(s)).slice(0, 20) : [];
  const mr = s ? materials.filter((m) => `${m.title} ${m.text}`.toLowerCase().includes(s)).slice(0, 20) : [];
  const snip = (m) => {
    const i = m.text.toLowerCase().indexOf(s);
    if (i < 0) return "";
    const a = Math.max(0, i - 40);
    return (a > 0 ? "…" : "") + m.text.slice(a, i + 90).replace(/\s+/g, " ") + "…";
  };
  return (
    <div>
      <input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks and review material" aria-label="Search" />
      {s && tr.length === 0 && mr.length === 0 && <div className="empty" style={{ padding: "36px 8px" }}>Nothing matches "{q.trim()}".</div>}
      {tr.length > 0 && (
        <section className="group">
          <h3>Tasks <small>{tr.length}</small></h3>
          {tr.map((t) => (
            <button key={t.id} className="row" onClick={() => onTask(t.id)}>
              <div className="rowMain">
                <div className="rowTitle">{t.title}</div>
                <div className="rowMeta"><span><span className="dot" style={{ background: subjColor(t.subject) }} />{t.subject}</span><span>{t.type}</span></div>
              </div>
              <div className="rowRight">{relLabel(t.deadline)}</div>
            </button>
          ))}
        </section>
      )}
      {mr.length > 0 && (
        <section className="group">
          <h3>Review material <small>{mr.length}</small></h3>
          {mr.map((m) => (
            <button key={m.id} className="row" onClick={() => onMaterial(m)}>
              <div className="rowMain">
                <div className="rowTitle">{m.title}</div>
                <div className="rowMeta"><span>{tasks.find((t) => t.id === m.taskId)?.title || "Removed task"}</span></div>
                {snip(m) && <div style={{ fontSize: 13.5, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{snip(m)}</div>}
              </div>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

/* ───────────────────────── review ───────────────────────── */

function PracticeQuiz({ task, materials, onClose }) {
  const [state, setState] = useState("loading");
  const [qs, setQs] = useState([]);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState(null);
  const [score, setScore] = useState(0);
  const mats = materials.filter((m) => m.taskId === task.id);
  const load = async () => {
    setState("loading"); setI(0); setPick(null); setScore(0);
    const system = `You write practice quizzes for students. Respond ONLY with JSON: {"questions":[{"q":string,"choices":[string,string,string,string],"answer":0-3,"why":string}]}. Write exactly 5 multiple-choice questions. Keep every "why" to one sentence. No markdown.`;
    const body = mats.length
      ? `Task: ${task.title} (${task.subject}, ${task.type}).\nBase the questions on this review material:\n${mats.map((m) => m.text.slice(0, 3500)).join("\n---\n").slice(0, 9000)}`
      : `Task: ${task.title} (${task.subject}, ${task.type}). Notes: ${task.notes || "none"}.\nNo material was uploaded, so write questions from general knowledge of the topic the title suggests, at a middle school level.`;
    try {
      const out = parseJSON(await callClaude(system, [{ role: "user", content: body }]));
      const q = (out?.questions || []).filter((x) => x.q && Array.isArray(x.choices) && x.choices.length >= 2);
      if (!q.length) throw new Error("bad");
      setQs(q); setState("ready"); Sound.play("pop");
    } catch {
      setState("error"); Sound.play("err");
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (state === "ready" && qs.length && i >= qs.length) Sound.play("bell"); }, [i, state]);
  if (state === "loading") return <Waiting lines={["Writing your questions", "Checking the answers twice", "Almost ready"]} />;
  if (state === "error") return (
    <div className="empty">
      <div className="serif">Couldn't build the quiz</div>
      <p>Something went wrong reaching the assistant.</p>
      <button className="btn" onClick={load}>Try again</button>
    </div>
  );
  if (i >= qs.length) return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div className="serif" style={{ fontSize: 56, lineHeight: 1 }}>{score}<span style={{ color: C.faint }}> / {qs.length}</span></div>
      <p style={{ color: C.muted, margin: "10px 0 26px" }}>
        {score === qs.length ? "Every one right." : score >= qs.length / 2 ? "A solid start. Run it again to lock it in." : "Worth another pass through the material."}
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button className="btn ghost" onClick={onClose}>Done</button>
        <button className="btn accent" onClick={load}>New questions</button>
      </div>
    </div>
  );
  const q = qs[i];
  const answered = pick !== null;
  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted }}>Question {i + 1} of {qs.length}</div>
      <div className="bar"><i style={{ width: `${(i / qs.length) * 100}%` }} /></div>
      {!mats.length && i === 0 && (
        <p style={{ fontSize: 13, color: C.muted, margin: "-8px 0 16px" }}>No material added yet, so these come from general knowledge. Add notes for sharper questions.</p>
      )}
      <p className="serif" style={{ fontSize: 21, lineHeight: 1.4, margin: "0 0 20px" }}>{q.q}</p>
      {q.choices.map((c, k) => {
        const s = !answered ? "" : k === q.answer ? "right" : k === pick ? "wrong" : "";
        return (
          <button key={k} className="opt" data-s={s} disabled={answered}
            onClick={() => { setPick(k); if (k === q.answer) { setScore((x) => x + 1); Sound.play("done"); } else Sound.play("err"); }}>
            <span style={{ color: C.faint, width: 18 }}>{"ABCD"[k]}</span><span>{c}</span>
          </button>
        );
      })}
      {answered && (
        <>
          <p style={{ color: C.muted, margin: "6px 0 18px", lineHeight: 1.5 }}>{q.why}</p>
          <button className="btn accent full" onClick={() => { Sound.play("tap"); setI(i + 1); setPick(null); }}>{i + 1 === qs.length ? "See score" : "Next question"}</button>
        </>
      )}
    </div>
  );
}

function Flashcards({ task, materials, onClose }) {
  const [state, setState] = useState("loading");
  const [deck, setDeck] = useState([]);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [known, setKnown] = useState(0);
  const [missed, setMissed] = useState([]);
  const mats = materials.filter((m) => m.taskId === task.id);
  const load = async () => {
    setState("loading"); setI(0); setFlip(false); setKnown(0); setMissed([]);
    const system = `You make flashcards for students. Respond ONLY with JSON: {"cards":[{"front":string,"back":string}]}. Write 10 cards. Fronts are short questions or terms. Backs are brief answers under 25 words. No markdown.`;
    const body = mats.length
      ? `Task: ${task.title} (${task.subject}). Make cards from this material:\n${mats.map((m) => m.text.slice(0, 3500)).join("\n---\n").slice(0, 9000)}`
      : `Task: ${task.title} (${task.subject}, ${task.type}). Notes: ${task.notes || "none"}. No material was uploaded, so use general knowledge of the topic at a middle school level.`;
    try {
      const out = parseJSON(await callClaude(system, [{ role: "user", content: body }]));
      const cards = (out?.cards || []).filter((c) => c.front && c.back);
      if (!cards.length) throw new Error("bad");
      setDeck(cards); setState("ready"); Sound.play("pop");
    } catch {
      setState("error"); Sound.play("err");
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (state === "ready" && deck.length && i >= deck.length) Sound.play("bell"); }, [i, state]);
  if (state === "loading") return <Waiting lines={["Cutting your flashcards", "Picking the key terms", "Shuffling the deck"]} />;
  if (state === "error") return (
    <div className="empty">
      <div className="serif">Couldn't make the cards</div>
      <p>Something went wrong reaching the assistant.</p>
      <button className="btn" onClick={load}>Try again</button>
    </div>
  );
  if (i >= deck.length) return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div className="serif" style={{ fontSize: 48, lineHeight: 1 }}>{known}<span style={{ color: C.faint }}> / {deck.length}</span></div>
      <p style={{ color: C.muted, margin: "10px 0 26px" }}>{missed.length ? `${missed.length} still need another look.` : "You knew every card."}</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button className="btn ghost" onClick={onClose}>Done</button>
        {missed.length > 0 && <button className="btn accent" onClick={() => { setDeck(missed); setI(0); setKnown(0); setMissed([]); setFlip(false); }}>Practice the {missed.length} missed</button>}
        <button className="btn ghost" onClick={load}>New cards</button>
      </div>
    </div>
  );
  const card = deck[i];
  const answer = (ok) => {
    if (ok) { setKnown((k) => k + 1); Sound.play("pop"); } else { setMissed((m) => [...m, card]); Sound.play("tap"); }
    setFlip(false); setI(i + 1);
  };
  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted }}>Card {i + 1} of {deck.length}</div>
      <div className="bar"><i style={{ width: `${(i / deck.length) * 100}%` }} /></div>
      <button className="fcard" onClick={() => { setFlip((f) => !f); Sound.play("tap"); }} aria-label="Flip card">
        <span className="k" style={flip ? { color: C.accent } : undefined}>{flip ? "Answer" : "Tap to flip"}</span>
        <span className="t" key={flip ? "b" : "f"}>{flip ? card.back : card.front}</span>
      </button>
      <div style={{ display: "flex", gap: 10, marginTop: 18, minHeight: 46 }}>
        {flip && (
          <>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => answer(false)}>Still learning</button>
            <button className="btn accent" style={{ flex: 1 }} onClick={() => answer(true)}>Got it</button>
          </>
        )}
      </div>
    </div>
  );
}

function ReviewDetail({ task, user, materials, addMaterial, removeMaterial, onBack }) {
  const mats = materials.filter((m) => m.taskId === task.id);
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  const [quiz, setQuiz] = useState(false);
  const [cards, setCards] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState("");
  const [reading, setReading] = useState("");
  const fileRef = useRef(null);
  const onFile = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    if (!files.length) return;
    setErr("");
    if (!title) setTitle(files[0].name.replace(/\.[^.]+$/, ""));
    const parts = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setReading(files.length > 1 ? `Reading file ${i + 1} of ${files.length}` : "Reading file");
      try {
        if (f.size > 20 * 1024 * 1024) throw new Error("big");
        if (/.pdf$/i.test(f.name) || f.type === "application/pdf" || f.type.startsWith("image/")) {
          const out = await extractFromFile(f);
          if (!out.trim()) throw new Error("empty");
          parts.push(out.trim());
        } else {
          const t = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(f); });
          parts.push(t.slice(0, 20000));
        }
      } catch {
        setErr(`Couldn't read ${f.name}. Files can be up to 20 MB: PDFs, photos, or text files.`);
        Sound.play("err");
      }
    }
    setReading("");
    if (parts.length) { setText((prev) => [prev.trim(), ...parts].filter(Boolean).join("\n\n")); Sound.play("pop"); }
  };
  const save = async () => {
    await addMaterial({ id: uid(), taskId: task.id, title: title.trim() || "Untitled notes", text: text.trim(), by: user, kind: "upload", at: Date.now(), subject: task.subject, taskTitle: task.title });
    Sound.play("add");
    setAdding(false); setTitle(""); setText(""); setErr("");
  };
  const generate = async () => {
    setGen(true); setErr("");
    const system = `You write concise, well-organized study reviewers for students. Plain text only, no markdown symbols, no emojis. Use short headed sections separated by blank lines. Maximum 450 words.`;
    const body = mats.length
      ? `Make a reviewer for "${task.title}" (${task.subject}). Condense and organize this material:\n${mats.map((m) => m.text.slice(0, 3500)).join("\n---\n").slice(0, 9000)}`
      : `Make a reviewer for "${task.title}" (${task.subject}, ${task.type}). Teacher notes: ${task.notes || "none"}. No material was uploaded, so cover the key ideas a student would likely need for this topic at a middle school level, and say at the top that it is a general reviewer.`;
    try {
      const out = await callClaude(system, [{ role: "user", content: body }]);
      if (!out.trim()) throw new Error("empty");
      await addMaterial({ id: uid(), taskId: task.id, title: `Reviewer for ${task.title}`, text: out.trim(), by: "Assistant", kind: "ai", at: Date.now(), subject: task.subject, taskTitle: task.title });
      Sound.play("bell");
    } catch {
      setErr("The assistant couldn't write a reviewer just now. Try again in a moment.");
      Sound.play("err");
    } finally {
      setGen(false);
    }
  };
  return (
    <div className="scroll">
      <button className="back" onClick={onBack}><ChevronLeft size={18} />Review</button>
      <h1 className="h1" style={{ marginTop: 4 }}>{task.title}</h1>
      <div className="rowMeta" style={{ fontSize: 14 }}>
        <span><span className="dot" style={{ background: subjColor(task.subject) }} />{task.subject}</span>
        <span>{task.type}</span>
        <span className={diffDays(task.deadline) < 0 ? "late" : ""}>Due {relLabel(task.deadline)}</span>
      </div>
      {task.notes && <p style={{ color: C.muted, margin: "16px 0 0", lineHeight: 1.55 }}>{task.notes}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
        <button className="btn accent" onClick={() => setQuiz(true)}>Practice quiz</button>
        <button className="btn ghost" onClick={() => setCards(true)}>Flashcards</button>
        <button className="btn ghost" onClick={generate} disabled={gen}>
          <Sparkles size={15} style={{ verticalAlign: -2, marginRight: 6 }} />{gen ? <>Writing reviewer<Dots /></> : "Ask for a reviewer"}
        </button>
      </div>
      {err && !adding && <p className="err" style={{ marginTop: 14 }}>{err}</p>}
      <h2 className="sectionTitle">Review material</h2>
      {mats.length === 0 && <p style={{ color: C.muted, margin: 0 }}>Nothing here yet. Paste notes, or upload a PDF, photo or text file so classmates can use them too.</p>}
      {mats.map((m) => (
        <div className="mat" key={m.id}>
          <button className="matHead" onClick={() => { Sound.play("tap"); setOpen(open === m.id ? null : m.id); }} aria-expanded={open === m.id}>
            <span>
              <span style={{ fontWeight: 500 }}>{m.title}</span>
              {m.kind === "ai" && <span className="tag">Assistant</span>}
              <span style={{ display: "block", fontSize: 13, color: C.muted }}>Added by {m.by}</span>
            </span>
            <ChevronDown size={18} style={{ stroke: "var(--faint)", transform: open === m.id ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </button>
          {open === m.id && (
            <>
              <div className="matBody">{m.text}</div>
              {(m.by === user || m.kind === "ai") && (
                <button className="back" style={{ color: C.danger, marginBottom: 12 }} onClick={() => removeMaterial(m.id)}>
                  <Trash2 size={14} style={{ marginRight: 6 }} />Remove
                </button>
              )}
            </>
          )}
        </div>
      ))}
      <button className="btn ghost" style={{ marginTop: 18 }} onClick={() => setAdding(true)}>
        <Plus size={15} style={{ verticalAlign: -2, marginRight: 6 }} />Add material
      </button>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add review material">
        <div className="field">
          <label htmlFor="mt">Title</label>
          <input id="mt" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lesson 2.1 key points" />
        </div>
        <div className="field">
          <label htmlFor="mx">Notes</label>
          <textarea id="mx" className="input" style={{ minHeight: 160 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste notes here" />
        </div>
        <input ref={fileRef} type="file" multiple accept=".pdf,image/*,.txt,.md,.csv,.json,text/plain" hidden onChange={onFile} />
        <p style={{ fontSize: 13, color: C.muted, margin: "-6px 0 14px", lineHeight: 1.5 }}>
          PDFs and photos are read by the assistant and turned into notes you can edit. Long files are condensed.
        </p>
        {err && <p className="err">{err}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button className="btn ghost" disabled={!!reading} onClick={() => fileRef.current?.click()}>
            <Upload size={15} style={{ verticalAlign: -2, marginRight: 6 }} />{reading ? <>{reading}<Dots /></> : "Upload PDF, photo or text file"}
          </button>
          <button className="btn accent" disabled={!text.trim() || !!reading} onClick={save}>Share with class</button>
        </div>
      </Sheet>
      <Sheet open={quiz} onClose={() => setQuiz(false)} title="Practice quiz">
        {quiz && <PracticeQuiz task={task} materials={materials} onClose={() => setQuiz(false)} />}
      </Sheet>
      <Sheet open={cards} onClose={() => setCards(false)} title="Flashcards">
        {cards && <Flashcards task={task} materials={materials} onClose={() => setCards(false)} />}
      </Sheet>
    </div>
  );
}

function WeeklyReviewer({ tasks, materials, weeklies, user, saveWeekly, initialWs }) {
  const thisWeek = weekStartOf(todayISO());
  const lastWeek = addDays(thisWeek, -7);
  const [ws, setWs] = useState(initialWs || thisWeek);
  const [live, setLive] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [quiz, setQuiz] = useState(false);
  const [cards, setCards] = useState(false);
  const saved = weeklies.find((w) => w.weekStart === ws);
  const wkTask = { id: `week-${ws}`, title: `Week of ${weekLabel(ws)}`, subject: "All subjects", type: "Study", notes: "" };
  const wkMats = saved ? [{ id: "wk", taskId: wkTask.id, title: wkTask.title, text: saved.text }] : [];
  const shown = busy ? live : saved?.text || "";
  const { ts, ms } = useMemo(() => weekData(ws, tasks, materials), [ws, tasks, materials]);
  const earlier = weeklies.filter((w) => w.weekStart !== thisWeek && w.weekStart !== lastWeek).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  const pick = (w) => { if (busy) return; Sound.play("tap"); setWs(w); setErr(""); };
  const generate = async () => {
    if (!ts.length && !ms.length) { setErr("Nothing was due or added that week yet, so there's nothing to review."); Sound.play("err"); return; }
    setBusy(true); setLive(""); setErr("");
    const by = {};
    const slot = (s) => (by[s] = by[s] || { tasks: [], mats: [] });
    ts.forEach((t) => slot(t.subject).tasks.push(t));
    ms.forEach((m) => slot(m.subject || tasks.find((t) => t.id === m.taskId)?.subject || "Other").mats.push(m));
    const body = Object.entries(by).map(([s, d]) =>
      `SUBJECT: ${s}\nTasks:\n${d.tasks.map((t) => `- ${t.title} (${t.type}, due ${t.deadline})${t.notes ? `, notes: ${t.notes}` : ""}`).join("\n") || "- none"}\nMaterial:\n${d.mats.map((m) => `"${m.title}": ${m.text.slice(0, 1800)}`).join("\n") || "none"}`
    ).join("\n\n").slice(0, 11000);
    const next = tasks.filter((t) => t.deadline >= addDays(ws, 7) && t.deadline <= addDays(ws, 13)).map((t) => `${t.title} (${t.subject}, ${fmtDate(t.deadline)})`).join("; ");
    const system = `You write a weekly reviewer for a class, covering what the class worked on and learned. Plain text only, no markdown symbols, no emojis. Start with one sentence summing up the week. Then, for each subject, put the subject name on its own line, followed by 3 to 5 short lines on what was covered or assigned and the key facts to remember, then one self-check question. Take facts only from the material provided. When a subject has only a task title and notes and no material, say what was assigned and do not invent lesson content. Finish with a short "Coming up" line using the next-week list. Keep it under 550 words.`;
    try {
      const full = await streamClaude(system, [{ role: "user", content: `Week of ${weekLabel(ws)}.\n\n${body}\n\nComing next week: ${next || "nothing listed yet"}` }], (t) => setLive(t));
      if (!full.trim()) throw new Error("empty");
      saveWeekly(ws, full.trim());
      Sound.play("bell");
    } catch {
      setErr("The assistant couldn't write the reviewer just now. Try again in a moment."); Sound.play("err");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ marginTop: 14 }}>
      <div className="chips" style={{ padding: "0 0 4px" }}>
        <button className="chip" aria-pressed={ws === thisWeek} onClick={() => pick(thisWeek)}>This week</button>
        <button className="chip" aria-pressed={ws === lastWeek} onClick={() => pick(lastWeek)}>Last week</button>
      </div>
      <h2 className="sectionTitle" style={{ marginTop: 14 }}>{weekLabel(ws)}</h2>
      <p className="meta" style={{ margin: "0 0 18px" }}>
        {ts.length} {ts.length === 1 ? "task" : "tasks"} due, {ms.length} {ms.length === 1 ? "item" : "items"} of material
      </p>
      {busy && !live && <Waiting lines={["Gathering the week", "Pulling out the key points", "Writing it up"]} />}
      {shown && <div className="serif" style={{ fontSize: 17, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{shown}</div>}
      {saved && !busy && <p className="meta" style={{ marginTop: 14 }}>Made by {saved.by}, {timeAgo(saved.at)}. Everyone in the class can read this.</p>}
      {!saved && !busy && !err && <p style={{ color: C.muted, margin: "0 0 4px" }}>No reviewer for this week yet. It pulls together every task and note from the week into one page.</p>}
      {err && <p className="err">{err}</p>}
      {!busy && (
        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <button className={saved ? "btn ghost" : "btn accent"} onClick={generate}>{saved ? "Make it again" : "Make the reviewer"}</button>
          {saved && <button className="btn accent" onClick={() => setQuiz(true)}>Quiz me</button>}
          {saved && <button className="btn ghost" onClick={() => setCards(true)}>Flashcards</button>}
          <Sheet open={quiz} onClose={() => setQuiz(false)} title="Quiz me">
            {quiz && <PracticeQuiz task={wkTask} materials={wkMats} onClose={() => setQuiz(false)} />}
          </Sheet>
          <Sheet open={cards} onClose={() => setCards(false)} title="Flashcards">
            {cards && <Flashcards task={wkTask} materials={wkMats} onClose={() => setCards(false)} />}
          </Sheet>
          {saved && (
            <button className="btn ghost" onClick={async () => { const ok = await copyText(saved.text); setCopied(ok); if (ok) Sound.play("pop"); setTimeout(() => setCopied(false), 1800); }}>
              <Copy size={15} style={{ verticalAlign: -2, marginRight: 6 }} />{copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
      )}
      {earlier.length > 0 && (
        <section className="group">
          <h3>Earlier weeks <small>{earlier.length}</small></h3>
          {earlier.map((w) => (
            <button key={w.id} className="row" onClick={() => pick(w.weekStart)}>
              <div className="rowMain">
                <div className="rowTitle">{weekLabel(w.weekStart)}</div>
                <div className="rowMeta"><span>Made by {w.by}</span></div>
              </div>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

function Library({ tasks, materials, user, removeMaterial }) {
  const [subj, setSubj] = useState("All");
  const [open, setOpen] = useState(null);
  const all = materials.map((m) => {
    const t = tasks.find((x) => x.id === m.taskId);
    return { ...m, subject: m.subject || t?.subject || "Other", taskTitle: m.taskTitle || t?.title || "Removed task", gone: !t };
  });
  const subjects = [...new Set(all.map((m) => m.subject))];
  const list = all.filter((m) => subj === "All" || m.subject === subj).sort((a, b) => b.at - a.at);
  return (
    <div style={{ marginTop: 14 }}>
      <p style={{ color: C.muted, margin: "0 0 4px", lineHeight: 1.5 }}>
        {all.length} {all.length === 1 ? "item" : "items"} of material and {tasks.length} tasks on record. Everything stays here, even after a task is finished or removed.
      </p>
      {subjects.length > 0 && (
        <div className="chips">
          {["All", ...subjects].map((s) => (
            <button key={s} className="chip" aria-pressed={subj === s} onClick={() => { Sound.play("tap"); setSubj(s); }}>
              {s !== "All" && <span className="dot" style={{ background: subjColor(s), margin: 0 }} />}{s}
            </button>
          ))}
        </div>
      )}
      {list.length === 0 && <div className="empty"><div className="serif">Nothing stored yet</div>Notes, uploads and reviewers collect here as your class adds them.</div>}
      {list.map((m) => (
        <div className="mat" key={m.id}>
          <button className="matHead" onClick={() => { Sound.play("tap"); setOpen(open === m.id ? null : m.id); }} aria-expanded={open === m.id}>
            <span>
              <span style={{ fontWeight: 500 }}>{m.title}</span>
              {m.kind === "ai" && <span className="tag">Assistant</span>}
              <span className="rowMeta" style={{ marginTop: 2 }}>
                <span><span className="dot" style={{ background: subjColor(m.subject) }} />{m.subject}</span>
                <span>{m.taskTitle}{m.gone ? " (task removed)" : ""}</span>
                <span>{fmtDate(toISO(new Date(m.at)))}</span>
              </span>
            </span>
            <ChevronDown size={18} style={{ stroke: "var(--faint)", flex: "none", transform: open === m.id ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </button>
          {open === m.id && (
            <>
              <div className="matBody">{m.text}</div>
              <p className="meta" style={{ margin: "-6px 0 10px" }}>Added by {m.by}</p>
              {(m.by === user || m.kind === "ai") && (
                <button className="back" style={{ color: C.danger, marginBottom: 12 }} onClick={() => removeMaterial(m.id)}>
                  <Trash2 size={14} style={{ marginRight: 6 }} />Remove
                </button>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function ReviewTab({ tasks, progress, materials, weeklies, saveWeekly, user, addMaterial, removeMaterial, focusId, clearFocus, reviewStart, clearStart, onRefresh }) {
  const [sel, setSel] = useState(focusId || null);
  const [all, setAll] = useState(false);
  const [section, setSection] = useState("tasks");
  const [startWs, setStartWs] = useState(null);
  useEffect(() => {
    if (reviewStart) { setSection(reviewStart.section); setStartWs(reviewStart.ws || null); setSel(null); clearStart(); }
  }, [reviewStart]);
  useEffect(() => { if (focusId) { setSel(focusId); clearFocus(); } }, [focusId]);
  const task = tasks.find((t) => t.id === sel);
  if (task) return <ReviewDetail task={task} user={user} materials={materials} addMaterial={addMaterial} removeMaterial={removeMaterial} onBack={() => setSel(null)} />;
  const sorted = [...tasks].sort((a, b) => a.deadline.localeCompare(b.deadline));
  const upcoming = sorted.filter((t) => (progress[t.id] || "todo") !== "done");
  const list = upcoming.filter((t) => all || REVIEW_TYPES.includes(t.type) || materials.some((m) => m.taskId === t.id));
  return (
    <Scroll onRefresh={onRefresh}>
      <h1 className="h1">Review</h1>
      <p className="sub">
        {section === "tasks" ? "Pick a quiz or study task to see shared notes, get a reviewer, practice, or flip flashcards."
          : section === "weekly" ? "One page covering what the class worked on and learned each week."
          : "Every note, upload and reviewer your class has stored."}
      </p>
      <Segmented value={section} onChange={setSection} options={[["tasks", "By task"], ["weekly", "Weekly"], ["library", "Library"]]} />
      {section === "weekly" && <WeeklyReviewer key={startWs || "w"} initialWs={startWs} tasks={tasks} materials={materials} weeklies={weeklies} user={user} saveWeekly={saveWeekly} />}
      {section === "library" && <Library tasks={tasks} materials={materials} user={user} removeMaterial={removeMaterial} />}
      {section === "tasks" && (
        <div style={{ marginTop: 14 }}>
          <Segmented value={all ? "all" : "focus"} onChange={(v) => setAll(v === "all")} options={[["focus", "Quizzes and study"], ["all", "Everything"]]} />
        </div>
      )}
      {section === "tasks" && list.length === 0 && <div className="empty"><div className="serif">No quizzes coming up</div>Switch to Everything to review any task.</div>}
      <div style={{ marginTop: 14, display: section === "tasks" ? "block" : "none" }}>
        {list.map((t) => {
          const n = materials.filter((m) => m.taskId === t.id).length;
          return (
            <button key={t.id} className="row" onClick={() => { Sound.play("tap"); setSel(t.id); }}>
              <div className="rowMain">
                <div className="rowTitle">{t.title}</div>
                <div className="rowMeta">
                  <span><span className="dot" style={{ background: subjColor(t.subject) }} />{t.subject}</span>
                  <span>{t.type}</span>
                  <span>{n === 0 ? "No material yet" : n === 1 ? "1 item of material" : `${n} items of material`}</span>
                </div>
              </div>
              <div className="rowRight"><div className={diffDays(t.deadline) < 0 ? "late" : ""}>{relLabel(t.deadline)}</div></div>
            </button>
          );
        })}
      </div>
    </Scroll>
  );
}/* ───────────────────────── ask ───────────────────────── */

function AskTab({ user, tasks, materials, progress, addTask }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);
  const send = async (override) => {
    const q = (override ?? text).trim();
    if (!q || busy) return;
    setText("");
    Sound.play("send");
    const next = [...msgs, { role: "user", text: q, raw: q }];
    const idx = next.length;
    setMsgs([...next, { role: "ai", text: "", raw: "", added: [] }]);
    setBusy(true);
    const ctx = buildContext(tasks, materials, progress, user);
    const subjects = [...new Set(tasks.map((t) => t.subject))].join(", ") || "none yet";
    const system = `You are the built-in assistant inside Homeroom, a shared class reminders app. Today is ${ctx.today}. You are talking with ${user}.
Everything the class has added so far:
${ctx.list}
Shared review material:
${ctx.mats}
Existing subjects: ${subjects}.
You can answer questions about due dates, what is due today or this week, guidelines, priorities, and help with review using the material above. Be brief and direct. Resolve words like "Friday" or "next Monday" against today's date.
Write your reply as plain conversational text with no markdown and no emojis.
When the person asks you to add an assignment, quiz, or other task, add it. If the subject or due date is missing and cannot be inferred, ask one short question instead and add nothing. Reuse an existing subject name when one fits. taskType must be one of: ${TYPES.join(", ")}. priority must be High, Medium, or Low (default Medium unless they say otherwise). deadline must be YYYY-MM-DD. To add tasks, finish your reply with a new line containing exactly <<ACTIONS>> and straight after it a JSON array like [{"type": "add_task", "title":string, "subject":string, "taskType":string, "priority":string, "deadline":"YYYY-MM-DD", "notes":string}]. Only use the marker when you are actually adding something, and never mention the marker or JSON in your reply.`;
    const apiMsgs = next.slice(-10).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.raw || m.text || "..." }));
    try {
      const full = await streamClaude(system, apiMsgs, (t) => {
        const cut = t.indexOf("<<");
        const shown = (cut >= 0 ? t.slice(0, cut) : t).trimEnd();
        setMsgs((m) => m.map((x, i) => (i === idx ? { ...x, text: shown, raw: t } : x)));
      });
      const mi = full.indexOf("<<ACTIONS>>");
      let actions = [];
      if (mi >= 0) {
        const tail = full.slice(mi + 11);
        try {
          const arr = JSON.parse(tail.slice(tail.indexOf("["), tail.lastIndexOf("]") + 1));
          if (Array.isArray(arr)) actions = arr;
        } catch {}
      }
      const added = [];
      for (const a of actions) {
        if (a?.type === "add_task" && a.title && a.subject && /^\d{4}-\d{2}-\d{2}$/.test(a.deadline || "")) {
          const t = {
            id: uid(), title: String(a.title).slice(0, 120), subject: String(a.subject).slice(0, 40),
            type: TYPES.includes(a.taskType) ? a.taskType : "Homework",
            priority: PRIORITIES.includes(a.priority) ? a.priority : "Medium",
            deadline: a.deadline, notes: String(a.notes || "").slice(0, 600), addedBy: user, createdAt: Date.now(),
          };
          addTask(t);
          added.push(t);
        }
      }
      const reply = (mi >= 0 ? full.slice(0, mi) : full).trim();
      setMsgs((m) => m.map((x, i) => (i === idx ? { ...x, text: reply || "Done.", raw: full, added } : x)));
      Sound.play(added.length ? "add" : "pop");
    } catch {
      setMsgs((m) => m.map((x, i) => (i === idx ? { ...x, text: "I couldn't reach the assistant just now. Check your connection and try again.", raw: "" } : x)));
      Sound.play("err");
    } finally {
      setBusy(false);
    }
  };
  const suggestions = ["What's due today?", "What's due this week?", "Plan my evening. I have about 2 hours.", "Add a math quiz this Friday", "What are the guidelines for Math quiz 2.1?"];
  return (
    <div className="chat">
      <div className="msgs">
        {msgs.length === 0 && (
          <>
            <h1 className="h1">Ask anything about class.</h1>
            <p className="sub" style={{ marginBottom: 0 }}>It knows every task, deadline, and note your class has added, plus the shared review material.</p>
            <div className="suggest">{suggestions.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}</div>
          </>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role === "user" ? "me" : "ai"}`}>
            {m.role === "ai" && !m.text && busy ? <span style={{ color: C.faint }}><Dots /></span> : m.text}
            {m.added?.map((t) => (
              <div className="added" key={t.id}>
                <b>Added to the class list</b>
                {t.title}, {t.subject}, due {fmtDate(t.deadline)}
              </div>
            ))}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="composer" style={{ marginBottom: 62 }}>
        <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask or add a task"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="send" onClick={() => send()} disabled={!text.trim() || busy} aria-label="Send"><ArrowUp size={20} /></button>
      </div>
    </div>
  );
}

/* ───────────────────────── comments ───────────────────────── */

function Comments({ taskId, comments, user, isAdmin, onAdd, onRemove }) {
  const list = comments.filter((c) => c.taskId === taskId).sort((a, b) => a.at - b.at);
  const [text, setText] = useState("");
  const post = () => { if (!text.trim()) return; onAdd(taskId, text.trim()); setText(""); };
  return (
    <div>
      <h2 className="sectionTitle" style={{ marginTop: 28 }}>Comments{list.length ? <small style={{ fontFamily: SANS, fontSize: 13, color: C.faint, marginLeft: 8 }}>{list.length}</small> : null}</h2>
      {list.length === 0 && <p style={{ color: C.muted, margin: 0, fontSize: 14 }}>Questions about this task go here, like which page or what to bring.</p>}
      {list.map((c) => (
        <div className="cmt" key={c.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span><b>{c.by}</b> <span className="meta" style={{ marginLeft: 6 }}>{timeAgo(c.at)}</span></span>
            {(c.by === user || isAdmin) && <button className="back" style={{ padding: 0, fontSize: 13 }} onClick={() => onRemove(c.id)}>Delete</button>}
          </div>
          <p style={{ margin: "4px 0 0", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.text}</p>
        </div>
      ))}
      <div className="cmtIn">
        <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment" aria-label="Add a comment"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); post(); } }} />
        <button className="send" onClick={post} disabled={!text.trim()} aria-label="Post comment"><ArrowUp size={20} /></button>
      </div>
    </div>
  );
}

/* ───────────────────────── minecraft + feedback ───────────────────────── */

const MC_NAME = /^[A-Za-z0-9_]{3,16}$/;

/* NEW — server connection details, shown after the edition is picked */
const SERVER_INFO = {
  version: "26.1.2",
  java: {
    address: "wills-cheque.tun.ply.gg",
    ipv6: "[2001:4451:877a:5c00:aeda:30d4:1189:4303]:25565",
  },
  bedrock: {
    address: "laurel-inviting.tun.ply.gg",
    alt: "147.185.221.213",
    port: "47210",
  },
};

function MinecraftPanel({ record, done, total, onSave, onClose }) {
  const [name, setName] = useState(record?.mcName || "");
  const [friends, setFriends] = useState(record?.friends || []);
  const [edition, setEdition] = useState(record?.edition || null); // NEW
  const [copiedKey, setCopiedKey] = useState(null); // NEW
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const status = record?.status;
  const setF = (k, key, v) => setFriends((fs) => fs.map((f, i) => (i === k ? { ...f, [key]: v } : f)));
  const copyField = async (key, text) => { // NEW
    const ok = await copyText(text);
    if (ok) { Sound.play("pop"); setCopiedKey(key); setTimeout(() => setCopiedKey(null), 1800); }
  };
  const Addr = ({ label, value, k }) => ( // NEW
    <div style={{ marginBottom: 10 }}>
      <div className="meta" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <code className="cmd" style={{ flex: 1, margin: 0 }}>{value}</code>
        <button className="iconBtn" style={{ flex: "none" }} onClick={() => copyField(k, value)} aria-label={`Copy ${label}`}>
          {copiedKey === k ? <Check size={17} style={{ stroke: "var(--ok)" }} /> : <Copy size={17} />}
        </button>
      </div>
    </div>
  );
  const submit = async () => {
    setErr(""); setSaved(false);
    if (!MC_NAME.test(name.trim())) return setErr("Minecraft usernames are 3 to 16 characters: letters, numbers and underscores.");
    const clean = friends.filter((f) => f.name.trim()).map((f) => ({ name: f.name.trim(), school: (f.school || "").trim(), unbanned: !!f.unbanned }));
    for (const f of clean) if (!MC_NAME.test(f.name)) return setErr(`"${f.name}" isn't a valid Minecraft username.`);
    const all = [name.trim(), ...clean.map((f) => f.name)].map((n) => n.toLowerCase());
    if (new Set(all).size !== all.length) return setErr("Each username can only be listed once.");
    setBusy(true);
    try {
      await onSave({ mcName: name.trim(), friends: clean, edition }); // NEW — edition saved with the request
      setSaved(true); Sound.play("add");
    } catch {
      setErr("Couldn't send that. Check your connection and try again."); Sound.play("err");
    } finally {
      setBusy(false);
    }
  };
  const intro =
    status === "unbanned" ? "You're unbanned. See you on the server."
    : status === "ready" ? "You finished everything. The admin has been told and will unban you."
    : record ? `You've finished ${done} of ${total} tasks. Finish all of them and the admin is told automatically.`
    : "Enter your Minecraft username, plus any friends from other sections or schools who also need to be unbanned. Finish every task on the class list and the admin is told automatically.";
  return (
    <div>
      <p style={{ margin: "0 0 6px", lineHeight: 1.55 }}>{intro}</p>
      {record && status === "requested" && <div className="bar"><i style={{ width: total ? `${(done / total) * 100}%` : "0%" }} /></div>}
      {/* NEW — ask the edition first, then show the right addresses */}
      <div style={{ background: C.wash, borderRadius: 14, padding: 16, margin: "14px 0 18px" }}>
        <div style={{ fontWeight: 500, marginBottom: 10 }}>Join the server</div>
        <Segmented value={edition} onChange={setEdition} options={[["java", "Java"], ["bedrock", "Bedrock"]]} />
        {!edition && <p className="meta" style={{ margin: "12px 0 0" }}>Are you on Java or Bedrock? Pick one to see the address.</p>}
        {edition === "java" && (
          <div style={{ marginTop: 14 }}>
            <Addr label="Server address" value={SERVER_INFO.java.address} k="java" />
            <p className="meta" style={{ margin: "2px 0 0", lineHeight: 1.55 }}>
              Version {SERVER_INFO.version}. If you know how to set up IPv6, you can connect directly with {SERVER_INFO.java.ipv6} instead.
            </p>
          </div>
        )}
        {edition === "bedrock" && (
          <div style={{ marginTop: 14 }}>
            <Addr label="Server address" value={SERVER_INFO.bedrock.address} k="bedrock" />
            <Addr label="Or the numeric address" value={SERVER_INFO.bedrock.alt} k="bedrockAlt" />
            <Addr label="Port" value={SERVER_INFO.bedrock.port} k="bedrockPort" />
            <p className="meta" style={{ margin: "2px 0 0" }}>Version {SERVER_INFO.version}.</p>
          </div>
        )}
      </div>
      <div className="field">
        <label htmlFor="mc">Your Minecraft username</label>
        <input id="mc" className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={status === "unbanned"}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      </div>
      <div className="field">
        <label>Friends who need to be unbanned</label>
        {friends.map((f, k) => (
          <div className="fr" key={k}>
            <input className="input" placeholder="Username" value={f.name} disabled={f.unbanned}
              onChange={(e) => setF(k, "name", e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            <input className="input" placeholder="School or section" value={f.school || ""} disabled={f.unbanned}
              onChange={(e) => setF(k, "school", e.target.value)} />
            {f.unbanned ? (
              <span className="meta" title="Unbanned"><Check size={18} style={{ stroke: "var(--accent)" }} /></span>
            ) : (
              <button className="iconBtn" aria-label="Remove friend" onClick={() => setFriends((fs) => fs.filter((_, i) => i !== k))}><X size={18} /></button>
            )}
          </div>
        ))}
        <button className="btn ghost small" disabled={friends.length >= 8} onClick={() => setFriends((fs) => [...fs, { name: "", school: "" }])}>
          <Plus size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Add a friend
        </button>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="btn accent" disabled={busy || !name.trim()} onClick={submit}>
          {busy ? <>Sending<Dots /></> : record ? "Save changes" : "Send to admin"}
        </button>
        <button className="btn ghost" onClick={onClose}>Close</button>
        {saved && <span className="meta">Saved</span>}
      </div>
    </div>
  );
}

function FeedbackForm({ onSend, onClose }) {
  const [kind, setKind] = useState("problem");
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  if (sent) {
    return (
      <div className="empty">
        <div className="serif">Sent</div>
        The admin will see it in the app.
        <div><button className="btn" style={{ marginTop: 18 }} onClick={onClose}>Done</button></div>
      </div>
    );
  }
  return (
    <div>
      <div className="field"><Segmented value={kind} onChange={setKind} options={[["problem", "Something's wrong"], ["request", "Add something"]]} /></div>
      <div className="field">
        <label htmlFor="fb">{kind === "problem" ? "What happened?" : "What would you like added?"}</label>
        <textarea id="fb" className="input" style={{ minHeight: 120 }} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <button className="btn accent full" disabled={!text.trim() || busy}
        onClick={async () => { setBusy(true); await onSend(kind, text.trim()); Sound.play("add"); setSent(true); }}>
        Send to admin
      </button>
    </div>
  );
}

/* ───────────────────────── admin ───────────────────────── */

const INBOX_LABEL = { problem: "Problem", request: "Request", minecraft: "Minecraft" };

function McItem({ r, prefix, onUpdate, onDelete }) {
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const ownerOut = r.status === "unbanned";
  const everyoneOut = ownerOut && r.friends.every((f) => f.unbanned);
  const pending = [...(ownerOut ? [] : [r.mcName]), ...r.friends.filter((f) => !f.unbanned).map((f) => f.name)];
  const cmd = pending.map((n) => `${prefix}pardon ${n}`).join("\n");
  const copy = async () => {
    const ok = await copyText(cmd);
    setCopied(ok); if (ok) Sound.play("pop");
    setTimeout(() => setCopied(false), 1800);
  };
  const people = [
    {
      name: r.mcName,
      sub: `Account: ${r.owner}${r.edition ? ` · ${r.edition === "bedrock" ? "Bedrock" : "Java"}` : ""}`, // NEW — shows their edition
      out: ownerOut,
      toggle: () => onUpdate(r.owner, (c) => ({
        ...c,
        status: ownerOut ? (c.total > 0 && c.done === c.total ? "ready" : "requested") : "unbanned",
        unbannedAt: ownerOut ? null : Date.now(),
      })),
    },
    ...r.friends.map((f, i) => ({
      name: f.name, sub: f.school || "No school listed", out: !!f.unbanned,
      toggle: () => onUpdate(r.owner, (c) => ({ ...c, friends: c.friends.map((x, k) => (k === i ? { ...x, unbanned: !x.unbanned } : x)) })),
    })),
  ];
  return (
    <div className="item">
      <div className="meta" style={{ marginBottom: 4 }}>
        {r.done ?? 0} of {r.total ?? 0} tasks done{r.status === "ready" && r.readyAt ? `, finished ${timeAgo(r.readyAt)}` : ""}
      </div>
      {people.map((p, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 500 }}>{p.name}</div>
            <div className="meta">{p.sub}</div>
          </div>
          <button className="chip" aria-pressed={p.out} onClick={() => { Sound.play(p.out ? "undo" : "done"); p.toggle(); }}>{p.out ? "Unbanned" : "Mark unbanned"}</button>
        </div>
      ))}
      {pending.length > 0 && (
        <>
          <div className="cmd">{cmd}</div>
          <button className="btn ghost small" onClick={copy}>
            <Copy size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{copied ? "Copied" : "Copy commands"}
          </button>
        </>
      )}
      <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
        {!everyoneOut ? (
          <button className="btn accent small" onClick={() => { Sound.play("bell"); onUpdate(r.owner, (c) => ({ ...c, status: "unbanned", unbannedAt: Date.now(), friends: c.friends.map((f) => ({ ...f, unbanned: true })) })); }}>
            Mark everyone unbanned
          </button>
        ) : (
          <button className="back" onClick={() => onUpdate(r.owner, (c) => ({ ...c, status: c.total > 0 && c.done === c.total ? "ready" : "requested", unbannedAt: null, friends: c.friends.map((f) => ({ ...f, unbanned: false })) }))}>
            Reopen
          </button>
        )}
        <button className="back" style={{ color: C.danger }} onClick={() => (confirm ? onDelete(r.owner) : setConfirm(true))}>
          {confirm ? "Tap again to remove" : "Remove request"}
        </button>
      </div>
    </div>
  );
}

function AdminTab({ inbox, records, announcements, markRead, dismiss, updateMc, deleteMc, postAnn, removeAnn, onRefresh }) {
  const [section, setSection] = useState("inbox");
  const [mode, setMode] = useState("console");
  const [annText, setAnnText] = useState("");
  const prefix = mode === "game" ? "/" : "";
  const unread = inbox.filter((i) => !i.read).length;
  const items = [...inbox].sort((a, b) => b.at - a.at);
  const allOut = (r) => r.status === "unbanned" && r.friends.every((f) => f.unbanned);
  const groups = [
    ["Ready to unban", records.filter((r) => !allOut(r) && (r.status === "ready" || r.status === "unbanned"))],
    ["Still working on it", records.filter((r) => r.status === "requested")],
    ["Unbanned", records.filter(allOut)],
  ];
  const readyCount = groups[0][1].length;
  const anns = [...announcements].sort((a, b) => b.at - a.at);
  return (
    <Scroll onRefresh={onRefresh}>
      <h1 className="h1">Admin</h1>
      <p className="sub">Messages from the class, Minecraft requests, and announcements.</p>
      <Segmented value={section} onChange={setSection}
        options={[["inbox", `Inbox${unread ? ` (${unread})` : ""}`], ["minecraft", `Minecraft${readyCount ? ` (${readyCount})` : ""}`], ["announce", "Announce"]]} />
      {section === "inbox" && (
        <div style={{ marginTop: 10 }}>
          {unread > 0 && <button className="back" onClick={() => markRead("all")}>Mark all read</button>}
          {items.length === 0 && <div className="empty"><div className="serif">Inbox is empty</div>Problems, requests and Minecraft updates will show up here.</div>}
          {items.map((i) => (
            <div className="item" key={i.id}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span className="dot" style={{ background: i.read ? "transparent" : C.accent, border: i.read ? `1px solid ${C.line}` : "0", marginTop: 6, marginRight: 0, flex: "none" }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500 }}>{INBOX_LABEL[i.type] || "Message"} from {i.from}</div>
                  <div className="meta">{timeAgo(i.at)}</div>
                  <p style={{ margin: "8px 0 0", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{i.text}</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 8, paddingLeft: 18 }}>
                {!i.read && <button className="back" onClick={() => markRead(i.id)}>Mark read</button>}
                <button className="back" onClick={() => dismiss(i.id)}>Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {section === "minecraft" && (
        <div style={{ marginTop: 14 }}>
          <Segmented value={mode} onChange={setMode} options={[["console", "Server console"], ["game", "In-game chat"]]} />
          <p className="meta" style={{ margin: "10px 0 0", lineHeight: 1.5 }}>Homeroom can't reach your server. Copy the commands and run them yourself.</p>
          {records.length === 0 && <div className="empty"><div className="serif">No requests yet</div>When someone sends their username it will appear here.</div>}
          {groups.map(([label, list]) => list.length > 0 && (
            <section className="group" key={label}>
              <h3>{label}<small>{list.length}</small></h3>
              {list.map((r) => <McItem key={r.owner} r={r} prefix={prefix} onUpdate={updateMc} onDelete={deleteMc} />)}
            </section>
          ))}
        </div>
      )}
      {section === "announce" && (
        <div style={{ marginTop: 16 }}>
          <div className="field">
            <label htmlFor="an">New announcement</label>
            <textarea id="an" className="input" value={annText} onChange={(e) => setAnnText(e.target.value)} placeholder="Shows at the top of everyone's Tasks tab" />
          </div>
          <button className="btn accent" disabled={!annText.trim()} onClick={() => { postAnn(annText.trim()); setAnnText(""); }}>Post to everyone</button>
          {anns.length > 0 && <h2 className="sectionTitle">Posted</h2>}
          {anns.map((a) => (
            <div className="item" key={a.id}>
              <div className="meta">{timeAgo(a.at)}</div>
              <p style={{ margin: "4px 0 8px", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{a.text}</p>
              <button className="back" style={{ color: C.danger, padding: 0 }} onClick={() => removeAnn(a.id)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </Scroll>
  );
}

/* ───────────────────────── app ───────────────────────── */

export default function App() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [comments, setComments] = useState([]);
  const [completions, setCompletions] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [weeklies, setWeeklies] = useState([]);
  const [classId, setClassId] = useState(null);
  const [classes, setClasses] = useState([]);
  const [reviewStart, setReviewStart] = useState(null);
  const classRef = useRef(null); classRef.current = classId;
  const [progress, setProgress] = useState({});
  const [tab, setTab] = useState("tasks");
  const [ui, setUi] = useState({ view: "upcoming", subj: "All", mode: "list", kind: "All", group: "date" });
  const [dismissedAnn, setDismissedAnn] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [form, setForm] = useState(null);
  const [reviewFocus, setReviewFocus] = useState(null);
  const [menu, setMenu] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [syncErr, setSyncErr] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [inbox, setInbox] = useState([]);
  const [records, setRecords] = useState([]);
  const [myMc, setMyMc] = useState(null);
  const [mcOpen, setMcOpen] = useState(false);
  const [fbOpen, setFbOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [intro, setIntro] = useState(false); // NEW — first-run welcome tour
  const [theme, setTheme] = useState("auto");
  const [audio, setAudio] = useState({ sfx: true, music: false, vol: 0.5 });
  const [sysDark, setSysDark] = useState(() => (window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)").matches : false));
  const isAdmin = user === ADMIN_USERNAME;
  const dark = theme === "dark" || (theme === "auto" && sysDark);
  const progressRef = useRef(progress); progressRef.current = progress;
  const tasksRef = useRef(tasks); tasksRef.current = tasks;
  const myMcRef = useRef(myMc); myMcRef.current = myMc;
  const lastSync = useRef(0);
  const prevUnread = useRef(null);
  const toastTimer = useRef(null);
  const backfilled = useRef(false);

  /* ----- loading ----- */

  const loadShared = async (u, c) => {
    const cid = c || classRef.current;
    setClasses((await store.get("classes", true)) || []);
    if (!cid) return;
    const k = (x) => `${cid}:${x}`;
    const [t, mats, cm, comp, ann, wk] = await Promise.all([
      store.get(k("tasks"), true), store.get(k("materials"), true), store.get(k("comments"), true),
      store.get(k("completions"), true), store.get(k("announcements"), true), store.get(k("weeklies"), true),
    ]);
    setTasks(t || []); setMaterials(mats || []); setComments(cm || []); setCompletions(comp || {}); setAnnouncements(ann || []); setWeeklies(wk || []);
    if (!u) return;
    setMyMc(await store.get(`mc:${u}`, true));
    if (u === ADMIN_USERNAME) {
      const inb = (await store.get("inbox", true)) || [];
      const un = inb.filter((i) => !i.read).length;
      if (prevUnread.current !== null && un > prevUnread.current) Sound.play("bell");
      prevUnread.current = un;
      setInbox(inb);
     try {
const rows = await store.listShared("mc:");
setRecords(rows.map((r) => r.value).filter(Boolean));
} catch { setRecords([]); }
    }
  };

  const refresh = useCallback(async (force = false) => {
    if (!user) return;
    if (!force && Date.now() - lastSync.current < 8000) return;
    lastSync.current = Date.now();
    setSyncing(true);
    try { await loadShared(user); } finally { setSyncing(false); }
  }, [user]);

  useEffect(() => {
    (async () => {
      const [sess, th, au] = await Promise.all([store.get("session"), store.get("theme"), store.get("audio")]);
      if (th) setTheme(th);
      if (au) setAudio((a) => ({ ...a, ...au }));
      if (!sess?.username) { setReady(true); return; }
      const u = sess.username;
      setUser(u);
      const [prog, cache, pf, rec] = await Promise.all([store.get(`progress:${u}`), store.get(`cache:${u}`), store.get(`prefs:${u}`), store.get(`users:${u}`, true)]);
      const cid = rec?.classId || null;
      classRef.current = cid; setClassId(cid);
      setProgress(prog || {});
      if (pf) {
        if (pf.ui) setUi((x) => ({ ...x, ...pf.ui }));
        if (pf.dismissedAnn) setDismissedAnn(pf.dismissedAnn);
        if (pf.tab && (pf.tab !== "admin" || u === ADMIN_USERNAME)) setTab(pf.tab);
      }
      if (cache && cid) {
        // Instant open: show what we had last time, then quietly catch up.
        setTasks(cache.tasks || []); setMaterials(cache.materials || []); setComments(cache.comments || []);
        setCompletions(cache.completions || {}); setAnnouncements(cache.announcements || []); setWeeklies(cache.weeklies || []);
        setReady(true);
        lastSync.current = Date.now(); setSyncing(true);
        try { await loadShared(u); } finally { setSyncing(false); }
      } else {
        await Promise.all([loadShared(u), new Promise((r) => setTimeout(r, 900))]);
        lastSync.current = Date.now();
        setReady(true);
      }
    })();
  }, []);

  // Sync when the app is opened or comes back to the front, not on a timer.
  useEffect(() => {
    if (!user) return;
    const onVis = () => {
      if (document.visibilityState === "visible") { Sound.resume(); refresh(); } else Sound.pause();
    };
    const onFocus = () => refresh();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onFocus); };
  }, [user, refresh]);

  /* ----- remember things ----- */

  useEffect(() => {
    if (!user || !ready) return;
    store.set(`prefs:${user}`, { tab, ui, dismissedAnn });
  }, [tab, ui, dismissedAnn, user, ready]);

  useEffect(() => {
    if (!user || !ready) return;
    const id = setTimeout(() => store.set(`cache:${user}`, { tasks, materials, comments, completions, announcements, weeklies }), 900);
    return () => clearTimeout(id);
  }, [tasks, materials, comments, completions, announcements, weeklies, user, ready]);

  useEffect(() => { store.set("theme", theme); }, [theme]);
  useEffect(() => { store.set("audio", audio); Sound.setSfx(audio.sfx); Sound.setVolume(audio.vol); }, [audio]);

  /* ----- theme + music ----- */

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = (e) => setSysDark(e.matches);
    mq.addEventListener && mq.addEventListener("change", h);
    return () => mq.removeEventListener && mq.removeEventListener("change", h);
  }, []);

  useEffect(() => { document.body.style.background = dark ? "#1B1A18" : "#FAF9F5"; }, [dark]);

  useEffect(() => {
    // Browsers only allow sound after a tap, so a saved "music on" starts on your first touch.
    if (!audio.music || !ready) return;
    const go = () => { if (!Sound.isMusic()) Sound.startMusic(); };
    window.addEventListener("pointerdown", go, { once: true });
    return () => window.removeEventListener("pointerdown", go);
  }, [audio.music, ready]);

  useEffect(() => () => Sound.stopMusic(), []);

  const toggleMusic = () => {
    const on = !audio.music;
    setAudio((a) => ({ ...a, music: on }));
    if (on) Sound.startMusic(); else Sound.stopMusic();
  };

  /* ----- toast ----- */

  const showToast = (msg, undo) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, undo, id: uid() });
    toastTimer.current = setTimeout(() => setToast(null), 5200);
  };

  /* ----- auth ----- */

  const chooseClass = async (cid) => {
    const rec = await store.get(`users:${user}`, true);
    if (rec) await store.set(`users:${user}`, { ...rec, classId: cid }, true);
    store.del(`cache:${user}`);
    classRef.current = cid; setClassId(cid);
    setTasks([]); setMaterials([]); setComments([]); setCompletions({}); setAnnouncements([]); setWeeklies([]);
    backfilled.current = false;
    setSyncing(true);
    try { await loadShared(user, cid); } finally { setSyncing(false); }
  };

  const onAuthed = async (u, cid) => {
    setReady(false);
    classRef.current = cid || null; setClassId(cid || null);
    setUser(u);
    setProgress((await store.get(`progress:${u}`)) || {});
    await Promise.all([loadShared(u), new Promise((r) => setTimeout(r, 900))]);
    lastSync.current = Date.now();
    // NEW — show the welcome tour once, only for brand-new accounts
    const seenIntro = await store.get(`intro:${u}`);
    if (!seenIntro) setIntro(true);
    setReady(true);
  };

  // NEW — marks the tour as seen so it never shows again for this account
  const finishIntro = async () => {
    if (user) await store.set(`intro:${user}`, true);
    setIntro(false);
    Sound.play("add");
  };

  const signOut = async () => {
    await store.del("session");
    Sound.stopMusic();
    setUser(null); setMenu(false); setTab("tasks");
    setTasks([]); setMaterials([]); setComments([]); setCompletions({}); setAnnouncements([]); setWeeklies([]);
    backfilled.current = false; prevUnread.current = null;
  };

  /* ----- data changes: update the screen first, save right after ----- */

  const mutate = async (key, setter, fn, empty = []) => {
    setter((c) => fn(c));
    const fk = ["tasks", "materials", "comments", "completions", "announcements", "weeklies"].includes(key) ? `${classRef.current}:${key}` : key;
    const cur = (await store.get(fk, true)) ?? empty;
    const ok = await store.set(fk, fn(cur), true);
    setSyncErr(!ok);
  };

  const addTask = (t) => mutate("tasks", setTasks, (c) => [...c, t]);
  const updateTask = (t) => mutate("tasks", setTasks, (c) => c.map((x) => (x.id === t.id ? t : x)));
  const deleteTask = (id) => {
    // Notes and uploads stay in the Library even after the task is gone.
    const task = tasks.find((t) => t.id === id);
    mutate("tasks", setTasks, (c) => c.filter((x) => x.id !== id));
    Sound.play("undo");
    if (task) showToast("Task deleted", () => addTask(task));
  };
  const saveWeekly = (weekStart, text) =>
    mutate("weeklies", setWeeklies, (c) => [...c.filter((w) => w.weekStart !== weekStart), { id: uid(), weekStart, text, by: user, at: Date.now() }]);
  const addMaterial = (m) => mutate("materials", setMaterials, (c) => [...c, m]);
  const removeMaterial = (id) => {
    const m = materials.find((x) => x.id === id);
    mutate("materials", setMaterials, (c) => c.filter((x) => x.id !== id));
    Sound.play("undo");
    if (m) showToast("Material removed", () => addMaterial(m));
  };
  const addComment = (taskId, text) => {
    Sound.play("send");
    mutate("comments", setComments, (c) => [...c, { id: uid(), taskId, by: user, text, at: Date.now() }]);
  };
  const removeComment = (id) => mutate("comments", setComments, (c) => c.filter((x) => x.id !== id));
  const postAnn = (text) => { Sound.play("add"); mutate("announcements", setAnnouncements, (c) => [...c, { id: uid(), text, at: Date.now(), by: user }]); };
  const removeAnn = (id) => mutate("announcements", setAnnouncements, (c) => c.filter((x) => x.id !== id));
  const dismissAnn = (id) => { Sound.play("tap"); setDismissedAnn((d) => [...d, id]); };
  const markCompletion = (id, done) =>
    mutate("completions", setCompletions, (c) => {
      const set = new Set(c[id] || []);
      if (done) set.add(user); else set.delete(user);
      return { ...c, [id]: [...set] };
    }, {});

  // Make sure tasks finished before this feature existed still count toward "N finished".
  useEffect(() => {
    if (!user || !ready || backfilled.current || !tasks.length) return;
    backfilled.current = true;
    const missing = tasks.filter((t) => progress[t.id] === "done" && !(completions[t.id] || []).includes(user));
    if (missing.length) {
      mutate("completions", setCompletions, (c) => {
        const n = { ...c };
        missing.forEach((t) => { n[t.id] = [...new Set([...(n[t.id] || []), user])]; });
        return n;
      }, {});
    }
  }, [ready, user, tasks.length]);

  /* ----- minecraft ----- */

  const pushInbox = async (item) => {
    const cur = (await store.get("inbox", true)) || [];
    await store.set("inbox", [...cur, { id: uid(), at: Date.now(), read: false, ...item }], true);
  };

  const saveMc = async (owner, fn) => {
    const cur = await store.get(`mc:${owner}`, true);
    const next = fn(cur);
    await store.set(`mc:${owner}`, next, true);
    if (owner === user) setMyMc(next);
    if (isAdmin) setRecords((rs) => (rs.some((r) => r.owner === owner) ? rs.map((r) => (r.owner === owner ? next : r)) : [...rs, next]));
    return next;
  };

  // Keeps the admin's view of progress current, and tells the admin the moment someone finishes everything.
  const syncMc = async (nextProgress, nextTasks) => {
    const rec = myMcRef.current;
    if (!rec) return;
    const total = nextTasks.length;
    const done = nextTasks.filter((t) => nextProgress[t.id] === "done").length;
    const becomesReady = rec.status === "requested" && total > 0 && done === total;
    if (!becomesReady && rec.done === done && rec.total === total) return;
    await saveMc(user, (c) => ({ ...c, done, total, ...(becomesReady ? { status: "ready", readyAt: Date.now() } : {}) }));
    if (becomesReady) {
      const who = [rec.mcName, ...rec.friends.map((f) => f.name)].join(", ");
      await pushInbox({ type: "minecraft", from: user, text: `${user} finished every task (${done} of ${total}). Ready to unban: ${who}.` });
    }
  };

  const submitMc = async ({ mcName, friends, edition }) => { // NEW — edition saved with the request
    const total = tasks.length;
    const done = tasks.filter((t) => progress[t.id] === "done").length;
    const cur = await store.get(`mc:${user}`, true);
    const merged = friends.map((f) => ({
      ...f, unbanned: cur?.friends?.find((x) => x.name.toLowerCase() === f.name.toLowerCase())?.unbanned || false,
    }));
    const base = cur || { owner: user, status: "requested", submittedAt: Date.now() };
    await saveMc(user, () => ({ ...base, mcName, friends: merged, done, total, ...(edition ? { edition } : {}) }));
    if (!cur) {
      const list = merged.map((f) => f.name + (f.school ? ` (${f.school})` : "")).join(", ");
      await pushInbox({
        type: "minecraft", from: user,
        text: `${user} asked to be unbanned as ${mcName}${merged.length ? `, with friends: ${list}` : ""}. They have finished ${done} of ${total} tasks.`,
      });
    }
    await syncMc(progress, tasks);
  };

  const sendFeedback = (type, text) => pushInbox({ type, from: user, text });
  const markRead = (id) => mutate("inbox", setInbox, (c) => c.map((i) => (id === "all" || i.id === id ? { ...i, read: true } : i)));
  const dismiss = (id) => mutate("inbox", setInbox, (c) => c.filter((i) => i.id !== id));
  const updateMc = (owner, fn) => saveMc(owner, (c) => fn(c));
  const deleteMc = async (owner) => {
    await store.del(`mc:${owner}`, true);
    setRecords((rs) => rs.filter((r) => r.owner !== owner));
  };

  /* ----- progress ----- */

  const setStatus = (id, s) => {
    const cur = progressRef.current;
    const prev = cur[id] || "todo";
    if (prev === s) return;
    const next = { ...cur, [id]: s };
    progressRef.current = next;
    setProgress(next);
    Sound.play(s === "done" ? "done" : s === "progress" ? "pop" : "undo");
    store.set(`progress:${user}`, next);
    if (s === "done" || prev === "done") markCompletion(id, s === "done");
    syncMc(next, tasksRef.current);
    if (s === "done") showToast("Marked done", () => setStatus(id, prev));
  };

  const subjects = useMemo(() => [...new Set([...DEFAULT_SUBJECTS, ...tasks.map((t) => t.subject)])], [tasks]);
  const detail = tasks.find((t) => t.id === detailId);
  const doneCount = tasks.filter((t) => progress[t.id] === "done").length;
  const unreadCount = inbox.filter((i) => !i.read).length;
  const themeAttr = dark ? "dark" : "light";

  if (!ready) {
    return <div className="hr" data-theme={themeAttr}><style>{CSS}</style><Splash /></div>;
  }
  if (!user) {
    return <div className="hr" data-theme={themeAttr}><style>{CSS}</style><Auth onAuthed={onAuthed} /></div>;
  }
  if (!classId) {
    return <div className="hr" data-theme={themeAttr}><style>{CSS}</style><ClassGate classes={classes} setClasses={setClasses} onChoose={chooseClass} /></div>;
  }
  // NEW — the welcome tour, shown once after a brand-new account is created
  if (intro) {
    const label = classes.find((c) => c.id === classId)?.label;
    return (
      <div className="hr" data-theme={themeAttr}>
        <style>{CSS}</style>
        <Intro user={user} classLabel={label} onDone={finishIntro} />
      </div>
    );
  }

  const classLabel = classes.find((c) => c.id === classId)?.label;
  const tabs = [
    ["tasks", "Tasks", ListChecks],
    ["review", "Review", BookOpen],
    ["ask", "Ask", MessageCircle],
    ...(isAdmin ? [["admin", "Admin", Shield]] : []),
  ];
  const finishedOthers = detail ? (completions[detail.id] || []).filter((u) => u !== user).length : 0;

  return (
    <div className="hr" data-theme={themeAttr}>
      <style>{CSS}</style>
      {syncing && <div className="sync" aria-hidden="true" />}
      <header className="head">
        <span><span className="mark">Homeroom</span>{classLabel && <span className="meta" style={{ marginLeft: 10 }}>{classLabel}</span>}</span>
        <div className="hdrRight">
          <button className="hdrBtn" aria-label="Search" onClick={() => { Sound.play("tap"); setSearchOpen(true); }}><Search size={17} /></button>
          <button className="hdrBtn" aria-label={audio.music ? "Turn music off" : "Turn music on"} aria-pressed={audio.music}
            style={audio.music ? { color: "var(--accent)", borderColor: "var(--accent)" } : undefined} onClick={toggleMusic}><Music size={17} /></button>
          <button className="hdrBtn wide" aria-label="Minecraft server access" onClick={() => { Sound.play("tap"); setMcOpen(true); }}><Gamepad2 size={17} /><span>Minecraft</span></button>
          <button className="avatar" onClick={() => { Sound.play("tap"); setMenu(true); }} aria-label="Account">{user[0].toUpperCase()}</button>
        </div>
      </header>
      {syncErr && <div style={{ background: "var(--errbg)", color: C.danger, fontSize: 13, padding: "8px 20px" }}>Your last change may not have saved. Check your connection.</div>}
      {tab === "tasks" && (
        <TasksTab user={user} tasks={tasks} progress={progress} completions={completions}
          announcements={announcements.filter((a) => !dismissedAnn.includes(a.id))} dismissAnn={dismissAnn}
          weeklies={weeklies} onOpenWeekly={(ws) => { setReviewStart({ section: "weekly", ws }); setTab("review"); }}
          setStatus={setStatus} openTask={(id) => { setDetailId(id); setConfirmDel(false); }}
          editTask={(id) => { const t = tasks.find((x) => x.id === id); if (t) setForm({ mode: "edit", task: t }); }}
          ui={ui} setUi={setUi} loading={syncing} onRefresh={() => refresh(true)} onPlan={() => setPlanOpen(true)} />
      )}
      {tab === "review" && (
        <ReviewTab tasks={tasks} progress={progress} materials={materials} weeklies={weeklies} saveWeekly={saveWeekly} reviewStart={reviewStart} clearStart={() => setReviewStart(null)} user={user} addMaterial={addMaterial}
          removeMaterial={removeMaterial} focusId={reviewFocus} clearFocus={() => setReviewFocus(null)} onRefresh={() => refresh(true)} />
      )}
      {tab === "ask" && <AskTab user={user} tasks={tasks} materials={materials} progress={progress} addTask={(t) => { Sound.play("add"); addTask(t); }} />}
      {tab === "admin" && isAdmin && (
        <AdminTab inbox={inbox} records={records} announcements={announcements} markRead={markRead} dismiss={dismiss}
          updateMc={updateMc} deleteMc={deleteMc} postAnn={postAnn} removeAnn={removeAnn} onRefresh={() => refresh(true)} />
      )}
      {tab === "tasks" && (
        <button className="fab" aria-label="Add a task" onClick={() => { Sound.play("tap"); setForm({ mode: "add" }); }}><Plus size={24} /></button>
      )}
      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <span>{toast.msg}</span>
          {toast.undo && <button onClick={() => { const u = toast.undo; setToast(null); u(); }}>Undo</button>}
        </div>
      )}
      <nav className="tabs" aria-label="Main">
        {tabs.map(([k, l, Icon]) => (
          <button key={k} className="tab" aria-current={tab === k ? "page" : undefined} onClick={() => { if (tab !== k) Sound.play("tap"); setTab(k); }}>
            <Icon size={21} />{l}
            {k === "admin" && unreadCount > 0 && <span className="badge" aria-label={`${unreadCount} unread`}>{unreadCount}</span>}
          </button>
        ))}
      </nav>
      <Sheet open={!!detail} onClose={() => setDetailId(null)} title="Task">
        {detail && (
          <div>
            <h3 className="serif" style={{ fontSize: 26, fontWeight: 400, margin: "0 0 8px", lineHeight: 1.2 }}>{detail.title}</h3>
            <div className="rowMeta" style={{ fontSize: 14 }}>
              <span><span className="dot" style={{ background: subjColor(detail.subject) }} />{detail.subject}</span>
              <span>{detail.type}</span>
              <span style={{ color: detail.priority === "High" ? C.accent : C.muted }}>{detail.priority} priority</span>
            </div>
            <p style={{ margin: "18px 0 4px", fontWeight: 500 }} className={diffDays(detail.deadline) < 0 && progress[detail.id] !== "done" ? "late" : ""}>
              Due {relLabel(detail.deadline)}, {fmtDate(detail.deadline)}
            </p>
            <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
              Added by {detail.addedBy === "sample" ? "your class" : detail.addedBy}
              {finishedOthers > 0 ? `. ${finishedOthers} classmate${finishedOthers > 1 ? "s have" : " has"} finished this.` : ". Nobody else has finished this yet."}
            </p>
            {detail.notes && <p style={{ margin: "18px 0 0", lineHeight: 1.55 }}>{detail.notes}</p>}
            <div style={{ margin: "22px 0 10px", fontSize: 13, color: C.muted }}>Your progress</div>
            <Segmented value={progress[detail.id] || "todo"} options={STATUSES} onChange={(s) => setStatus(detail.id, s)} />
            <div style={{ display: "flex", gap: 10, marginTop: 26, flexWrap: "wrap" }}>
              <button className="btn accent" onClick={() => { setReviewFocus(detail.id); setTab("review"); setDetailId(null); }}>Review this</button>
              <button className="btn ghost" onClick={() => { setForm({ mode: "edit", task: detail }); setDetailId(null); }}><Pencil size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Edit</button>
              <button className="btn ghost" style={{ color: C.danger }} onClick={() => { if (confirmDel) { deleteTask(detail.id); setDetailId(null); } else setConfirmDel(true); }}>
                <Trash2 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{confirmDel ? "Tap again to delete" : "Delete"}
              </button>
            </div>
            {confirmDel && <p style={{ fontSize: 13, color: C.muted, marginTop: 12 }}>This removes it for the whole class. Its notes stay in the Library, and you can undo right after.</p>}
            <Comments taskId={detail.id} comments={comments} user={user} isAdmin={isAdmin} onAdd={addComment} onRemove={removeComment} />
          </div>
        )}
      </Sheet>
      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.mode === "edit" ? "Edit task" : "Add to the class"}>
        {form && (
          <>
            {form.mode === "add" && <p style={{ color: C.muted, margin: "-6px 0 18px", fontSize: 14 }}>Everyone in the class will see this.</p>}
            <TaskForm
              initial={form.mode === "edit" ? form.task : null}
              subjects={subjects}
              onCancel={() => setForm(null)}
              onSave={(f) => {
                if (form.mode === "edit") updateTask({ ...form.task, ...f });
                else addTask({ ...f, id: uid(), addedBy: user, createdAt: Date.now() });
                Sound.play("add");
                setForm(null);
              }}
            />
          </>
        )}
      </Sheet>
      <Sheet open={planOpen} onClose={() => setPlanOpen(false)} title="Plan my evening">
        {planOpen && <PlanPanel tasks={tasks} progress={progress} />}
      </Sheet>
      <Sheet open={searchOpen} onClose={() => setSearchOpen(false)} title="Search">
        {searchOpen && (
          <SearchPanel tasks={tasks} materials={materials}
            onTask={(id) => { setSearchOpen(false); setConfirmDel(false); setDetailId(id); }}
            onMaterial={(m) => { setSearchOpen(false); setReviewFocus(m.taskId); setTab("review"); }} />
        )}
      </Sheet>
      <Sheet open={menu} onClose={() => setMenu(false)} title="Account">
        <p style={{ margin: "0 0 20px", color: C.muted }}>
          Signed in as <b style={{ color: C.ink }}>{user}</b>{isAdmin && <span className="tag">Admin</span>}
        </p>
        <div className="field">
          <label>Appearance</label>
          <Segmented value={theme} onChange={setTheme} options={[["auto", "Auto"], ["light", "Light"], ["dark", "Dark"]]} />
        </div>
        <div className="field">
          <label>Sound effects</label>
          <Segmented value={audio.sfx ? "on" : "off"} onChange={(v) => { setAudio((a) => ({ ...a, sfx: v === "on" })); if (v === "on") { Sound.setSfx(true); Sound.play("pop"); } }} options={[["on", "On"], ["off", "Off"]]} />
        </div>
        <div className="field">
          <label>Music</label>
          <Segmented value={audio.music ? "on" : "off"} onChange={(v) => { if ((v === "on") !== audio.music) toggleMusic(); }} options={[["on", "On"], ["off", "Off"]]} />
          <input type="range" min="0" max="1" step="0.05" value={audio.vol} aria-label="Music volume"
            onChange={(e) => { const v = Number(e.target.value); setAudio((a) => ({ ...a, vol: v })); Sound.setVolume(v); }}
            style={{ width: "100%", marginTop: 14, accentColor: "var(--accent)" }} />
        </div>
        <button className="btn ghost full" style={{ marginBottom: 10 }} onClick={() => { setMenu(false); classRef.current = null; setClassId(null); }}>
          Class {classLabel}, change
        </button>
        <button className="btn ghost full" style={{ marginBottom: 10 }} onClick={() => { setMenu(false); setFbOpen(true); }}>
          Report a problem or request something
        </button>
        <button className="btn ghost full" onClick={signOut}>Sign out</button>
      </Sheet>
      <Sheet open={mcOpen} onClose={() => setMcOpen(false)} title="Minecraft server access">
        {mcOpen && <MinecraftPanel record={myMc} done={doneCount} total={tasks.length} onSave={submitMc} onClose={() => setMcOpen(false)} />}
      </Sheet>
      <Sheet open={fbOpen} onClose={() => setFbOpen(false)} title="Tell the admin">
        {fbOpen && <FeedbackForm onSend={sendFeedback} onClose={() => setFbOpen(false)} />}
      </Sheet>
    </div>
  );
}