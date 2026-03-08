import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id:"food",          label:"Food & Dining",    icon:"🍜", color:"#FF6B6B" },
  { id:"transport",     label:"Transport",         icon:"🚇", color:"#4ECDC4" },
  { id:"shopping",      label:"Shopping",          icon:"🛍️", color:"#45B7D1" },
  { id:"entertainment", label:"Entertainment",     icon:"🎬", color:"#96CEB4" },
  { id:"health",        label:"Health & Medical",  icon:"💊", color:"#FFEAA7" },
  { id:"utilities",     label:"Utilities & Bills", icon:"⚡", color:"#DDA0DD" },
  { id:"travel",        label:"Travel",            icon:"✈️", color:"#98D8C8" },
  { id:"groceries",     label:"Groceries",         icon:"🛒", color:"#F7DC6F" },
  { id:"education",     label:"Education",         icon:"📚", color:"#82E0AA" },
  { id:"others",        label:"Others",            icon:"📦", color:"#AEB6BF" },
];
const EARNING_TYPES = [
  { id:"salary",    label:"Salary",    icon:"💼" },
  { id:"freelance", label:"Freelance", icon:"💻" },
  { id:"bonus",     label:"Bonus",     icon:"🎁" },
  { id:"other",     label:"Other",     icon:"💰" },
];
const USERS  = ["Anirudh", "Wifey"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genId       = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const getMonthKey = d  => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}`; };
const getCatInfo  = id => CATEGORIES.find(c => c.id === id) ?? CATEGORIES.at(-1);
const MonthLabel  = k  => { const [y,m] = k.split("-").map(Number); return `${MONTHS[m]} ${y}`; };
const sumAmt      = arr => arr.reduce((s,e) => s + e.amount, 0);
const today       = () => new Date().toISOString().split("T")[0];

// ─── PDF Extraction ───────────────────────────────────────────────────────────
async function extractTextFromPDF(buf) {
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const pg = await pdf.getPage(i);
    const ct = await pg.getTextContent();
    const items = ct.items.slice().sort((a,b) => {
      const dy = Math.round(b.transform[5]) - Math.round(a.transform[5]);
      return dy !== 0 ? dy : a.transform[4] - b.transform[4];
    });
    let row = [], lastY = null;
    const rows = [];
    for (const it of items) {
      const y = Math.round(it.transform[5]);
      if (lastY === null || Math.abs(y - lastY) < 4) row.push(it.str);
      else { if (row.length) rows.push(row.join("  ")); row = [it.str]; }
      lastY = y;
    }
    if (row.length) rows.push(row.join("  "));
    out += rows.join("\n") + "\n\n";
  }
  return { text: out.trim(), pages: pdf.numPages };
}

async function categorizeStatement(text) {
  const res  = await fetch("/api/categorize", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ text }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  return data.transactions;
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────
const SI = { width:"100%", background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:10, padding:"11px 14px", color:"#e8e8f0", fontSize:14, outline:"none", boxSizing:"border-box" };
const SL = { fontSize:12, color:"#888", marginBottom:6, display:"block" };
const SC = { background:"#12122a", borderRadius:16, padding:16, border:"1px solid #1e1e3a", marginBottom:12 };

function Tag({ children, color }) {
  return <span style={{ fontSize:10, padding:"1px 7px", borderRadius:20, background:`${color}18`, color, border:`1px solid ${color}33` }}>{children}</span>;
}

function Pill({ active, color, onClick, children }) {
  return (
    <button onClick={onClick} style={{ padding:"6px 14px", borderRadius:20, border:`1px solid ${active?color:"#2a2a4a"}`, background:active?`${color}22`:"transparent", color:active?color:"#666", fontSize:12, cursor:"pointer", fontWeight:active?700:400 }}>
      {children}
    </button>
  );
}

function BarRow({ label, value, max, color, icon }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:5, color:"#ccc" }}>
        <span>{icon} {label}</span><span style={{ color, fontWeight:600 }}>${value.toFixed(2)}</span>
      </div>
      <div style={{ background:"#1a1a2e", borderRadius:6, height:6, overflow:"hidden" }}>
        <div style={{ width:`${max>0?(value/max)*100:0}%`, background:color, height:"100%", borderRadius:6, transition:"width 0.6s ease" }} />
      </div>
    </div>
  );
}

function DonutChart({ data, size=130 }) {
  const total = data.reduce((s,d)=>s+d.value,0);
  if (!total) return <div style={{ width:size, height:size, borderRadius:"50%", background:"#1a1a2e", border:"2px solid #2a2a4a", margin:"0 auto" }} />;
  let offset = 0;
  const r=50,cx=60,cy=60,sw=18,circ=2*Math.PI*r;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {data.map((d,i)=>{ const dash=(d.value/total)*circ; const el=<circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={sw} strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={-offset*circ/100} />; offset+=(d.value/total)*100; return el; })}
      <circle cx={cx} cy={cy} r={r-sw/2} fill="#0f0f1e" />
    </svg>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditExpenseModal({ expense, onSave, onClose }) {
  const [tag,      setTag]      = useState(expense.tag || "personal");
  const [category, setCategory] = useState(expense.category);
  const [amount,   setAmount]   = useState(String(expense.amount));
  const [desc,     setDesc]     = useState(expense.description);
  const [date,     setDate]     = useState(expense.date);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:100, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#12122a", borderRadius:"20px 20px 0 0", padding:"24px 20px 40px", width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:17, fontWeight:700 }}>Edit Expense</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#666", fontSize:22, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ marginBottom:16 }}>
          <span style={SL}>Tag</span>
          <div style={{ display:"flex", gap:10 }}>
            {[["personal","👤","Personal","#45B7D1"],["house","🏠","House","#96CEB4"]].map(([v,ic,lb,col])=>(
              <button key={v} onClick={()=>setTag(v)} style={{ flex:1, padding:"10px", borderRadius:12, border:tag===v?`2px solid ${col}`:"2px solid #1e1e3a", background:tag===v?`${col}18`:"#1a1a2e", cursor:"pointer", color:tag===v?col:"#666", fontWeight:tag===v?700:400 }}>{ic} {lb}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:16 }}>
          <span style={SL}>Category</span>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6 }}>
            {CATEGORIES.map(c=>(
              <div key={c.id} onClick={()=>setCategory(c.id)} style={{ padding:"8px 4px", borderRadius:10, border:category===c.id?`2px solid ${c.color}`:"2px solid #1e1e3a", background:category===c.id?`${c.color}18`:"#1a1a2e", cursor:"pointer", textAlign:"center" }}>
                <div style={{ fontSize:18 }}>{c.icon}</div>
                <div style={{ fontSize:8, color:category===c.id?c.color:"#666", marginTop:1 }}>{c.label.split(" ")[0]}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:12 }}><label style={SL}>Amount ($)</label><input style={SI} type="number" value={amount} onChange={e=>setAmount(e.target.value)} /></div>
        <div style={{ marginBottom:12 }}><label style={SL}>Description</label><input style={SI} type="text" value={desc} onChange={e=>setDesc(e.target.value)} /></div>
        <div style={{ marginBottom:20 }}><label style={SL}>Date</label><input style={SI} type="date" value={date} onChange={e=>setDate(e.target.value)} /></div>
        <button onClick={()=>onSave({ tag, category, amount:parseFloat(amount)||0, description:desc, date })}
          style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:"linear-gradient(135deg,#7c6fff,#5a4fe8)", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer" }}>
          Save Changes
        </button>
      </div>
    </div>
  );
}

function EditEarningModal({ earning, onSave, onClose }) {
  const [type,   setType]   = useState(earning.type);
  const [amount, setAmount] = useState(String(earning.amount));
  const [desc,   setDesc]   = useState(earning.description);
  const [date,   setDate]   = useState(earning.date);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:100, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#12122a", borderRadius:"20px 20px 0 0", padding:"24px 20px 40px", width:"100%", maxWidth:480 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:17, fontWeight:700 }}>Edit Earning</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#666", fontSize:22, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ marginBottom:16 }}>
          <span style={SL}>Type</span>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
            {EARNING_TYPES.map(t=>(
              <div key={t.id} onClick={()=>setType(t.id)} style={{ padding:"10px 4px", borderRadius:12, border:type===t.id?"2px solid #4ade80":"2px solid #1e1e3a", background:type===t.id?"#4ade8018":"#1a1a2e", cursor:"pointer", textAlign:"center" }}>
                <div style={{ fontSize:20 }}>{t.icon}</div>
                <div style={{ fontSize:9, color:type===t.id?"#4ade80":"#666", marginTop:2 }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:12 }}><label style={SL}>Amount ($)</label><input style={SI} type="number" value={amount} onChange={e=>setAmount(e.target.value)} /></div>
        <div style={{ marginBottom:12 }}><label style={SL}>Description</label><input style={SI} type="text" value={desc} onChange={e=>setDesc(e.target.value)} /></div>
        <div style={{ marginBottom:20 }}><label style={SL}>Date</label><input style={SI} type="date" value={date} onChange={e=>setDate(e.target.value)} /></div>
        <button onClick={()=>onSave({ type, amount:parseFloat(amount)||0, description:desc, date })}
          style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:"linear-gradient(135deg,#4ade80,#22c55e)", color:"#000", fontSize:15, fontWeight:700, cursor:"pointer" }}>
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ─── Expense Row (with swipe-to-reveal actions) ───────────────────────────────
function ExpRow({ e, onDelete, onEdit }) {
  const [open, setOpen] = useState(false);
  const cat = getCatInfo(e.category);
  return (
    <div style={{ position:"relative", overflow:"hidden", borderRadius:10, marginBottom:2 }}>
      {/* Action buttons revealed on tap */}
      {open && (
        <div style={{ position:"absolute", right:0, top:0, bottom:0, display:"flex", alignItems:"center", gap:6, padding:"0 8px", background:"#12122a", zIndex:1 }}>
          <button onClick={()=>{ onEdit(e); setOpen(false); }} style={{ background:"#7c6fff22", border:"1px solid #7c6fff44", color:"#a99fff", borderRadius:8, padding:"6px 12px", fontSize:12, cursor:"pointer", fontWeight:600 }}>✏️ Edit</button>
          <button onClick={()=>{ onDelete(e.id); setOpen(false); }} style={{ background:"#ff444422", border:"1px solid #ff444444", color:"#ff6b6b", borderRadius:8, padding:"6px 12px", fontSize:12, cursor:"pointer", fontWeight:600 }}>🗑️ Del</button>
          <button onClick={()=>setOpen(false)} style={{ background:"none", border:"none", color:"#555", fontSize:16, cursor:"pointer" }}>✕</button>
        </div>
      )}
      <div style={{ display:"flex", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #1a1a2e", gap:12, background:"#12122a", position:"relative", zIndex:0 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:`${cat.color}22`, border:`1.5px solid ${cat.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{cat.icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.description}</div>
          <div style={{ display:"flex", gap:5, marginTop:3, flexWrap:"wrap" }}>
            <Tag color={cat.color}>{cat.label}</Tag>
            <Tag color={e.tag==="house"?"#96CEB4":"#45B7D1"}>{e.tag==="house"?"🏠":"👤"}</Tag>
            {e.recurring && <Tag color="#FFD700">🔁</Tag>}
            {e.source==="bank" && <Tag color="#4ECDC4">Bank</Tag>}
          </div>
        </div>
        <div style={{ fontSize:14, fontWeight:700, color:"#ff8a8a", flexShrink:0 }}>-${e.amount.toFixed(2)}</div>
        <button onClick={()=>setOpen(o=>!o)} style={{ background:"none", border:"none", color:"#444", cursor:"pointer", fontSize:18, padding:"0 4px", flexShrink:0 }}>⋯</button>
      </div>
    </div>
  );
}

