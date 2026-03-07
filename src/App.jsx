import { useState, useEffect, useRef } from "react";

const CATEGORIES = [
  { id: "food",          label: "Food & Dining",    icon: "🍜", color: "#FF6B6B" },
  { id: "transport",     label: "Transport",         icon: "🚇", color: "#4ECDC4" },
  { id: "shopping",      label: "Shopping",          icon: "🛍️", color: "#45B7D1" },
  { id: "entertainment", label: "Entertainment",     icon: "🎬", color: "#96CEB4" },
  { id: "health",        label: "Health & Medical",  icon: "💊", color: "#FFEAA7" },
  { id: "utilities",     label: "Utilities & Bills", icon: "⚡", color: "#DDA0DD" },
  { id: "travel",        label: "Travel",            icon: "✈️", color: "#98D8C8" },
  { id: "groceries",     label: "Groceries",         icon: "🛒", color: "#F7DC6F" },
  { id: "education",     label: "Education",         icon: "📚", color: "#82E0AA" },
  { id: "others",        label: "Others",            icon: "📦", color: "#AEB6BF" },
];

const USERS = ["Anirudh", "Guest"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function genId() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function getMonthKey(date) { const d = new Date(date); return `${d.getFullYear()}-${d.getMonth()}`; }
function getCatInfo(id) { return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1]; }
function MonthLabel(key) { const [y, m] = key.split("-").map(Number); return `${MONTHS[m]} ${y}`; }

// ─── Claude API ───────────────────────────────────────────────────────────────
// The API key is injected at build time from .env (VITE_ANTHROPIC_API_KEY)
// At runtime the app talks directly to api.anthropic.com
async function categorizeBankStatement(text) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_ANTHROPIC_API_KEY is not set. Add it to your .env file or Vercel environment variables.");
  }
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-allow-browser": "true"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `You are a financial categorization assistant. Given bank statement lines, extract transactions and categorize them.

Categories available: food, transport, shopping, entertainment, health, utilities, travel, groceries, education, others

Bank statement text:
${text.slice(0, 4000)}

Return ONLY a JSON array (no markdown, no explanation) like:
[{"description":"...", "amount": 25.50, "category":"food", "date":"2024-01-15"}]

