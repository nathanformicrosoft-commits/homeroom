/* ───────────────────────── small pieces ───────────────────────── */

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
}