// ─── Budget Card ──────────────────────────────────────────────────────────────
function BudgetCard({ tag, icon, color, spent, budget, onSetBudget, lastMonthAmt, dayOfMonth }) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(budget));
  const pct = Math.min((spent/budget)*100,100);
  const remaining = budget - spent;
  const bColor = pct>=90?"#ff4444":pct>=70?"#ffaa00":color;
  const vs = spent - lastMonthAmt;
  const vsPct = lastMonthAmt>0?(vs/lastMonthAmt)*100:0;
  const prev = new Date(); prev.setMonth(prev.getMonth()-1);
  return (
    <div style={{ ...SC, borderColor:`${color}22` }}>
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
            <button onClick={()=>setEditing(false)} style={{ padding:"5px 8px", borderRadius:8, border:"1px solid #2a2a4a", background:"none", color:"#666", fontSize:12, cursor:"pointer" }}>✕</button>
          </div>
        ) : (
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:20, fontWeight:700, color:bColor }}>{pct.toFixed(0)}%</div>
            <button onClick={()=>{ setInputVal(String(budget)); setEditing(true); }} style={{ background:"none", border:"none", color:"#444", fontSize:10, cursor:"pointer", padding:0 }}>${budget.toLocaleString()} ✏️</button>
          </div>
        )}
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:10 }}>
        {[["Spent","#ff6b6b","#ff444411","#ff444422",`$${spent.toFixed(0)}`],
          [remaining>=0?"Left":"Over",bColor,`${bColor}11`,`${bColor}22`,`$${Math.abs(remaining).toFixed(0)}`],
          [vs>0?"▲ Last":"▼ Last",vs>0?"#ff6b6b":"#4ade80",vs>0?"#ff444411":"#4ade8011",vs>0?"#ff444422":"#4ade8022",`${vs>0?"+":"-"}$${Math.abs(vs).toFixed(0)}`],
        ].map(([lb,col,bg,bd,val])=>(
          <div key={lb} style={{ flex:1, background:bg, borderRadius:10, padding:"8px 4px", border:`1px solid ${bd}`, textAlign:"center" }}>
            <div style={{ fontSize:9, color:col, textTransform:"uppercase", letterSpacing:0.4, marginBottom:3 }}>{lb}</div>
            <div style={{ fontSize:14, fontWeight:700, color:col }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ background:"#1a1a2e", borderRadius:8, height:7, overflow:"hidden", marginBottom:6 }}>
        <div style={{ width:`${pct}%`, background:`linear-gradient(90deg,${bColor}66,${bColor})`, height:"100%", borderRadius:8, transition:"width 0.8s ease" }} />
      </div>
      {/* Daily limit */}
      {remaining > 0 && (() => {
        const now = new Date();
        const daysLeft = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate() - now.getDate();
        const dailyLeft = daysLeft > 0 ? remaining/daysLeft : 0;
        return <div style={{ fontSize:10, color:"#555" }}>💡 ${dailyLeft.toFixed(0)}/day left · {vs>0?"📈":"📉"} {Math.abs(vsPct).toFixed(0)}% vs {MONTHS[prev.getMonth()]} 1–{dayOfMonth}</div>;
      })()}
    </div>
  );
}

