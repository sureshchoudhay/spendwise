import { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

// ─── Constants ────────────────────────────────────────────────────────────────
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

const EARNING_TYPES = [
  { id: "salary",    label: "Salary",    icon: "💼" },
  { id: "freelance", label: "Freelance", icon: "💻" },
  { id: "bonus",     label: "Bonus",     icon: "🎁" },
  { id: "other",     label: "Other",     icon: "💰" },
];

const USERS  = ["Anirudh", "Wifey"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genId       = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const getMonthKey = d  => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}`; };
const getCatInfo  = id => CATEGORIES.find(c => c.id === id) ?? CATEGORIES.at(-1);
const MonthLabel  = k  => { const [y,m] = k.split("-").map(Number); return `${MONTHS[m]} ${y}`; };
const sumAmt      = arr => arr.reduce((s,e) => s + e.amount, 0);

// ─── PDF Extraction ───────────────────────────────────────────────────────────
async function extractTextFromPDF(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items   = content.items.slice().sort((a, b) => {
      const dy = Math.round(b.transform[5]) - Math.round(a.transform[5]);
      return dy !== 0 ? dy : a.transform[4] - b.transform[4];
    });
    const rows = [];
    let row = [], lastY = null;
    for (const item of items) {
      const y = Math.round(item.transform[5]);
      if (lastY === null || Math.abs(y - lastY) < 4) { row.push(item.str); }
      else { if (row.length) rows.push(row.join("  ")); row = [item.str]; }
      lastY = y;
    }
    if (row.length) rows.push(row.join("  "));
    fullText += rows.join("\n") + "\n\n";
  }
  return { text: fullText.trim(), pages: pdf.numPages };
}

// ─── Categorize via Vercel proxy ─────────────────────────────────────────────
async function categorizeStatement(text) {
  const res  = await fetch("/api/categorize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  return data.transactions;
}

// ─── Shared small components ──────────────────────────────────────────────────
function BarRow({ label, value, max, color, icon }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:5, color:"#ccc" }}>
        <span>{icon} {label}</span>
        <span style={{ color, fontWeight:600 }}>${value.toFixed(2)}</span>
      </div>
      <div style={{ background:"#1a1a2e", borderRadius:6, height:6, overflow:"hidden" }}>
        <div style={{ width:`${max>0?(value/max)*100:0}%`, background:color, height:"100%", borderRadius:6, transition:"width 0.6s ease" }} />
      </div>
    </div>
  );
}

function DonutChart({ data, size = 130 }) {
  const total = data.reduce((s,d) => s + d.value, 0);
  if (!total) return <div style={{ width:size, height:size, borderRadius:"50%", background:"#1a1a2e", border:"2px solid #2a2a4a", margin:"0 auto" }} />;
  let offset = 0;
  const r = 50, cx = 60, cy = 60, sw = 18, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {data.map((d, i) => {
        const dash = (d.value / total) * circ;
        const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={sw}
          strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={-offset * circ / 100} />;
        offset += (d.value / total) * 100;
        return el;
      })}
      <circle cx={cx} cy={cy} r={r - sw/2} fill="#0f0f1e" />
    </svg>
  );
}

function ExpRow({ e, onDelete }) {
  const cat = getCatInfo(e.category);
  return (
    <div style={{ display:"flex", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #1a1a2e", gap:12 }}>
      <div style={{ width:36, height:36, borderRadius:10, background:`${cat.color}22`, border:`1.5px solid ${cat.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{cat.icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.description}</div>
        <div style={{ display:"flex", gap:5, marginTop:3, flexWrap:"wrap" }}>
          <span style={{ fontSize:10, padding:"1px 7px", borderRadius:20, background:`${cat.color}18`, color:cat.color, border:`1px solid ${cat.color}33` }}>{cat.label}</span>
          <span style={{ fontSize:10, padding:"1px 7px", borderRadius:20, background:e.tag==="house"?"#96CEB418":"#45B7D118", color:e.tag==="house"?"#96CEB4":"#45B7D1", border:`1px solid ${e.tag==="house"?"#96CEB433":"#45B7D133"}` }}>{e.tag==="house"?"🏠":"👤"}</span>
          {e.source==="bank" && <span style={{ fontSize:10, padding:"1px 7px", borderRadius:20, background:"#4ECDC418", color:"#4ECDC4", border:"1px solid #4ECDC433" }}>Bank</span>}
        </div>
      </div>
      <div style={{ fontSize:14, fontWeight:700, color:"#ff8a8a", flexShrink:0 }}>-${e.amount.toFixed(2)}</div>
      {onDelete && <button style={{ background:"none", border:"none", color:"#444", cursor:"pointer", fontSize:16, padding:"0 2px", flexShrink:0 }} onClick={onDelete}>✕</button>}
    </div>
  );
}