Rules:
- amount must be a positive number
- date format: YYYY-MM-DD, if no year assume current year
- Pick the best matching category
- Skip non-transaction lines (headers, totals, opening/closing balance)
- Only include debit/spending transactions`
      }]
    })
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  const raw = data.content?.find(b => b.type === "text")?.text || "[]";
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ─── DonutChart ───────────────────────────────────────────────────────────────
function DonutChart({ data, size = 140 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#1a1a2e", border: "2px solid #2a2a4a", margin: "0 auto" }} />
  );
  let offset = 0;
  const r = 50, cx = 60, cy = 60, stroke = 18, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {data.map((d, i) => {
        const dash = (d.value / total) * circ;
        const seg = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset * circ / 100}
            style={{ transition: "stroke-dasharray 0.5s ease" }}
          />
        );
        offset += (d.value / total) * 100;
        return seg;
      })}
      <circle cx={cx} cy={cy} r={r - stroke / 2} fill="#0f0f1e" />
    </svg>
  );
}

// ─── BarRow ───────────────────────────────────────────────────────────────────
function BarRow({ label, value, max, color, icon }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: "#ccc" }}>
        <span>{icon} {label}</span>
        <span style={{ color, fontWeight: 600 }}>${value.toFixed(2)}</span>
      </div>
      <div style={{ background: "#1a1a2e", borderRadius: 6, height: 7, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, background: color, height: "100%", borderRadius: 6, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

// ─── BudgetGauge ──────────────────────────────────────────────────────────────
function BudgetGauge({ pct, color }) {
  const r = 52, cx = 70, cy = 70, stroke = 12, circ = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={140} height={90} viewBox="0 0 140 90">
      <defs>
        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.6" />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#1a1a2e" strokeWidth={stroke} strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="url(#gaugeGrad)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${(dash / circ) * (Math.PI * r)} ${Math.PI * r}`}
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      <text x={cx} y={cy - 8} textAnchor="middle" fill={color} fontSize="18" fontWeight="700">{pct.toFixed(0)}%</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="#888" fontSize="9">of budget used</text>
    </svg>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeUser, setActiveUser] = useState("Anirudh");
  const [view, setView] = useState("dashboard");

  const [expenses, setExpenses] = useState(() => {
    try { return JSON.parse(localStorage.getItem("spendwise_expenses") || "[]"); } catch { return []; }
  });
  const [budgets, setBudgets] = useState(() => {
    try { return JSON.parse(localStorage.getItem("spendwise_budgets") || "{}"); } catch { return {}; }
  });

  const [form, setForm] = useState({ amount: "", description: "", category: "food", date: new Date().toISOString().split("T")[0] });
  const [bankText, setBankText] = useState("");
  const [bankParsing, setBankParsing] = useState(false);
  const [bankResults, setBankResults] = useState([]);
  const [bankError, setBankError] = useState("");
  const [bankImported, setBankImported] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const fileRef = useRef();

  const now = new Date();
  const [analyticsPeriod, setAnalyticsPeriod] = useState(`${now.getFullYear()}-${now.getMonth()}`);

  useEffect(() => { localStorage.setItem("spendwise_expenses", JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem("spendwise_budgets", JSON.stringify(budgets)); }, [budgets]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const userExpenses = expenses.filter(e => e.user === activeUser);
  const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = `${lastMonth.getFullYear()}-${lastMonth.getMonth()}`;
  const thisMonthExp = userExpenses.filter(e => getMonthKey(e.date) === thisMonthKey);
  const lastMonthExp = userExpenses.filter(e => getMonthKey(e.date) === lastMonthKey);
  const sumExp = (arr) => arr.reduce((s, e) => s + e.amount, 0);

  const monthBudget = budgets[activeUser] || 3000;
  const thisMonthSpent = sumExp(thisMonthExp);
  const budgetRemaining = monthBudget - thisMonthSpent;
  const budgetPct = Math.min((thisMonthSpent / monthBudget) * 100, 100);
  const budgetColor = budgetPct >= 90 ? "#ff4444" : budgetPct >= 70 ? "#ffaa00" : "#4ade80";
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();
  const dailyLeft = daysLeft > 0 ? budgetRemaining / daysLeft : 0;
  const expectedSpend = (now.getDate() / daysInMonth) * monthBudget;
  const onTrack = thisMonthSpent <= expectedSpend;

  // Analytics
  const analyticsExp = userExpenses.filter(e => getMonthKey(e.date) === analyticsPeriod);
  const byCat = CATEGORIES
    .map(c => ({ ...c, value: analyticsExp.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0) }))
    .filter(c => c.value > 0).sort((a, b) => b.value - a.value);
  const maxCatVal = byCat[0]?.value || 1;
  const availableMonths = [...new Set(userExpenses.map(e => getMonthKey(e.date)))].sort().reverse();
  const recentExp = [...userExpenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

  // ── Actions ────────────────────────────────────────────────────────────────
  function addExpense() {
    if (!form.amount || !form.description) return;
    setExpenses(p => [...p, { id: genId(), user: activeUser, amount: parseFloat(form.amount), description: form.description, category: form.category, date: form.date, source: "manual" }]);
    setForm({ amount: "", description: "", category: "food", date: new Date().toISOString().split("T")[0] });
    setView("dashboard");
  }

  function deleteExpense(id) { setExpenses(p => p.filter(e => e.id !== id)); }

  async function handleBankParse() {
    if (!bankText.trim()) return;
    setBankParsing(true); setBankResults([]); setBankError("");
    try {
      const results = await categorizeBankStatement(bankText);
      setBankResults(results);
    } catch (e) {
      setBankError(e.message || "Failed to parse. Check your API key.");
    }
    setBankParsing(false);
  }

  function importBankResults() {
    setExpenses(p => [...p, ...bankResults.map(r => ({
      id: genId(), user: activeUser, amount: parseFloat(r.amount) || 0,
      description: r.description, category: r.category,
      date: r.date || new Date().toISOString().split("T")[0], source: "bank"
    }))]);
    setBankImported(true); setBankText(""); setBankResults([]);
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    setBankText(text); setBankImported(false); setBankResults([]);
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const S = {
    app: { minHeight: "100vh", background: "#0a0a16", color: "#e8e8f0", fontFamily: "'DM Sans','Segoe UI',sans-serif", maxWidth: 480, margin: "0 auto", paddingBottom: 90 },
    header: { padding: "16px 20px 12px", borderBottom: "1px solid #1e1e3a", background: "rgba(10,10,22,0.96)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10 },
    userBtn: a => ({ padding: "5px 14px", borderRadius: 20, border: a ? "1px solid #7c6fff" : "1px solid #2a2a4a", background: a ? "#7c6fff22" : "transparent", color: a ? "#a99fff" : "#666", fontSize: 13, cursor: "pointer", fontWeight: a ? 600 : 400 }),
    navBtn: a => ({ flex: 1, padding: "9px 4px", borderRadius: 10, border: "none", background: a ? "#7c6fff" : "#1a1a2e", color: a ? "#fff" : "#888", fontSize: 11, fontWeight: a ? 700 : 400, cursor: "pointer" }),
    sec: { padding: "20px 20px 10px" },
    card: { background: "#12122a", borderRadius: 16, padding: 16, border: "1px solid #1e1e3a", marginBottom: 12 },
    statCard: { background: "linear-gradient(135deg,#1a1a3a,#12122a)", borderRadius: 16, padding: 16, border: "1px solid #2a2a5a", flex: 1 },
    label: { fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
    bigNum: { fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px" },
    input: { width: "100%", background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 10, padding: "12px 14px", color: "#e8e8f0", fontSize: 15, outline: "none", boxSizing: "border-box" },
    inputLabel: { fontSize: 12, color: "#888", marginBottom: 6, display: "block" },
    btn: { width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7c6fff,#5a4fe8)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" },
    catGrid: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 20 },
    catBtn: (a, color) => ({ padding: "10px 4px", borderRadius: 12, border: a ? `2px solid ${color}` : "2px solid #1e1e3a", background: a ? `${color}18` : "#12122a", cursor: "pointer", textAlign: "center" }),
    expRow: { display: "flex", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1a1a2e", gap: 12 },
    catDot: color => ({ width: 36, height: 36, borderRadius: 10, background: `${color}22`, border: `1.5px solid ${color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }),
    delBtn: { background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 16, padding: "0 4px", flexShrink: 0 },
    textarea: { width: "100%", background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 10, padding: "12px 14px", color: "#e8e8f0", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", minHeight: 100, fontFamily: "monospace" },
    tag: color => ({ display: "inline-block", padding: "2px 8px", borderRadius: 20, background: `${color}22`, color, fontSize: 11, fontWeight: 600, border: `1px solid ${color}44` }),
    monthSel: { background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 10, padding: "8px 12px", color: "#e8e8f0", fontSize: 13, outline: "none" },
  };

  function ExpenseRow({ e, showDelete = true }) {
    const cat = getCatInfo(e.category);
    return (
      <div style={S.expRow}>
        <div style={S.catDot(cat.color)}>{cat.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.description}</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
            {e.date} · <span style={S.tag(cat.color)}>{cat.label}</span>
            {e.source === "bank" && <span style={{ marginLeft: 4, ...S.tag("#4ECDC4") }}>Bank</span>}
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#ff8a8a", flexShrink: 0 }}>-${e.amount.toFixed(2)}</div>
        {showDelete && <button style={S.delBtn} onClick={() => deleteExpense(e.id)}>✕</button>}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.app}>

      {/* HEADER */}
      <div style={S.header}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>💸 Spendwise</div>
            <div style={{ fontSize: 11, color: "#444" }}>Personal Finance</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {USERS.map(u => (
              <button key={u} style={S.userBtn(activeUser === u)} onClick={() => setActiveUser(u)}>
                {u === "Anirudh" ? "👤" : "👥"} {u}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["dashboard","📊 Home"],["add","➕ Add"],["analytics","📈 Stats"],["bank","🏦 Bank"]].map(([v,l]) => (
            <button key={v} style={S.navBtn(view === v)} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── DASHBOARD ─────────────────────────────────────────────────────── */}
      {view === "dashboard" && (
        <div style={S.sec}>
          <div style={{ fontSize: 13, color: "#666", marginBottom: 14 }}>
            Hey <span style={{ color: "#a99fff", fontWeight: 600 }}>{activeUser}</span> 👋
          </div>

          {/* Budget Card */}
          <div style={{ ...S.card, background: "linear-gradient(135deg,#12122a,#1a1230)", borderColor: `${budgetColor}33` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={S.label}>Monthly Budget</div>
                {editingBudget ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                    <input style={{ ...S.input, width: 110, padding: "6px 10px", fontSize: 14 }}
                      type="number" value={budgetInput} placeholder="3000"
                      onChange={e => setBudgetInput(e.target.value)} autoFocus />
                    <button style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: budgetColor, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                      onClick={() => { if (budgetInput) setBudgets(b => ({ ...b, [activeUser]: parseFloat(budgetInput) })); setEditingBudget(false); }}>Save</button>
                    <button style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #2a2a4a", background: "none", color: "#888", fontSize: 12, cursor: "pointer" }}
                      onClick={() => setEditingBudget(false)}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 2 }}>
                    <div style={{ fontSize: 28, fontWeight: 700 }}>${monthBudget.toLocaleString()}</div>
                    <button style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 12, padding: 0 }}
                      onClick={() => { setBudgetInput(String(monthBudget)); setEditingBudget(true); }}>✏️ edit</button>
                  </div>
                )}
              </div>
              <BudgetGauge pct={budgetPct} color={budgetColor} />
            </div>

            {/* Spent / Remaining */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1, background: "#ff444411", borderRadius: 10, padding: "10px 12px", border: "1px solid #ff444433" }}>
                <div style={{ fontSize: 10, color: "#ff8888", textTransform: "uppercase", letterSpacing: 1 }}>Spent</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#ff6b6b", marginTop: 2 }}>${thisMonthSpent.toFixed(2)}</div>
              </div>
              <div style={{ flex: 1, background: `${budgetColor}11`, borderRadius: 10, padding: "10px 12px", border: `1px solid ${budgetColor}33` }}>
                <div style={{ fontSize: 10, color: budgetColor, textTransform: "uppercase", letterSpacing: 1 }}>
                  {budgetRemaining >= 0 ? "Remaining" : "Over Budget"}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: budgetColor, marginTop: 2 }}>${Math.abs(budgetRemaining).toFixed(2)}</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ background: "#1a1a2e", borderRadius: 8, height: 8, overflow: "hidden", marginBottom: 10 }}>
              <div style={{ width: `${budgetPct}%`, background: `linear-gradient(90deg,${budgetColor}88,${budgetColor})`, height: "100%", borderRadius: 8, transition: "width 0.8s ease" }} />
            </div>

            {/* Pace info */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ color: onTrack ? "#4ade80" : "#ffaa00" }}>
                {onTrack ? "✅ On track" : "⚠️ Spending fast"}
              </span>
              <span style={{ color: "#555" }}>
                {daysLeft}d left · <span style={{ color: dailyLeft >= 0 ? "#a99fff" : "#ff6b6b" }}>
                  ${Math.abs(dailyLeft).toFixed(0)}/day
                </span>
              </span>
            </div>
          </div>

          {/* Stats Row */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={S.statCard}>
              <div style={S.label}>This Month</div>
              <div style={{ ...S.bigNum, color: "#7c6fff" }}>${thisMonthSpent.toFixed(2)}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{thisMonthExp.length} transactions</div>
            </div>
            <div style={S.statCard}>
              <div style={S.label}>Last Month</div>
              <div style={{ ...S.bigNum, color: "#4ECDC4" }}>${sumExp(lastMonthExp).toFixed(2)}</div>
              <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>{lastMonthExp.length} transactions</div>
            </div>
          </div>

          {/* This month breakdown */}
          {thisMonthExp.length > 0 && (() => {
            const cats = CATEGORIES.map(c => ({ ...c, value: thisMonthExp.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0) }))
              .filter(c => c.value > 0).sort((a, b) => b.value - a.value);
            return (
              <div style={S.card}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 12, fontWeight: 600 }}>THIS MONTH BREAKDOWN</div>
                {cats.map(c => <BarRow key={c.id} label={c.label} value={c.value} max={cats[0].value} color={c.color} icon={c.icon} />)}
              </div>
            );
          })()}

          {/* Recent */}
          <div style={S.card}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 12, fontWeight: 600 }}>RECENT</div>
            {recentExp.length === 0
              ? <div style={{ textAlign: "center", color: "#444", padding: "20px 0", fontSize: 13 }}>No expenses yet. Tap ➕ to add!</div>
              : recentExp.map(e => <ExpenseRow key={e.id} e={e} />)
            }
          </div>
        </div>
      )}

      {/* ── ADD EXPENSE ───────────────────────────────────────────────────── */}
      {view === "add" && (
        <div style={S.sec}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Add Expense</div>
          <div style={{ marginBottom: 16 }}>
            <span style={S.inputLabel}>Category</span>
            <div style={S.catGrid}>
              {CATEGORIES.map(c => (
                <div key={c.id} style={S.catBtn(form.category === c.id, c.color)} onClick={() => setForm(f => ({ ...f, category: c.id }))}>
                  <div style={{ fontSize: 20 }}>{c.icon}</div>
                  <div style={{ fontSize: 9, color: form.category === c.id ? c.color : "#666", marginTop: 2, lineHeight: 1.2 }}>{c.label.split(" ")[0]}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={S.inputLabel}>Amount ($)</label>
            <input style={S.input} type="number" inputMode="decimal" placeholder="0.00" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={S.inputLabel}>Description</label>
            <input style={S.input} type="text" placeholder="What did you spend on?" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={S.inputLabel}>Date</label>
            <input style={S.input} type="date" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <button style={{ ...S.btn, opacity: (!form.amount || !form.description) ? 0.5 : 1 }} onClick={addExpense}>
            Add Expense
          </button>
        </div>
      )}

      {/* ── ANALYTICS ────────────────────────────────────────────────────── */}
      {view === "analytics" && (
        <div style={S.sec}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Analytics</div>
            <select style={S.monthSel} value={analyticsPeriod} onChange={e => setAnalyticsPeriod(e.target.value)}>
              {availableMonths.length === 0 && <option value={thisMonthKey}>{MonthLabel(thisMonthKey)}</option>}
              {availableMonths.map(m => <option key={m} value={m}>{MonthLabel(m)}</option>)}
            </select>
          </div>

          {analyticsExp.length === 0 ? (
            <div style={{ textAlign: "center", color: "#444", padding: "40px 0", fontSize: 13 }}>No expenses for this period.</div>
          ) : (
            <>
              <div style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={S.label}>Total Spent</div>
                    <div style={{ fontSize: 32, fontWeight: 700, color: "#ff8a8a" }}>${sumExp(analyticsExp).toFixed(2)}</div>
                    <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{analyticsExp.length} transactions</div>
                    {analyticsPeriod === thisMonthKey && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, color: "#888" }}>Budget: <span style={{ color: "#e8e8f0", fontWeight: 600 }}>${monthBudget.toLocaleString()}</span></div>
                        <div style={{ fontSize: 11, color: budgetColor, fontWeight: 600, marginTop: 2 }}>
                          {budgetRemaining >= 0 ? `$${budgetRemaining.toFixed(2)} remaining` : `$${Math.abs(budgetRemaining).toFixed(2)} over budget`}
                        </div>
                      </div>
                    )}
                  </div>
                  <DonutChart data={byCat.map(c => ({ color: c.color, value: c.value }))} />
                </div>
              </div>
              <div style={S.card}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 12, fontWeight: 600 }}>BY CATEGORY</div>
                {byCat.map(c => <BarRow key={c.id} label={c.label} value={c.value} max={maxCatVal} color={c.color} icon={c.icon} />)}
              </div>
              <div style={S.card}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 12, fontWeight: 600 }}>ALL TRANSACTIONS</div>
                {[...analyticsExp].sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => <ExpenseRow key={e.id} e={e} />)}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── BANK STATEMENT ───────────────────────────────────────────────── */}
      {view === "bank" && (
        <div style={S.sec}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Bank Import</div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 20 }}>
            Upload or paste your credit card statement. AI will auto-categorize every transaction.
          </div>

          <div style={S.card}>
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleFileUpload} />
            <button style={{ ...S.btn, background: "#1a1a3a", border: "1px dashed #3a3a6a", color: "#888", marginBottom: 12 }}
              onClick={() => fileRef.current.click()}>
              📁 Upload CSV / TXT Statement
            </button>
            <div style={{ fontSize: 11, color: "#444", textAlign: "center", marginBottom: 10 }}>— or paste below —</div>
            <textarea style={S.textarea}
              placeholder={"Paste statement text here...\ne.g.\n2024-03-05  GRAB FOOD         $24.50\n2024-03-07  COMFORT DEL TAXI  $12.00\n2024-03-10  NTUC FAIRPRICE    $85.30"}
              value={bankText}
              onChange={e => { setBankText(e.target.value); setBankImported(false); setBankResults([]); setBankError(""); }} />
            {bankError && <div style={{ color: "#ff6b6b", fontSize: 12, marginTop: 8, padding: "8px 10px", background: "#ff000011", borderRadius: 8 }}>⚠️ {bankError}</div>}
            <button style={{ ...S.btn, marginTop: 12, opacity: bankParsing || !bankText.trim() ? 0.6 : 1 }}
              onClick={handleBankParse} disabled={bankParsing || !bankText.trim()}>
              {bankParsing ? "🤖 Analyzing..." : "🤖 Categorize with AI"}
            </button>
          </div>

          {bankResults.length > 0 && !bankImported && (
            <div style={S.card}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4, fontWeight: 600 }}>FOUND {bankResults.length} TRANSACTIONS</div>
              <div style={{ fontSize: 11, color: "#555", marginBottom: 14 }}>Review then import</div>
              {bankResults.map((r, i) => {
                const cat = getCatInfo(r.category);
                return (
                  <div key={i} style={S.expRow}>
                    <div style={S.catDot(cat.color)}>{cat.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{r.description}</div>
                      <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{r.date} · <span style={S.tag(cat.color)}>{cat.label}</span></div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#ff8a8a" }}>-${parseFloat(r.amount).toFixed(2)}</div>
                  </div>
                );
              })}
              <button style={{ ...S.btn, marginTop: 14 }} onClick={importBankResults}>
                ✅ Import All {bankResults.length} Transactions
              </button>
            </div>
          )}

          {bankImported && (
            <div style={{ ...S.card, background: "#0a2a1a", borderColor: "#1a5a3a", textAlign: "center", padding: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
              <div style={{ color: "#4ade80", fontWeight: 700 }}>Imported Successfully!</div>
              <button style={{ ...S.btn, marginTop: 14, background: "#1a3a2a", border: "1px solid #2a6a4a", color: "#4ade80" }}
                onClick={() => setView("analytics")}>View Analytics →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