// ─── HOME TAB ─────────────────────────────────────────────────────────────────
function HomeTab({ user, expenses, earnings, budgets, setBudgets, savingsGoal, setSavingsGoal, streak }) {
  const now          = new Date();
  const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const dayOfMonth   = now.getDate();
  const prevDate     = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${prevDate.getMonth()}`;

  const userExp       = expenses.filter(e=>e.user===user);
  const userEarn      = earnings.filter(e=>e.user===user);
  const thisMonthExp  = userExp.filter(e=>getMonthKey(e.date)===thisMonthKey);
  const prevMonthExp  = userExp.filter(e=>getMonthKey(e.date)===prevMonthKey && new Date(e.date).getDate()<=dayOfMonth);
  const thisMonthEarn = userEarn.filter(e=>getMonthKey(e.date)===thisMonthKey);

  const totalEarned   = sumAmt(thisMonthEarn);
  const personalSpent = sumAmt(thisMonthExp.filter(e=>e.tag==="personal"));
  const houseSpent    = sumAmt(thisMonthExp.filter(e=>e.tag==="house"));
  const totalSpent    = personalSpent + houseSpent;
  const saved         = totalEarned - totalSpent;
  const savingsPct    = totalEarned>0?(saved/totalEarned)*100:0;
  const prevPersonal  = sumAmt(prevMonthExp.filter(e=>e.tag==="personal"));
  const prevHouse     = sumAmt(prevMonthExp.filter(e=>e.tag==="house"));
  const userBudgets   = budgets[user] || { personal:1500, house:1500 };
  const recent        = [...thisMonthExp].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);

  // Spending alerts
  const personalPct = (personalSpent/userBudgets.personal)*100;
  const housePct    = (houseSpent/userBudgets.house)*100;
  const alerts      = [];
  if (personalPct>=80 && personalPct<100) alerts.push(`⚠️ Personal budget ${personalPct.toFixed(0)}% used`);
  if (personalPct>=100) alerts.push(`🚨 Personal budget exceeded!`);
  if (housePct>=80 && housePct<100) alerts.push(`⚠️ House budget ${housePct.toFixed(0)}% used`);
  if (housePct>=100) alerts.push(`🚨 House budget exceeded!`);

  // Savings goal
  const [editGoal, setEditGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(savingsGoal.target||0));
  const goalProgress = savingsGoal.target>0 ? Math.min((savingsGoal.saved/savingsGoal.target)*100,100) : 0;

  function setBudgetFor(tag, val) { setBudgets(b=>({...b,[user]:{...userBudgets,[tag]:val}})); }

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:20, fontWeight:700 }}>Hey {user} 👋</div>
            <div style={{ fontSize:12, color:"#555" }}>{MONTHS[now.getMonth()]} {now.getFullYear()}</div>
          </div>
          {streak > 0 && (
            <div style={{ background:"#ff6b2222", border:"1px solid #ff6b2244", borderRadius:12, padding:"6px 12px", textAlign:"center" }}>
              <div style={{ fontSize:18 }}>🔥</div>
              <div style={{ fontSize:10, color:"#ff8a50", fontWeight:700 }}>{streak}mo</div>
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {alerts.map((a,i)=>(
        <div key={i} style={{ background:"#ff444411", border:"1px solid #ff444433", borderRadius:12, padding:"10px 14px", marginBottom:8, fontSize:12, color:"#ff8a8a" }}>{a}</div>
      ))}

      {/* Earned / Spent / Saved */}
      <div style={{ background:"linear-gradient(135deg,#0d2a1a,#12122a)", borderRadius:16, padding:16, border:"1px solid #4ade8022", marginBottom:12 }}>
        <div style={{ fontSize:11, color:"#4ade80", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:12 }}>💰 This Month</div>
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          {[["Earned","#4ade80","#4ade8011","#4ade8022",totalEarned===0?"$0":`$${totalEarned.toLocaleString()}`],
            ["Spent","#ff6b6b","#ff444411","#ff444422",`$${totalSpent.toFixed(0)}`],
            ["Saved",saved>=0?"#a99fff":"#ff6b6b",saved>=0?"#7c6fff11":"#ff444411",saved>=0?"#7c6fff22":"#ff444422",`$${Math.abs(saved).toFixed(0)}`],
          ].map(([lb,col,bg,bd,val])=>(
            <div key={lb} style={{ flex:1, textAlign:"center", padding:"10px 4px", background:bg, borderRadius:12, border:`1px solid ${bd}` }}>
              <div style={{ fontSize:9, color:`${col}aa`, textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 }}>{lb}</div>
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

      {/* Savings Goal */}
      {(savingsGoal.target>0 || editGoal) && (
        <div style={{ ...SC, borderColor:"#FFD70033" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:600 }}>🎯 Savings Goal</div>
            <button onClick={()=>{ setGoalInput(String(savingsGoal.target||0)); setEditGoal(true); }} style={{ background:"none", border:"none", color:"#444", fontSize:11, cursor:"pointer" }}>✏️ edit</button>
          </div>
          {editGoal ? (
            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
              <input value={goalInput} onChange={e=>setGoalInput(e.target.value)} type="number" placeholder="Target $"
                style={{ ...SI, flex:1, padding:"8px 10px" }} autoFocus />
              <button onClick={()=>{ setSavingsGoal(g=>({...g,target:parseFloat(goalInput)||0})); setEditGoal(false); }}
                style={{ padding:"8px 14px", borderRadius:10, border:"none", background:"#FFD700", color:"#000", fontWeight:700, cursor:"pointer" }}>Set</button>
            </div>
          ) : null}
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#888", marginBottom:6 }}>
            <span>Saved: <span style={{ color:"#4ade80", fontWeight:600 }}>${savingsGoal.saved.toFixed(0)}</span></span>
            <span>Target: <span style={{ color:"#FFD700", fontWeight:600 }}>${savingsGoal.target.toLocaleString()}</span></span>
          </div>
          <div style={{ background:"#1a1a2e", borderRadius:8, height:10, overflow:"hidden", marginBottom:6 }}>
            <div style={{ width:`${goalProgress}%`, background:"linear-gradient(90deg,#FFD70066,#FFD700)", height:"100%", borderRadius:8, transition:"width 0.8s ease" }} />
          </div>
          <div style={{ fontSize:11, color:"#555" }}>{goalProgress.toFixed(0)}% of goal · ${Math.max(0,savingsGoal.target-savingsGoal.saved).toFixed(0)} to go</div>
        </div>
      )}
      {savingsGoal.target===0 && !editGoal && (
        <button onClick={()=>setEditGoal(true)} style={{ width:"100%", padding:"10px", borderRadius:12, border:"1px dashed #2a2a4a", background:"transparent", color:"#555", fontSize:12, cursor:"pointer", marginBottom:12 }}>
          🎯 Set a savings goal
        </button>
      )}

      <BudgetCard tag="personal" icon="👤" color="#45B7D1" spent={personalSpent} budget={userBudgets.personal} onSetBudget={v=>setBudgetFor("personal",v)} lastMonthAmt={prevPersonal} dayOfMonth={dayOfMonth} />
      <BudgetCard tag="house"    icon="🏠" color="#96CEB4" spent={houseSpent}    budget={userBudgets.house}    onSetBudget={v=>setBudgetFor("house",v)}    lastMonthAmt={prevHouse}    dayOfMonth={dayOfMonth} />

      {/* Recent */}
      <div style={SC}>
        <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:12 }}>Recent</div>
        {recent.length===0
          ? <div style={{ textAlign:"center", color:"#444", padding:"16px 0", fontSize:13 }}>No expenses yet. Tap ➖ to add!</div>
          : recent.map(e=><ExpRow key={e.id} e={e} onDelete={()=>{}} onEdit={()=>{}} />)
        }
      </div>
    </div>
  );
}

// ─── ADD EXPENSE TAB ──────────────────────────────────────────────────────────
function AddExpenseTab({ user, expenses, onAdd, onDelete, onEdit, favourites, onToggleFav }) {
  const now = new Date();
  const [tag,       setTag]       = useState("personal");
  const [category,  setCategory]  = useState("food");
  const [amount,    setAmount]    = useState("");
  const [desc,      setDesc]      = useState("");
  const [date,      setDate]      = useState(today());
  const [recurring, setRecurring] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [search, setSearch] = useState("");

  const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const userExp = expenses.filter(e=>e.user===user);
  const recentAll = [...userExp].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const filtered = search.trim()
    ? recentAll.filter(e=>e.description.toLowerCase().includes(search.toLowerCase()) || e.category.includes(search.toLowerCase()))
    : recentAll.slice(0,30);

  function handleAdd() {
    if (!amount) return;
    const cat = getCatInfo(category);
    const finalDesc = desc.trim() || cat.label;
    onAdd({ tag, category, amount:parseFloat(amount), description:finalDesc, date, recurring });
    setAmount(""); setDesc(""); setRecurring(false);
  }

  function handleQuickAdd(fav) {
    onAdd({ tag:fav.tag, category:fav.category, amount:fav.amount, description:fav.description, date:today(), recurring:false });
  }

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:700, marginBottom:16 }}>Add Expense</div>

      {/* Quick-add favourites */}
      {favourites.length>0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>⭐ Quick Add</div>
          <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4 }}>
            {favourites.map((f,i)=>{
              const cat=getCatInfo(f.category);
              return (
                <button key={i} onClick={()=>handleQuickAdd(f)}
                  style={{ flexShrink:0, background:`${cat.color}11`, border:`1px solid ${cat.color}33`, borderRadius:12, padding:"8px 12px", cursor:"pointer", textAlign:"center", minWidth:72 }}>
                  <div style={{ fontSize:20 }}>{cat.icon}</div>
                  <div style={{ fontSize:10, color:cat.color, marginTop:2, fontWeight:600 }}>${f.amount}</div>
                  <div style={{ fontSize:9, color:"#666", marginTop:1 }}>{f.description.slice(0,8)}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tag */}
      <div style={{ marginBottom:16 }}>
        <span style={SL}>This is for...</span>
        <div style={{ display:"flex", gap:10 }}>
          {[["personal","👤","Personal","Just for me","#45B7D1"],["house","🏠","House","Household","#96CEB4"]].map(([v,ic,lb,sub,col])=>(
            <button key={v} onClick={()=>setTag(v)} style={{ flex:1, padding:"12px", borderRadius:14, border:tag===v?`2px solid ${col}`:"2px solid #1e1e3a", background:tag===v?`${col}18`:"#12122a", cursor:"pointer" }}>
              <div style={{ fontSize:22, marginBottom:3 }}>{ic}</div>
              <div style={{ fontSize:13, fontWeight:600, color:tag===v?col:"#666" }}>{lb}</div>
              <div style={{ fontSize:10, color:"#555" }}>{sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div style={{ marginBottom:16 }}>
        <span style={SL}>Category</span>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
          {CATEGORIES.map(c=>(
            <div key={c.id} onClick={()=>setCategory(c.id)} style={{ padding:"9px 4px", borderRadius:12, border:category===c.id?`2px solid ${c.color}`:"2px solid #1e1e3a", background:category===c.id?`${c.color}18`:"#12122a", cursor:"pointer", textAlign:"center" }}>
              <div style={{ fontSize:20 }}>{c.icon}</div>
              <div style={{ fontSize:9, color:category===c.id?c.color:"#666", marginTop:2 }}>{c.label.split(" ")[0]}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom:12 }}><label style={SL}>Amount ($)</label><input style={SI} type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)} /></div>
      <div style={{ marginBottom:12 }}><label style={SL}>Description (optional)</label><input style={SI} type="text" placeholder={getCatInfo(category).label} value={desc} onChange={e=>setDesc(e.target.value)} /></div>
      <div style={{ marginBottom:12 }}><label style={SL}>Date</label><input style={SI} type="date" value={date} onChange={e=>setDate(e.target.value)} /></div>

      {/* Recurring + Favourite */}
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <button onClick={()=>setRecurring(r=>!r)}
          style={{ flex:1, padding:"10px", borderRadius:12, border:recurring?"1px solid #FFD70066":"1px solid #2a2a4a", background:recurring?"#FFD70011":"transparent", color:recurring?"#FFD700":"#666", fontSize:12, cursor:"pointer" }}>
          🔁 {recurring?"Recurring":"Set Recurring"}
        </button>
        <button onClick={()=>{ if(amount) onToggleFav({ tag, category, amount:parseFloat(amount), description:desc.trim()||getCatInfo(category).label }); }}
          style={{ flex:1, padding:"10px", borderRadius:12, border:"1px solid #2a2a4a", background:"transparent", color:"#666", fontSize:12, cursor:"pointer", opacity:amount?1:0.4 }}>
          ⭐ Save as Fav
        </button>
      </div>

      <button onClick={handleAdd} disabled={!amount}
        style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:"linear-gradient(135deg,#7c6fff,#5a4fe8)", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", opacity:amount?1:0.5, marginBottom:24 }}>
        Add Expense
      </button>

      {/* Search + transaction list */}
      <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>🔍 All Transactions</div>
      <input style={{ ...SI, marginBottom:10 }} placeholder="Search by name or category..." value={search} onChange={e=>setSearch(e.target.value)} />

      <div style={SC}>
        {filtered.length===0
          ? <div style={{ textAlign:"center", color:"#444", padding:"16px 0", fontSize:13 }}>No transactions found.</div>
          : filtered.map(e=><ExpRow key={e.id} e={e} onDelete={onDelete} onEdit={setEditTarget} />)
        }
      </div>

      {editTarget && <EditExpenseModal expense={editTarget} onSave={data=>{ onEdit(editTarget.id, data); setEditTarget(null); }} onClose={()=>setEditTarget(null)} />}
    </div>
  );
}

// ─── EARN TAB ─────────────────────────────────────────────────────────────────
function AddEarningTab({ user, earnings, onAdd, onDelete, onEdit }) {
  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const userEarn = earnings.filter(e=>e.user===user);
  const thisMonthEarn = userEarn.filter(e=>getMonthKey(e.date)===thisMonthKey);
  const totalEarned = sumAmt(thisMonthEarn);

  const [type,   setType]   = useState("salary");
  const [amount, setAmount] = useState("");
  const [desc,   setDesc]   = useState("");
  const [date,   setDate]   = useState(today());
  const [editTarget, setEditTarget] = useState(null);

  function handleAdd() {
    if (!amount) return;
    onAdd({ type, amount:parseFloat(amount), description:desc.trim()||EARNING_TYPES.find(t=>t.id===type)?.label||type, date });
    setAmount(""); setDesc("");
  }

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>Add Earning</div>
      <div style={{ fontSize:12, color:"#555", marginBottom:16 }}>This month: <span style={{ color:"#4ade80", fontWeight:600 }}>${totalEarned.toLocaleString()}</span></div>

      {thisMonthEarn.length>0 && (
        <div style={{ ...SC, marginBottom:16 }}>
          <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:10 }}>This Month's Earnings</div>
          {thisMonthEarn.map(e=>(
            <div key={e.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #1a1a2e" }}>
              <div>
                <div style={{ fontSize:13, fontWeight:500 }}>{e.description}</div>
                <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{e.date} · {e.type}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ fontSize:14, fontWeight:700, color:"#4ade80" }}>+${e.amount.toLocaleString()}</div>
                <button onClick={()=>setEditTarget(e)} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:14 }}>✏️</button>
                <button onClick={()=>onDelete(e.id)} style={{ background:"none", border:"none", color:"#444", cursor:"pointer", fontSize:14 }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom:16 }}>
        <span style={SL}>Type</span>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {EARNING_TYPES.map(t=>(
            <div key={t.id} onClick={()=>setType(t.id)} style={{ padding:"10px 4px", borderRadius:12, border:type===t.id?"2px solid #4ade80":"2px solid #1e1e3a", background:type===t.id?"#4ade8018":"#12122a", cursor:"pointer", textAlign:"center" }}>
              <div style={{ fontSize:20 }}>{t.icon}</div>
              <div style={{ fontSize:9, color:type===t.id?"#4ade80":"#666", marginTop:2 }}>{t.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom:12 }}><label style={SL}>Amount ($)</label><input style={SI} type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)} /></div>
      <div style={{ marginBottom:12 }}><label style={SL}>Description (optional)</label><input style={SI} type="text" placeholder={EARNING_TYPES.find(t=>t.id===type)?.label} value={desc} onChange={e=>setDesc(e.target.value)} /></div>
      <div style={{ marginBottom:20 }}><label style={SL}>Date</label><input style={SI} type="date" value={date} onChange={e=>setDate(e.target.value)} /></div>
      <button onClick={handleAdd} disabled={!amount}
        style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:"linear-gradient(135deg,#4ade80,#22c55e)", color:"#000", fontSize:15, fontWeight:700, cursor:"pointer", opacity:amount?1:0.5 }}>
        Add Earning
      </button>
      {editTarget && <EditEarningModal earning={editTarget} onSave={data=>{ onEdit(editTarget.id, data); setEditTarget(null); }} onClose={()=>setEditTarget(null)} />}
    </div>
  );
}

// ─── STATS TAB ────────────────────────────────────────────────────────────────
function StatsTab({ user, expenses, earnings }) {
  const now          = new Date();
  const dayOfMonth   = now.getDate();
  const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const prevDate     = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${prevDate.getMonth()}`;

  const [tagFilter,       setTagFilter]       = useState("all");
  const [analyticsPeriod, setAnalyticsPeriod] = useState(thisMonthKey);

  const userExp     = expenses.filter(e=>e.user===user);
  const userEarn    = earnings.filter(e=>e.user===user);
  const available   = [...new Set(userExp.map(e=>getMonthKey(e.date)))].sort().reverse();
  const periodExp   = userExp.filter(e=>getMonthKey(e.date)===analyticsPeriod);
  const filtered    = tagFilter==="all" ? periodExp : periodExp.filter(e=>e.tag===tagFilter);
  const thisSpent   = sumAmt(filtered);
  const prevFiltered = userExp.filter(e=>{ const d=new Date(e.date); return getMonthKey(e.date)===prevMonthKey && d.getDate()<=dayOfMonth && (tagFilter==="all"||e.tag===tagFilter); });
  const prevSpent   = sumAmt(prevFiltered);
  const vs          = thisSpent - prevSpent;
  const vsPct       = prevSpent>0?(vs/prevSpent)*100:0;
  const byCat       = CATEGORIES.map(c=>({...c,value:sumAmt(filtered.filter(e=>e.category===c.id))})).filter(c=>c.value>0).sort((a,b)=>b.value-a.value);

  // 6-month trend
  const trendMonths = Array.from({length:6},(_,i)=>{ const d=new Date(now.getFullYear(),now.getMonth()-5+i,1); return `${d.getFullYear()}-${d.getMonth()}`; });
  const trendData   = trendMonths.map(mk=>{
    const [y,m] = mk.split("-").map(Number);
    const exp   = userExp.filter(e=>getMonthKey(e.date)===mk);
    const earn  = userEarn.filter(e=>getMonthKey(e.date)===mk);
    return { label:MONTHS[m], personal:sumAmt(exp.filter(e=>e.tag==="personal")), house:sumAmt(exp.filter(e=>e.tag==="house")), earned:sumAmt(earn) };
  });
  const trendMax = Math.max(...trendData.map(d=>d.personal+d.house), 1);

  // Monthly report card
  const grade = (() => { if (thisSpent===0) return null; const pct=(thisSpent/(sumAmt(userEarn.filter(e=>getMonthKey(e.date)===analyticsPeriod))))*100; if (pct<50) return {g:"A",c:"#4ade80",t:"Excellent!"}; if (pct<70) return {g:"B",c:"#FFD700",t:"Good job"}; if (pct<90) return {g:"C",c:"#ffaa00",t:"Watch out"}; return {g:"D",c:"#ff6b6b",t:"Over budget"}; })();

  // Export CSV
  function exportCSV() {
    const rows = [["Date","Description","Category","Tag","Amount","Recurring"],...filtered.map(e=>[e.date,e.description,e.category,e.tag||"",e.amount,(e.recurring?"yes":"no")])];
    const csv  = rows.map(r=>r.join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href=url; a.download=`spendwise-${analyticsPeriod}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ fontSize:18, fontWeight:700 }}>Analytics</div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={exportCSV} style={{ background:"#1a1a3a", border:"1px solid #2a2a5a", borderRadius:10, padding:"6px 12px", color:"#a99fff", fontSize:11, cursor:"pointer" }}>📤 CSV</button>
          <select value={analyticsPeriod} onChange={e=>setAnalyticsPeriod(e.target.value)}
            style={{ background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:10, padding:"6px 10px", color:"#e8e8f0", fontSize:12, outline:"none" }}>
            {available.length===0 && <option value={thisMonthKey}>{MonthLabel(thisMonthKey)}</option>}
            {available.map(m=><option key={m} value={m}>{MonthLabel(m)}</option>)}
          </select>
        </div>
      </div>

      {/* Tag filter */}
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {[["all","All 📊","#7c6fff"],["personal","Personal 👤","#45B7D1"],["house","House 🏠","#96CEB4"]].map(([v,l,c])=>(
          <button key={v} onClick={()=>setTagFilter(v)} style={{ flex:1, padding:"9px 4px", borderRadius:10, border:tagFilter===v?`1.5px solid ${c}`:"1.5px solid #2a2a4a", background:tagFilter===v?`${c}18`:"#12122a", color:tagFilter===v?c:"#666", fontSize:11, fontWeight:tagFilter===v?700:400, cursor:"pointer" }}>{l}</button>
        ))}
      </div>

      {/* Report card */}
      {grade && analyticsPeriod===thisMonthKey && (
        <div style={{ ...SC, borderColor:`${grade.c}33`, display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:52, height:52, borderRadius:14, background:`${grade.c}22`, border:`2px solid ${grade.c}66`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, fontWeight:900, color:grade.c, flexShrink:0 }}>{grade.g}</div>
          <div>
            <div style={{ fontSize:14, fontWeight:700 }}>{grade.t}</div>
            <div style={{ fontSize:11, color:"#555", marginTop:2 }}>Monthly spending grade</div>
            {byCat[0] && <div style={{ fontSize:11, color:"#888", marginTop:4 }}>Biggest: {byCat[0].icon} {byCat[0].label} ${byCat[0].value.toFixed(0)}</div>}
          </div>
        </div>
      )}

      {/* 6-month trend chart */}
      <div style={SC}>
        <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:14 }}>📊 6-Month Trend</div>
        <div style={{ display:"flex", gap:6, alignItems:"flex-end", height:80 }}>
          {trendData.map((d,i)=>{
            const total = d.personal+d.house;
            const h     = trendMax>0?(total/trendMax)*72:0;
            const pH    = total>0?(d.personal/total)*h:0;
            const hH    = h-pH;
            const isNow = i===5;
            return (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
                <div style={{ width:"100%", display:"flex", flexDirection:"column", alignItems:"center" }}>
                  <div style={{ width:"100%", height:hH, background:"#96CEB466", borderRadius:"4px 4px 0 0", minHeight:hH>0?2:0 }} />
                  <div style={{ width:"100%", height:pH, background:"#45B7D166", minHeight:pH>0?2:0 }} />
                </div>
                <div style={{ fontSize:9, color:isNow?"#a99fff":"#555", fontWeight:isNow?700:400 }}>{d.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display:"flex", gap:12, marginTop:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:"#888" }}><div style={{ width:10, height:10, background:"#45B7D166", borderRadius:2 }}/>Personal</div>
          <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:"#888" }}><div style={{ width:10, height:10, background:"#96CEB466", borderRadius:2 }}/>House</div>
        </div>
      </div>

      {filtered.length===0 ? (
        <div style={{ textAlign:"center", color:"#444", padding:"32px 0", fontSize:13 }}>No expenses for this selection.</div>
      ) : (
        <>
          {/* Total + donut */}
          <div style={{ ...SC, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Total Spent</div>
              <div style={{ fontSize:30, fontWeight:700, color:"#ff8a8a" }}>${thisSpent.toFixed(2)}</div>
              <div style={{ fontSize:12, color:"#555", marginTop:4 }}>{filtered.length} transactions</div>
            </div>
            <DonutChart data={byCat.map(c=>({color:c.color,value:c.value}))} />
          </div>

          {/* Same-period comparison */}
          {analyticsPeriod===thisMonthKey && prevSpent>0 && (
            <div style={SC}>
              <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:12 }}>
                {MONTHS[now.getMonth()]} 1–{dayOfMonth} vs {MONTHS[prevDate.getMonth()]} 1–{dayOfMonth}
              </div>
              <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                {[["This month","#7c6fff","#7c6fff11","#7c6fff33",`$${thisSpent.toFixed(0)}`],
                  ["Last month","#4ECDC4","#4ECDC411","#4ECDC433",`$${prevSpent.toFixed(0)}`],
                ].map(([lb,col,bg,bd,val])=>(
                  <div key={lb} style={{ flex:1, background:bg, borderRadius:12, padding:"12px", border:`1px solid ${bd}` }}>
                    <div style={{ fontSize:10, color:col, marginBottom:4 }}>{lb}</div>
                    <div style={{ fontSize:20, fontWeight:700, color:col }}>{val}</div>
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
          <div style={SC}>
            <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:14 }}>By Category</div>
            {byCat.map(c=><BarRow key={c.id} label={c.label} value={c.value} max={byCat[0].value} color={c.color} icon={c.icon} />)}
          </div>

          {/* All transactions */}
          <div style={SC}>
            <div style={{ fontSize:11, color:"#888", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:10 }}>All Transactions</div>
            {[...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(e=><ExpRow key={e.id} e={e} onDelete={()=>{}} onEdit={()=>{}} />)}
          </div>
        </>
      )}
    </div>
  );
}

// ─── BANK TAB ─────────────────────────────────────────────────────────────────
function BankTab({ onImport }) {
  const [bankText,     setBankText]     = useState("");
  const [bankParsing,  setBankParsing]  = useState(false);
  const [pdfLoading,   setPdfLoading]   = useState(false);
  const [pdfInfo,      setPdfInfo]      = useState(null);
  const [bankResults,  setBankResults]  = useState([]);
  const [bankError,    setBankError]    = useState("");
  const [bankImported, setBankImported] = useState(false);
  const [defaultTag,   setDefaultTag]   = useState("personal");
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files[0]; if (!file) return;
    setBankText(""); setBankImported(false); setBankResults([]); setBankError(""); setPdfInfo(null);
    if (file.type==="application/pdf"||file.name.toLowerCase().endsWith(".pdf")) {
      setPdfLoading(true);
      try { const buf=await file.arrayBuffer(); const {text,pages}=await extractTextFromPDF(buf.slice(0)); setPdfInfo({name:file.name,pages}); setBankText(text); }
      catch(err) { setBankError("Could not read PDF: "+err.message); }
      setPdfLoading(false);
    } else { setBankText(await file.text()); setPdfInfo({name:file.name,pages:null}); }
    e.target.value="";
  }

  async function handleParse() {
    if (!bankText.trim()) return;
    setBankParsing(true); setBankResults([]); setBankError("");
    try { const r=await categorizeStatement(bankText); if (!Array.isArray(r)||r.length===0) throw new Error("No transactions found."); setBankResults(r); }
    catch(err) { setBankError(err.message||"Failed to parse."); }
    setBankParsing(false);
  }

  function handleImport() {
    onImport(bankResults.map(r=>({...r,tag:defaultTag,amount:parseFloat(r.amount)||0})));
    setBankImported(true); setBankText(""); setBankResults([]); setPdfInfo(null);
  }

  const spin = { width:16, height:16, border:"2px solid currentColor", borderTopColor:"transparent", borderRadius:"50%", display:"inline-block", animation:"spin 0.7s linear infinite" };

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>Bank Import</div>
      <div style={{ fontSize:12, color:"#666", marginBottom:14 }}>Upload a PDF, CSV, or TXT bank statement.</div>
      <div style={SC}>
        <input ref={fileRef} type="file" accept=".pdf,.csv,.txt" style={{ display:"none" }} onChange={handleFile} />
        <button onClick={()=>fileRef.current.click()} disabled={pdfLoading}
          style={{ width:"100%", padding:13, borderRadius:12, border:"2px dashed #5a4fe8", background:"#1a1a3a", color:"#a99fff", fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:10, opacity:pdfLoading?0.6:1 }}>
          {pdfLoading?"⏳ Reading PDF...":"📄 Upload Statement (PDF / CSV / TXT)"}
        </button>
        {pdfInfo && !pdfLoading && (
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:"#0d2a1a", border:"1px solid #1a6a3a", borderRadius:10, marginBottom:10 }}>
            <span style={{ fontSize:20 }}>📄</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:"#4ade80", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{pdfInfo.name}</div>
              <div style={{ fontSize:11, color:"#555" }}>{pdfInfo.pages?`${pdfInfo.pages} pages · `:""}{bankText.length.toLocaleString()} chars ✓</div>
            </div>
            <button onClick={()=>{ setBankText(""); setPdfInfo(null); setBankResults([]); setBankError(""); }} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:18 }}>✕</button>
          </div>
        )}
        {!pdfInfo && !pdfLoading && (
          <textarea value={bankText} onChange={e=>{ setBankText(e.target.value); setBankImported(false); setBankResults([]); setBankError(""); }}
            placeholder={"Paste statement text...\n2024-03-05  GRAB FOOD  $24.50"}
            style={{ width:"100%", background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:10, padding:"12px 14px", color:"#e8e8f0", fontSize:13, outline:"none", resize:"vertical", minHeight:90, fontFamily:"monospace", boxSizing:"border-box", marginBottom:10 }} />
        )}
        {bankError && <div style={{ color:"#ff6b6b", fontSize:12, marginBottom:10, padding:"10px 12px", background:"#ff000014", borderRadius:8 }}>⚠️ {bankError}</div>}
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:"#888", marginBottom:6 }}>Tag imports as:</div>
          <div style={{ display:"flex", gap:8 }}>
            {[["personal","👤 Personal","#45B7D1"],["house","🏠 House","#96CEB4"]].map(([v,l,c])=>(
              <button key={v} onClick={()=>setDefaultTag(v)} style={{ flex:1, padding:"8px", borderRadius:10, border:defaultTag===v?`1.5px solid ${c}`:"1.5px solid #2a2a4a", background:defaultTag===v?`${c}18`:"transparent", color:defaultTag===v?c:"#666", fontSize:12, fontWeight:defaultTag===v?700:400, cursor:"pointer" }}>{l}</button>
            ))}
          </div>
        </div>
        <button onClick={handleParse} disabled={bankParsing||!bankText.trim()||pdfLoading}
          style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:"linear-gradient(135deg,#7c6fff,#5a4fe8)", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", opacity:(bankParsing||!bankText.trim()||pdfLoading)?0.45:1 }}>
          {bankParsing ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><span style={spin}/>Analyzing...</span> : "🤖 Categorize with AI"}
        </button>
      </div>

      {bankResults.length>0 && !bankImported && (
        <div style={SC}>
          <div style={{ fontSize:12, color:"#888", fontWeight:600, marginBottom:4 }}>FOUND {bankResults.length} TRANSACTIONS</div>
          <div style={{ fontSize:11, color:"#555", marginBottom:12 }}>Total: <span style={{ color:"#ff8a8a", fontWeight:600 }}>${bankResults.reduce((s,r)=>s+parseFloat(r.amount||0),0).toFixed(2)}</span></div>
          {bankResults.map((r,i)=>{ const cat=getCatInfo(r.category); return (
            <div key={i} style={{ display:"flex", alignItems:"center", padding:"9px 0", borderBottom:"1px solid #1a1a2e", gap:12 }}>
              <div style={{ width:34, height:34, borderRadius:9, background:`${cat.color}22`, border:`1.5px solid ${cat.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>{cat.icon}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.description}</div>
                <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{r.date} · <span style={{ color:cat.color }}>{cat.label}</span></div>
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:"#ff8a8a" }}>-${parseFloat(r.amount).toFixed(2)}</div>
            </div>
          ); })}
          <button onClick={handleImport} style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:"linear-gradient(135deg,#4ade80,#22c55e)", color:"#000", fontSize:15, fontWeight:700, cursor:"pointer", marginTop:14 }}>
            ✅ Import All {bankResults.length} Transactions
          </button>
        </div>
      )}
      {bankImported && (
        <div style={{ ...SC, background:"#0a2a1a", borderColor:"#1a5a3a", textAlign:"center", padding:28 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
          <div style={{ color:"#4ade80", fontWeight:700, fontSize:16 }}>Imported Successfully!</div>
        </div>
      )}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeUser, setActiveUser] = useState("Anirudh");
  const [view,       setView]       = useState("expense");

  const [expenses,  setExpenses]  = useState(()=>{ try{return JSON.parse(localStorage.getItem("spendwise_expenses")||"[]");}catch{return [];} });
  const [earnings,  setEarnings]  = useState(()=>{ try{return JSON.parse(localStorage.getItem("spendwise_earnings")||"[]");}catch{return [];} });
  const [budgets,   setBudgets]   = useState(()=>{ try{return JSON.parse(localStorage.getItem("spendwise_budgets") ||"{}"); }catch{return {};} });
  const [favourites,setFavourites]= useState(()=>{ try{return JSON.parse(localStorage.getItem("spendwise_favs")   ||"[]"); }catch{return [];} });
  const [savingsGoal,setSavingsGoal]=useState(()=>{ try{return JSON.parse(localStorage.getItem("spendwise_goal")  ||'{"target":0,"saved":0}');}catch{return {target:0,saved:0};} });

  useEffect(()=>localStorage.setItem("spendwise_expenses",JSON.stringify(expenses)),  [expenses]);
  useEffect(()=>localStorage.setItem("spendwise_earnings",JSON.stringify(earnings)),  [earnings]);
  useEffect(()=>localStorage.setItem("spendwise_budgets", JSON.stringify(budgets)),   [budgets]);
  useEffect(()=>localStorage.setItem("spendwise_favs",    JSON.stringify(favourites)),[favourites]);
  useEffect(()=>localStorage.setItem("spendwise_goal",    JSON.stringify(savingsGoal)),[savingsGoal]);

  // Sync savings goal with actual saved amount
  useEffect(()=>{
    const now=new Date();
    const mk=`${now.getFullYear()}-${now.getMonth()}`;
    const earn=sumAmt(earnings.filter(e=>e.user===activeUser&&getMonthKey(e.date)===mk));
    const spent=sumAmt(expenses.filter(e=>e.user===activeUser&&getMonthKey(e.date)===mk));
    setSavingsGoal(g=>({...g,saved:Math.max(0,earn-spent)}));
  },[expenses,earnings,activeUser]);

  // Streak: consecutive months where saved > 0
  const streak = (() => {
    let s=0;
    const now=new Date();
    for (let i=0;i<12;i++) {
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      const mk=`${d.getFullYear()}-${d.getMonth()}`;
      const earn=sumAmt(earnings.filter(e=>e.user===activeUser&&getMonthKey(e.date)===mk));
      const spent=sumAmt(expenses.filter(e=>e.user===activeUser&&getMonthKey(e.date)===mk));
      if (earn>0&&earn>spent) s++; else break;
    }
    return s;
  })();

  // CRUD
  const addExpense   = d  => setExpenses(p=>[...p,{id:genId(),user:activeUser,source:"manual",...d}]);
  const deleteExpense= id => setExpenses(p=>p.filter(e=>e.id!==id));
  const editExpense  = (id,d) => setExpenses(p=>p.map(e=>e.id===id?{...e,...d}:e));
  const addEarning   = d  => setEarnings(p=>[...p,{id:genId(),user:activeUser,...d}]);
  const deleteEarning= id => setEarnings(p=>p.filter(e=>e.id!==id));
  const editEarning  = (id,d) => setEarnings(p=>p.map(e=>e.id===id?{...e,...d}:e));
  const importBank   = rows => setExpenses(p=>[...p,...rows.map(r=>({id:genId(),user:activeUser,source:"bank",...r}))]);
  const toggleFav    = fav => {
    setFavourites(f=>{
      const exists=f.findIndex(x=>x.description===fav.description&&x.amount===fav.amount);
      return exists>=0 ? f.filter((_,i)=>i!==exists) : [...f,fav];
    });
  };

  // Auto-add recurring expenses on month change
  useEffect(()=>{
    const now=new Date();
    const mk=`${now.getFullYear()}-${now.getMonth()}`;
    const alreadyAdded=expenses.some(e=>e.recurring&&e.user===activeUser&&getMonthKey(e.date)===mk);
    if (!alreadyAdded) {
      const prevMk=`${new Date(now.getFullYear(),now.getMonth()-1,1).getFullYear()}-${new Date(now.getFullYear(),now.getMonth()-1,1).getMonth()}`;
      const recurringExp=expenses.filter(e=>e.recurring&&e.user===activeUser&&getMonthKey(e.date)===prevMk);
      if (recurringExp.length>0) {
        setExpenses(p=>[...p,...recurringExp.map(e=>({...e,id:genId(),date:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`,source:"recurring"}))]);
      }
    }
  },[activeUser]);

  const tabs = [
    {id:"home",   icon:"📊",label:"Home"},
    {id:"expense",icon:"➖",label:"Spend"},
    {id:"earning",icon:"➕",label:"Earn"},
    {id:"stats",  icon:"📈",label:"Stats"},
    {id:"bank",   icon:"🏦",label:"Bank"},
  ];

  return (
    <div style={{ background:"#0a0a16", minHeight:"100vh", color:"#e8e8f0", fontFamily:"'DM Sans','Segoe UI',sans-serif", maxWidth:480, margin:"0 auto" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box} button{font-family:inherit} select{font-family:inherit}`}</style>

      {/* Header */}
      <div style={{ padding:"14px 20px 10px", borderBottom:"1px solid #1e1e3a", background:"rgba(10,10,22,0.96)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:17, fontWeight:700 }}>💸 Spendwise</div>
          <div style={{ display:"flex", gap:6 }}>
            {USERS.map(u=>(
              <button key={u} onClick={()=>setActiveUser(u)}
                style={{ padding:"5px 12px", borderRadius:20, border:activeUser===u?"1px solid #7c6fff":"1px solid #2a2a4a", background:activeUser===u?"#7c6fff22":"transparent", color:activeUser===u?"#a99fff":"#666", fontSize:12, cursor:"pointer", fontWeight:activeUser===u?600:400 }}>
                {u==="Anirudh"?"👤":"👩"} {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding:"18px 18px 100px" }}>
        {view==="home"    && <HomeTab user={activeUser} expenses={expenses} earnings={earnings} budgets={budgets} setBudgets={setBudgets} savingsGoal={savingsGoal} setSavingsGoal={setSavingsGoal} streak={streak} />}
        {view==="expense" && <AddExpenseTab user={activeUser} expenses={expenses} onAdd={addExpense} onDelete={deleteExpense} onEdit={editExpense} favourites={favourites} onToggleFav={toggleFav} />}
        {view==="earning" && <AddEarningTab user={activeUser} earnings={earnings} onAdd={addEarning} onDelete={deleteEarning} onEdit={editEarning} />}
        {view==="stats"   && <StatsTab user={activeUser} expenses={expenses} earnings={earnings} />}
        {view==="bank"    && <BankTab onImport={importBank} />}
      </div>

      {/* Bottom nav */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, background:"rgba(10,10,22,0.97)", backdropFilter:"blur(16px)", borderTop:"1px solid #1e1e3a", padding:"10px 12px 28px", display:"flex", gap:4 }}>
        {tabs.map(t=>{ const active=view===t.id; return (
          <button key={t.id} onClick={()=>setView(t.id)}
            style={{ flex:1, padding:"8px 2px", borderRadius:12, border:"none", background:active?"#7c6fff":"transparent", color:active?"#fff":"#555", fontSize:10, fontWeight:active?700:400, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <span style={{ fontSize:17 }}>{t.icon}</span>{t.label}
          </button>
        ); })}
      </div>
    </div>
  );
}
