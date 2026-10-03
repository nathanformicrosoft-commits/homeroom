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
`;