// ─── Budget Card (used on Home) ───────────────────────────────────────────────
function BudgetCard({ tag, icon, color, spent, budget, onSetBudget, lastMonthAmt, dayOfMonth }) {
  const [editing,  setEditing]  = useState(false);
  const [inputVal, setInputVal] = useState(String(budget));
  const pct         = Math.min((spent / budget) * 100, 100);
  const remaining   = budget - spent;
  const bColor      = pct >= 90 ? "#ff4444" : pct >= 70 ? "#ffaa00" : color;
  const vs          = spent - lastMonthAmt;
  const vsPct       = lastMonthAmt > 0 ? (vs / lastMonthAmt) * 100 : 0;
  const prevMonth   = new Date(); prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevLabel   = MONTHS[prevMonth.getMonth()];

  return (
    <div style={{ background:"#12122a", borderRadius:16, padding:16, border:`1px solid ${color}22`, marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`${color}18`, border:`1.5px solid ${color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{icon}</div>
          <div>
            <div style={{ fontSize:14, fontWeight:700 }}>{tag==="personal"?"Personal":"House"}</div>
            <div style={{ fontSize:10, color:"#555" }}>Monthly budget</div>
          </div>
        </div>
        {editing ? (
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <input value={inputVal} onChange={e=>setInputVal(e.target.value)} type="number" autoFocus
              style={{ width:80, background:"#1a1a2e", border:`1px solid ${color}66`, borderRadius:8, padding:"5px 8px", color:"#e8e8f0", fontSize:13, outline:"none", textAlign:"right" }} />
            <button onClick={()=>{ onSetBudget(parseFloat(inputVal)||budget); setEditing(false); }}
              style={{ padding:"5px 10px", borderRadius:8, border:"none", background:color, color:"#000", fontWeight:700, fontSize:12, cursor:"pointer" }}>✓</button>
            <button onClick={()=>setEditing(false)}
              style={{ padding:"5px 8px", borderRadius:8, border:"1px solid #2a2a4a", background:"none", color:"#666", fontSize:12, cursor:"pointer" }}>✕</button>
          </div>
        ) : (
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:20, fontWeight:700, color:bColor }}>{pct.toFixed(0)}%</div>
            <button onClick={()=>{ setInputVal(String(budget)); setEditing(true); }}
              style={{ background:"none", border:"none", color:"#444", fontSize:10, cursor:"pointer", padding:0 }}>
              ${budget.toLocaleString()} ✏️
            </button>
          </div>
        )}
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:10 }}>
        {[
          ["Spent","#ff6b6b","#ff444411","#ff444422",`$${spent.toFixed(0)}`],
          [remaining>=0?"Left":"Over", bColor, `${bColor}11`, `${bColor}22`, `$${Math.abs(remaining).toFixed(0)}`],
          [vs>0?"▲ vs Last":"▼ vs Last", vs>0?"#ff6b6b":"#4ade80", vs>0?"#ff444411":"#4ade8011", vs>0?"#ff444422":"#4ade8022", `${vs>0?"+":"-"}$${Math.abs(vs).toFixed(0)}`],
        ].map(([lbl,col,bg,border,val]) => (
          <div key={lbl} style={{ flex:1, background:bg, borderRadius:10, padding:"8px 6px", border:`1px solid ${border}`, textAlign:"center" }}>
            <div style={{ fontSize:9, color:col, textTransform:"uppercase", letterSpacing:0.4, marginBottom:3 }}>{lbl}</div>
            <div style={{ fontSize:14, fontWeight:700, color:col }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ background:"#1a1a2e", borderRadius:8, height:7, overflow:"hidden", marginBottom:6 }}>
        <div style={{ width:`${pct}%`, background:`linear-gradient(90deg,${bColor}66,${bColor})`, height:"100%", borderRadius:8, transition:"width 0.8s ease" }} />
      </div>
      <div style={{ fontSize:10, color:"#444" }}>
        {vs>0?"📈":"📉"} {Math.abs(vsPct).toFixed(0)}% {vs>0?"more":"less"} than {prevLabel} 1–{dayOfMonth}
      </div>
    </div>
  );
}

// ─── HOME TAB ─────────────────────────────────────────────────────────────────
function HomeTab({ user, expenses, earnings, budgets, setBudgets }) {
  const now          = new Date();
  const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const dayOfMonth   = now.getDate();

  // Last month same period
  const prevDate     = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${prevDate.getMonth()}`;

  const userExp      = expenses.filter(e => e.user === user);
  const userEarn     = earnings.filter(e => e.user === user);
  const thisMonthExp = userExp.filter(e => getMonthKey(e.date) === thisMonthKey);
  const prevMonthExp = userExp.filter(e => {
    const d = new Date(e.date);
    return getMonthKey(e.date) === prevMonthKey && d.getDate() <= dayOfMonth;
  });
  const thisMonthEarn = userEarn.filter(e => getMonthKey(e.date) === thisMonthKey);

  const totalEarned   = sumAmt(thisMonthEarn);
  const personalSpent = sumAmt(thisMonthExp.filter(e=>e.tag==="personal"));
  const houseSpent    = sumAmt(thisMonthExp.filter(e=>e.tag==="house"));
  const totalSpent    = personalSpent + houseSpent;
  const saved         = totalEarned - totalSpent;
  const savingsPct    = totalEarned > 0 ? (saved/totalEarned)*100 : 0;

  const prevPersonal  = sumAmt(prevMonthExp.filter(e=>e.tag==="personal"));
  const prevHouse     = sumAmt(prevMonthExp.filter(e=>e.tag==="house"));

  const userBudgets   = budgets[user] || { personal: 1500, house: 1500 };
  const recent        = [...thisMonthExp].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);

  function setBudgetFor(tag, val) {
    setBudgets(b => ({ ...b, [user]: { ...userBudgets, [tag]: val } }));
  }

  return (
    <div>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:20, fontWeight:700 }}>Hey {user} 👋</div>
        <div style={{ fontSize:12, color:"#555", marginTop:2 }}>{MONTHS[now.getMonth()]} {now.getFullYear()}</div>
      </div>

      {/* Earnings summary */}
      <div style={{ background:"linear-gradient(135deg,#0d2a1a,#12122a)", borderRadius:16, padding:16, border:"1px solid #4ade8022", marginBottom:12 }}>
        <div style={{ fontSize:11, color:"#4ade80", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:12 }}>💰 This Month</div>
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          {[
            ["Earned","#4ade80","#4ade8011","#4ade8022",totalEarned===0?"$0":`$${totalEarned.toLocaleString()}`],
            ["Spent","#ff6b6b","#ff444411","#ff444422",`$${totalSpent.toFixed(0)}`],
            ["Saved",saved>=0?"#a99fff":"#ff6b6b",saved>=0?"#7c6fff11":"#ff444411",saved>=0?"#7c6fff22":"#ff444422",`$${Math.abs(saved).toFixed(0)}`],
          ].map(([lbl,col,bg,border,val])=>(
            <div key={lbl} style={{ flex:1, textAlign:"center", padding:"10px 4px", background:bg, borderRadius:12, border:`1px solid ${border}` }}>
              <div style={{ fontSize:9, color:`${col}aa`, textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 }}>{lbl}</div>
              <div style={{ fontSize:17, fontWeight:700, color:col }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#555", marginBottom:4 }}>
          <span>Savings rate</span>
          <span style={{ color:savingsPct>=20?"#4ade80":"#ffaa00", fontWeight:600 }}>{totalEarned>0?`${savingsPct.toFixed(0)}%`:"Add earnings ↑"}</span>
        </div>
        <div style={{ background:"#1a1a2e", borderRadius:6, height:6, overflow:"hidden" }}>
          <div style={{ width:`${Math.max(0,Math.min(savingsPct,100))}%`, background:"linear-gradient(90deg,#4ade8066,#4ade80)", height:"100%", borderRadius:6 }} />
        </div>
      </div>

      {/* Two budget cards */}
      <BudgetCard tag="personal" icon="👤" color="#45B7D1" spent={personalSpent}
        budget={userBudgets.personal} onSetBudget={v=>setBudgetFor("personal",v)}
        lastMonthAmt={prevPersonal} dayOfMonth={dayOfMonth} />
      <BudgetCard tag="house" icon="🏠" color="#96CEB4" spent={houseSpent}
        budget={userBudgets.house} onSetBudget={v=>setBudgetFor("house",v)}
        lastMonthAmt={prevHouse} dayOfMonth={dayOfMonth} />

      {/* Recent */}
      <div style={{ background:"#12122a", borderRadius:16, padding:16, border:"1px solid #1e1e3a" }}>
        <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:12 }}>Recent</div>
        {recent.length === 0
          ? <div style={{ textAlign:"center", color:"#444", padding:"20px 0", fontSize:13 }}>No expenses yet. Tap ➖ to add!</div>
          : recent.map(e => <ExpRow key={e.id} e={e} />)
        }
      </div>
    </div>
  );
}

// ─── ADD EXPENSE TAB ──────────────────────────────────────────────────────────
function AddExpenseTab({ user, onAdd }) {
  const now = new Date();
  const [tag,      setTag]      = useState("personal");
  const [category, setCategory] = useState("food");
  const [amount,   setAmount]   = useState("");
  const [desc,     setDesc]     = useState("");
  const [date,     setDate]     = useState(now.toISOString().split("T")[0]);

  function handleAdd() {
    if (!amount) return;
    const cat = CATEGORIES.find(c => c.id === category);
    const finalDesc = desc.trim() || (cat ? cat.label : category);
    onAdd({ tag, category, amount: parseFloat(amount), description: finalDesc, date });
    setAmount(""); setDesc(""); setTag("personal"); setCategory("food");
    setDate(now.toISOString().split("T")[0]);
  }

  const S = {
    input:  { width:"100%", background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:10, padding:"12px 14px", color:"#e8e8f0", fontSize:15, outline:"none", boxSizing:"border-box" },
    iLabel: { fontSize:12, color:"#888", marginBottom:6, display:"block" },
  };

  return (
    <div>
      <div style={{ fontSize:20, fontWeight:700, marginBottom:20 }}>Add Expense</div>

      {/* Tag picker */}
      <div style={{ marginBottom:20 }}>
        <span style={S.iLabel}>This is for...</span>
        <div style={{ display:"flex", gap:10 }}>
          {[["personal","👤","Personal","Just for me","#45B7D1"],["house","🏠","House","Household expense","#96CEB4"]].map(([v,icon,lbl,sub,col]) => (
            <button key={v} onClick={()=>setTag(v)} style={{ flex:1, padding:"14px", borderRadius:14, border:tag===v?`2px solid ${col}`:"2px solid #1e1e3a", background:tag===v?`${col}18`:"#12122a", cursor:"pointer" }}>
              <div style={{ fontSize:24, marginBottom:4 }}>{icon}</div>
              <div style={{ fontSize:13, fontWeight:600, color:tag===v?col:"#666" }}>{lbl}</div>
              <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Category grid */}
      <div style={{ marginBottom:20 }}>
        <span style={S.iLabel}>Category</span>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
          {CATEGORIES.map(c => (
            <div key={c.id} onClick={()=>setCategory(c.id)}
              style={{ padding:"10px 4px", borderRadius:12, border:category===c.id?`2px solid ${c.color}`:"2px solid #1e1e3a", background:category===c.id?`${c.color}18`:"#12122a", cursor:"pointer", textAlign:"center" }}>
              <div style={{ fontSize:20 }}>{c.icon}</div>
              <div style={{ fontSize:9, color:category===c.id?c.color:"#666", marginTop:2, lineHeight:1.2 }}>{c.label.split(" ")[0]}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={S.iLabel}>Amount ($)</label>
        <input style={S.input} type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)} />
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={S.iLabel}>Description</label>
        <input style={S.input} type="text" placeholder="Description (optional — e.g. Grab Food)" value={desc} onChange={e=>setDesc(e.target.value)} />
      </div>
      <div style={{ marginBottom:24 }}>
        <label style={S.iLabel}>Date</label>
        <input style={S.input} type="date" value={date} onChange={e=>setDate(e.target.value)} />
      </div>

      <button style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:"linear-gradient(135deg,#7c6fff,#5a4fe8)", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", opacity:(!amount)?0.5:1 }}
        onClick={handleAdd} disabled={!amount}>
        Add Expense
      </button>
    </div>
  );
}

// ─── ADD EARNING TAB ──────────────────────────────────────────────────────────
function AddEarningTab({ user, earnings, onAdd, onDelete }) {
  const now = new Date();
  const thisMonthKey  = `${now.getFullYear()}-${now.getMonth()}`;
  const thisMonthEarn = earnings.filter(e => e.user === user && getMonthKey(e.date) === thisMonthKey);
  const totalEarned   = sumAmt(thisMonthEarn);

  const [type,   setType]   = useState("salary");
  const [amount, setAmount] = useState("");
  const [desc,   setDesc]   = useState("");
  const [date,   setDate]   = useState(now.toISOString().split("T")[0]);

  function handleAdd() {
    if (!amount || !desc) return;
    onAdd({ type, amount: parseFloat(amount), description: desc, date });
    setAmount(""); setDesc(""); setType("salary");
    setDate(now.toISOString().split("T")[0]);
  }

  const S = {
    input:  { width:"100%", background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:10, padding:"12px 14px", color:"#e8e8f0", fontSize:15, outline:"none", boxSizing:"border-box" },
    iLabel: { fontSize:12, color:"#888", marginBottom:6, display:"block" },
  };

  return (
    <div>
      <div style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>Add Earning</div>
      <div style={{ fontSize:12, color:"#555", marginBottom:20 }}>
        This month total: <span style={{ color:"#4ade80", fontWeight:600 }}>${totalEarned.toLocaleString()}</span>
      </div>

      {/* Existing earnings list */}
      {thisMonthEarn.length > 0 && (
        <div style={{ background:"#12122a", borderRadius:16, padding:14, border:"1px solid #1e1e3a", marginBottom:20 }}>
          <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:10 }}>This Month's Earnings</div>
          {thisMonthEarn.map(e => (
            <div key={e.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #1a1a2e" }}>
              <div>
                <div style={{ fontSize:13, fontWeight:500 }}>{e.description}</div>
                <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{e.date} · {e.type}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ fontSize:14, fontWeight:700, color:"#4ade80" }}>+${e.amount.toLocaleString()}</div>
                <button onClick={()=>onDelete(e.id)} style={{ background:"none", border:"none", color:"#444", cursor:"pointer", fontSize:15 }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Type picker */}
      <div style={{ marginBottom:20 }}>
        <span style={S.iLabel}>Type</span>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {EARNING_TYPES.map(t => (
            <div key={t.id} onClick={()=>setType(t.id)}
              style={{ padding:"10px 4px", borderRadius:12, border:type===t.id?"2px solid #4ade80":"2px solid #1e1e3a", background:type===t.id?"#4ade8018":"#12122a", cursor:"pointer", textAlign:"center" }}>
              <div style={{ fontSize:20 }}>{t.icon}</div>
              <div style={{ fontSize:9, color:type===t.id?"#4ade80":"#666", marginTop:2 }}>{t.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom:14 }}>
        <label style={S.iLabel}>Amount ($)</label>
        <input style={S.input} type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)} />
      </div>
      <div style={{ marginBottom:14 }}>
        <label style={S.iLabel}>Description</label>
        <input style={S.input} type="text" placeholder="e.g. Monthly Salary" value={desc} onChange={e=>setDesc(e.target.value)} />
      </div>
      <div style={{ marginBottom:24 }}>
        <label style={S.iLabel}>Date</label>
        <input style={S.input} type="date" value={date} onChange={e=>setDate(e.target.value)} />
      </div>

      <button style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:"linear-gradient(135deg,#4ade80,#22c55e)", color:"#000", fontSize:15, fontWeight:700, cursor:"pointer", opacity:(!amount||!desc)?0.5:1 }}
        onClick={handleAdd} disabled={!amount||!desc}>
        Add Earning
      </button>
    </div>
  );
}

// ─── STATS TAB ────────────────────────────────────────────────────────────────
function StatsTab({ user, expenses }) {
  const now          = new Date();
  const dayOfMonth   = now.getDate();
  const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const prevDate     = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${prevDate.getMonth()}`;
  const prevLabel    = MONTHS[prevDate.getMonth()];

  const [tagFilter,      setTagFilter]      = useState("all");
  const [analyticsPeriod, setAnalyticsPeriod] = useState(thisMonthKey);

  const userExp    = expenses.filter(e => e.user === user);
  const availableMonths = [...new Set(userExp.map(e=>getMonthKey(e.date)))].sort().reverse();

  const periodExp  = userExp.filter(e => getMonthKey(e.date) === analyticsPeriod);
  const filtered   = tagFilter==="all" ? periodExp : periodExp.filter(e=>e.tag===tagFilter);
  const thisSpent  = sumAmt(filtered);

  // Same-period last month (only when viewing current month)
  const prevFiltered = userExp.filter(e => {
    const d = new Date(e.date);
    return getMonthKey(e.date) === prevMonthKey && d.getDate() <= dayOfMonth &&
      (tagFilter==="all" || e.tag===tagFilter);
  });
  const prevSpent  = sumAmt(prevFiltered);
  const vs         = thisSpent - prevSpent;
  const vsPct      = prevSpent > 0 ? (vs/prevSpent)*100 : 0;

  const byCat      = CATEGORIES.map(c=>({...c, value:sumAmt(filtered.filter(e=>e.category===c.id))})).filter(c=>c.value>0).sort((a,b)=>b.value-a.value);
  const allFiltered = [...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date));

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontSize:20, fontWeight:700 }}>Analytics</div>
        <select value={analyticsPeriod} onChange={e=>setAnalyticsPeriod(e.target.value)}
          style={{ background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:10, padding:"7px 10px", color:"#e8e8f0", fontSize:12, outline:"none" }}>
          {availableMonths.length===0 && <option value={thisMonthKey}>{MonthLabel(thisMonthKey)}</option>}
          {availableMonths.map(m=><option key={m} value={m}>{MonthLabel(m)}</option>)}
        </select>
      </div>

      {/* Tag filter */}
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {[["all","All 📊","#7c6fff"],["personal","Personal 👤","#45B7D1"],["house","House 🏠","#96CEB4"]].map(([v,l,c])=>(
          <button key={v} onClick={()=>setTagFilter(v)}
            style={{ flex:1, padding:"9px 4px", borderRadius:10, border:tagFilter===v?`1.5px solid ${c}`:"1.5px solid #2a2a4a", background:tagFilter===v?`${c}18`:"#12122a", color:tagFilter===v?c:"#666", fontSize:11, fontWeight:tagFilter===v?700:400, cursor:"pointer" }}>
            {l}
          </button>
        ))}
      </div>

      {filtered.length === 0
        ? <div style={{ textAlign:"center", color:"#444", padding:"40px 0", fontSize:13 }}>No expenses for this selection.</div>
        : (
          <>
            {/* Summary + donut */}
            <div style={{ background:"#12122a", borderRadius:16, padding:16, border:"1px solid #1e1e3a", marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Total Spent</div>
                  <div style={{ fontSize:30, fontWeight:700, color:"#ff8a8a" }}>${thisSpent.toFixed(2)}</div>
                  <div style={{ fontSize:12, color:"#555", marginTop:4 }}>{filtered.length} transactions</div>
                </div>
                <DonutChart data={byCat.map(c=>({color:c.color,value:c.value}))} />
              </div>
            </div>

            {/* Same-period comparison — only when viewing current month */}
            {analyticsPeriod === thisMonthKey && prevSpent > 0 && (
              <div style={{ background:"#12122a", borderRadius:16, padding:16, border:"1px solid #1e1e3a", marginBottom:12 }}>
                <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:12 }}>
                  {MONTHS[now.getMonth()]} 1–{dayOfMonth} vs {prevLabel} 1–{dayOfMonth}
                </div>
                <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                  {[
                    ["This month","#7c6fff","#7c6fff11","#7c6fff33",`$${thisSpent.toFixed(0)}`,`${MONTHS[now.getMonth()]} 1–${dayOfMonth}`],
                    ["Last month","#4ECDC4","#4ECDC411","#4ECDC433",`$${prevSpent.toFixed(0)}`,`${prevLabel} 1–${dayOfMonth}`],
                  ].map(([lbl,col,bg,border,val,sub])=>(
                    <div key={lbl} style={{ flex:1, background:bg, borderRadius:12, padding:"12px", border:`1px solid ${border}` }}>
                      <div style={{ fontSize:10, color:col, marginBottom:4 }}>{lbl}</div>
                      <div style={{ fontSize:20, fontWeight:700, color:col }}>{val}</div>
                      <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding:"10px 14px", background:vs>0?"#ff444411":"#4ade8011", borderRadius:12, border:`1px solid ${vs>0?"#ff444433":"#4ade8033"}`, display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:18 }}>{vs>0?"📈":"📉"}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:vs>0?"#ff6b6b":"#4ade80" }}>{vs>0?"+":"-"}${Math.abs(vs).toFixed(0)}</span>
                  <span style={{ fontSize:11, color:"#666" }}>{Math.abs(vsPct).toFixed(0)}% {vs>0?"more":"less"} than same period last month</span>
                </div>
              </div>
            )}

            {/* Category bars */}
            <div style={{ background:"#12122a", borderRadius:16, padding:16, border:"1px solid #1e1e3a", marginBottom:12 }}>
              <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:14 }}>By Category</div>
              {byCat.map(c=><BarRow key={c.id} label={c.label} value={c.value} max={byCat[0].value} color={c.color} icon={c.icon} />)}
            </div>

            {/* All transactions */}
            <div style={{ background:"#12122a", borderRadius:16, padding:16, border:"1px solid #1e1e3a" }}>
              <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:12 }}>All Transactions</div>
              {allFiltered.map(e=><ExpRow key={e.id} e={e} />)}
            </div>
          </>
        )
      }
    </div>
  );
}

// ─── BANK TAB ─────────────────────────────────────────────────────────────────
function BankTab({ user, onImport }) {
  const [bankText,     setBankText]     = useState("");
  const [bankParsing,  setBankParsing]  = useState(false);
  const [pdfLoading,   setPdfLoading]   = useState(false);
  const [pdfInfo,      setPdfInfo]      = useState(null);
  const [bankResults,  setBankResults]  = useState([]);
  const [bankError,    setBankError]    = useState("");
  const [bankImported, setBankImported] = useState(false);
  const [defaultTag,   setDefaultTag]   = useState("personal");
  const fileRef = useRef();

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBankText(""); setBankImported(false); setBankResults([]); setBankError(""); setPdfInfo(null);
    if (file.type==="application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setPdfLoading(true);
      try {
        const buf = await file.arrayBuffer();
        const { text, pages } = await extractTextFromPDF(buf.slice(0));
        setPdfInfo({ name: file.name, pages });
        setBankText(text);
      } catch(err) { setBankError("Could not read PDF: " + err.message); }
      setPdfLoading(false);
    } else {
      setBankText(await file.text());
      setPdfInfo({ name: file.name, pages: null });
    }
    e.target.value = "";
  }

  async function handleParse() {
    if (!bankText.trim()) return;
    setBankParsing(true); setBankResults([]); setBankError("");
    try {
      const results = await categorizeStatement(bankText);
      if (!Array.isArray(results)||results.length===0) throw new Error("No transactions found.");
      setBankResults(results);
    } catch(err) { setBankError(err.message||"Failed to parse."); }
    setBankParsing(false);
  }

  function handleImport() {
    onImport(bankResults.map(r=>({ ...r, tag: defaultTag, amount: parseFloat(r.amount)||0 })));
    setBankImported(true); setBankText(""); setBankResults([]); setPdfInfo(null);
  }

  const spinner = { width:16, height:16, border:"2px solid currentColor", borderTopColor:"transparent", borderRadius:"50%", display:"inline-block", animation:"spin 0.7s linear infinite" };

  return (
    <div>
      <div style={{ fontSize:20, fontWeight:700, marginBottom:6 }}>Bank Import</div>
      <div style={{ fontSize:12, color:"#666", marginBottom:16 }}>Upload a PDF, CSV, or TXT bank statement — AI extracts and categorizes every transaction.</div>

      <div style={{ background:"#12122a", borderRadius:16, padding:16, border:"1px solid #1e1e3a", marginBottom:12 }}>
        <input ref={fileRef} type="file" accept=".pdf,.csv,.txt" style={{ display:"none" }} onChange={handleFileUpload} />
        <button style={{ width:"100%", padding:14, borderRadius:12, border:"2px dashed #5a4fe8", background:"#1a1a3a", color:"#a99fff", fontSize:14, fontWeight:600, cursor:"pointer", marginBottom:12, opacity:pdfLoading?0.6:1 }}
          onClick={()=>fileRef.current.click()} disabled={pdfLoading}>
          {pdfLoading ? "⏳ Reading PDF..." : "📄 Upload Statement (PDF / CSV / TXT)"}
        </button>

        {pdfInfo && !pdfLoading && (
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:"#0d2a1a", border:"1px solid #1a6a3a", borderRadius:10, marginBottom:12 }}>
            <span style={{ fontSize:20 }}>📄</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:"#4ade80", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{pdfInfo.name}</div>
              <div style={{ fontSize:11, color:"#555" }}>{pdfInfo.pages?`${pdfInfo.pages} pages · `:""}{bankText.length.toLocaleString()} chars ✓</div>
            </div>
            <button onClick={()=>{ setBankText(""); setPdfInfo(null); setBankResults([]); setBankError(""); }}
              style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:18 }}>✕</button>
          </div>
        )}

        {!pdfInfo && !pdfLoading && (
          <>
            <div style={{ fontSize:11, color:"#444", textAlign:"center", marginBottom:8 }}>— or paste statement text —</div>
            <textarea value={bankText} onChange={e=>{ setBankText(e.target.value); setBankImported(false); setBankResults([]); setBankError(""); }}
              placeholder={"Paste statement text here...\n2024-03-05  GRAB FOOD  $24.50\n2024-03-07  NTUC       $85.30"}
              style={{ width:"100%", background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:10, padding:"12px 14px", color:"#e8e8f0", fontSize:13, outline:"none", resize:"vertical", minHeight:100, fontFamily:"monospace", boxSizing:"border-box" }} />
          </>
        )}

        {bankError && <div style={{ color:"#ff6b6b", fontSize:12, marginTop:8, padding:"10px 12px", background:"#ff000014", borderRadius:8, border:"1px solid #ff000033" }}>⚠️ {bankError}</div>}

        {/* Default tag for imported transactions */}
        <div style={{ marginTop:12, marginBottom:12 }}>
          <div style={{ fontSize:11, color:"#888", marginBottom:8 }}>Tag imported transactions as:</div>
          <div style={{ display:"flex", gap:8 }}>
            {[["personal","👤 Personal","#45B7D1"],["house","🏠 House","#96CEB4"]].map(([v,l,c])=>(
              <button key={v} onClick={()=>setDefaultTag(v)}
                style={{ flex:1, padding:"8px", borderRadius:10, border:defaultTag===v?`1.5px solid ${c}`:"1.5px solid #2a2a4a", background:defaultTag===v?`${c}18`:"transparent", color:defaultTag===v?c:"#666", fontSize:12, fontWeight:defaultTag===v?700:400, cursor:"pointer" }}>{l}</button>
            ))}
          </div>
        </div>

        <button style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:"linear-gradient(135deg,#7c6fff,#5a4fe8)", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", opacity:(bankParsing||!bankText.trim()||pdfLoading)?0.45:1 }}
          onClick={handleParse} disabled={bankParsing||!bankText.trim()||pdfLoading}>
          {bankParsing
            ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><span style={spinner} /> Analyzing with AI...</span>
            : "🤖 Categorize with AI"}
        </button>
      </div>

      {bankResults.length > 0 && !bankImported && (
        <div style={{ background:"#12122a", borderRadius:16, padding:16, border:"1px solid #1e1e3a", marginBottom:12 }}>
          <div style={{ fontSize:12, color:"#888", fontWeight:600, marginBottom:4 }}>FOUND {bankResults.length} TRANSACTIONS</div>
          <div style={{ fontSize:11, color:"#555", marginBottom:12 }}>Total: <span style={{ color:"#ff8a8a", fontWeight:600 }}>${bankResults.reduce((s,r)=>s+parseFloat(r.amount||0),0).toFixed(2)}</span></div>
          {bankResults.map((r,i) => {
            const cat = getCatInfo(r.category);
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", padding:"9px 0", borderBottom:"1px solid #1a1a2e", gap:12 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:`${cat.color}22`, border:`1.5px solid ${cat.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>{cat.icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.description}</div>
                  <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{r.date} · <span style={{ color:cat.color }}>{cat.label}</span></div>
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:"#ff8a8a" }}>-${parseFloat(r.amount).toFixed(2)}</div>
              </div>
            );
          })}
          <button style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:"linear-gradient(135deg,#4ade80,#22c55e)", color:"#000", fontSize:15, fontWeight:700, cursor:"pointer", marginTop:14 }}
            onClick={handleImport}>✅ Import All {bankResults.length} Transactions</button>
        </div>
      )}

      {bankImported && (
        <div style={{ background:"#0a2a1a", borderRadius:16, border:"1px solid #1a5a3a", textAlign:"center", padding:28 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
          <div style={{ color:"#4ade80", fontWeight:700, fontSize:16 }}>Imported Successfully!</div>
          <div style={{ fontSize:12, color:"#555", marginTop:6 }}>All transactions added to your expenses</div>
        </div>
      )}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeUser, setActiveUser] = useState("Anirudh");
  const [view,       setView]       = useState("expense");

  const [expenses, setExpenses] = useState(() => {
    try { return JSON.parse(localStorage.getItem("spendwise_expenses")||"[]"); } catch { return []; }
  });
  const [earnings, setEarnings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("spendwise_earnings")||"[]"); } catch { return []; }
  });
  const [budgets, setBudgets] = useState(() => {
    try { return JSON.parse(localStorage.getItem("spendwise_budgets")||"{}"); } catch { return {}; }
  });

  useEffect(()=>{ localStorage.setItem("spendwise_expenses", JSON.stringify(expenses)); }, [expenses]);
  useEffect(()=>{ localStorage.setItem("spendwise_earnings", JSON.stringify(earnings)); }, [earnings]);
  useEffect(()=>{ localStorage.setItem("spendwise_budgets",  JSON.stringify(budgets));  }, [budgets]);

  function addExpense(data) {
    setExpenses(p=>[...p, { id:genId(), user:activeUser, source:"manual", ...data }]);
  }
  function deleteExpense(id) { setExpenses(p=>p.filter(e=>e.id!==id)); }

  function addEarning(data) {
    setEarnings(p=>[...p, { id:genId(), user:activeUser, ...data }]);
  }
  function deleteEarning(id) { setEarnings(p=>p.filter(e=>e.id!==id)); }

  function importBank(rows) {
    setExpenses(p=>[...p, ...rows.map(r=>({ id:genId(), user:activeUser, source:"bank", ...r }))]);
  }

  const tabs = [
    { id:"home",    icon:"📊", label:"Home"   },
    { id:"expense", icon:"➖", label:"Spend"  },
    { id:"earning", icon:"➕", label:"Earn"   },
    { id:"stats",   icon:"📈", label:"Stats"  },
    { id:"bank",    icon:"🏦", label:"Bank"   },
  ];

  return (
    <div style={{ background:"#0a0a16", minHeight:"100vh", color:"#e8e8f0", fontFamily:"'DM Sans','Segoe UI',sans-serif", maxWidth:480, margin:"0 auto" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ padding:"16px 20px 12px", borderBottom:"1px solid #1e1e3a", background:"rgba(10,10,22,0.96)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:17, fontWeight:700 }}>💸 Spendwise</div>
          <div style={{ display:"flex", gap:6 }}>
            {USERS.map(u=>(
              <button key={u} onClick={()=>setActiveUser(u)}
                style={{ padding:"5px 14px", borderRadius:20, border:activeUser===u?"1px solid #7c6fff":"1px solid #2a2a4a", background:activeUser===u?"#7c6fff22":"transparent", color:activeUser===u?"#a99fff":"#666", fontSize:12, cursor:"pointer", fontWeight:activeUser===u?600:400 }}>
                {u==="Anirudh"?"👤":"👩"} {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding:"20px 20px 100px" }}>
        {view==="home"    && <HomeTab    user={activeUser} expenses={expenses} earnings={earnings} budgets={budgets} setBudgets={setBudgets} />}
        {view==="expense" && <AddExpenseTab user={activeUser} onAdd={addExpense} />}
        {view==="earning" && <AddEarningTab user={activeUser} earnings={earnings} onAdd={addEarning} onDelete={deleteEarning} />}
        {view==="stats"   && <StatsTab   user={activeUser} expenses={expenses} />}
        {view==="bank"    && <BankTab    user={activeUser} onImport={importBank} />}
      </div>

      {/* Bottom nav */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, background:"rgba(10,10,22,0.97)", backdropFilter:"blur(16px)", borderTop:"1px solid #1e1e3a", padding:"10px 12px 28px", display:"flex", gap:4 }}>
        {tabs.map(t=>{
          const active = view===t.id;
          return (
            <button key={t.id} onClick={()=>setView(t.id)}
              style={{ flex:1, padding:"8px 2px", borderRadius:12, border:"none", background:active?"#7c6fff":"transparent", color:active?"#fff":"#555", fontSize:10, fontWeight:active?700:400, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
              <span style={{ fontSize:17 }}>{t.icon}</span>{t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
