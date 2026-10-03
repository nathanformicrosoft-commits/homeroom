/* ───────────────────────── ask ───────────────────────── */

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