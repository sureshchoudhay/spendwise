import { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { id:"food",          label:"Food & Dining",    icon:"🍜", color:"#FF6B6B" },
  { id:"transport",     label:"Transport",         icon:"🚇", color:"#0EA5E9" },
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
const EMOJI_OPTIONS = ["🍜","🚇","🛍️","🎬","💊","⚡","✈️","🛒","📚","📦","🍕","☕","🍺","🎮","🐾","👶","💇","🏋️","🎵","🎁","🏠","🚗","💻","📱","🌿","🧘","🎨","🏖️","🍷","🧴","💐","🎓","🛁","🔧","🧹","🌟"];
const COLOR_OPTIONS  = ["#FF6B6B","#FF4757","#FF6B35","#F59E0B","#22C55E","#4ECDC4","#45B7D1","#0EA5E9","#6366F1","#A855F7","#EC4899","#96CEB4","#DDA0DD","#98D8C8","#F7DC6F","#82E0AA","#AEB6BF","#F4A261","#E76F51","#2A9D8F"];
const USERS  = ["Suresh", "Bella"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genId       = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const getMonthKey = d  => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}`; };
const getCatInfo  = (id, cats) => (cats||DEFAULT_CATEGORIES).find(c=>c.id===id) ?? (cats||DEFAULT_CATEGORIES).at(-1);
const MonthLabel  = k  => { const [y,m] = k.split("-").map(Number); return `${MONTHS[m]} ${y}`; };
const sumAmt      = arr => arr.reduce((s,e)=>s+e.amount,0);
const today       = () => new Date().toISOString().split("T")[0];

// ─── PDF helpers ─────────────────────────────────────────────────────────────
async function extractTextFromPDF(buf) {
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let out = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const pg = await pdf.getPage(i);
    const ct = await pg.getTextContent();
    const items = ct.items.slice().sort((a,b)=>{
      const dy = Math.round(b.transform[5])-Math.round(a.transform[5]);
      return dy!==0?dy:a.transform[4]-b.transform[4];
    });
    let row=[],lastY=null; const rows=[];
    for (const it of items) {
      const y=Math.round(it.transform[5]);
      if (lastY===null||Math.abs(y-lastY)<4) row.push(it.str);
      else { if(row.length) rows.push(row.join("  ")); row=[it.str]; }
      lastY=y;
    }
    if (row.length) rows.push(row.join("  "));
    out+=rows.join("\n")+"\n\n";
  }
  return { text:out.trim(), pages:pdf.numPages };
}
async function categorizeStatement(text) {
  const res = await fetch("/api/categorize",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})});
  const data = await res.json();
  if (!res.ok) throw new Error(data.error||`Server error ${res.status}`);
  return data.transactions;
}

// ─── Shared style atoms ───────────────────────────────────────────────────────
const SI = { width:"100%", background:"#F0EFE8", border:"1px solid #E0DDD4", borderRadius:10, padding:"11px 14px", color:"#1A1A1A", fontSize:14, outline:"none", boxSizing:"border-box" };
const SL = { fontSize:12, color:"#9CA3AF", marginBottom:6, display:"block" };
const SC = { background:"#FFFFFF", borderRadius:16, padding:16, border:"1px solid #E8E6DE", marginBottom:12 };

function Tag({ children, color }) {
  return <span style={{ fontSize:10, padding:"1px 7px", borderRadius:20, background:`${color}18`, color, border:`1px solid ${color}33` }}>{children}</span>;
}
function BarRow({ label, value, max, color, icon }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:5, color:"#4B5563" }}>
        <span>{icon} {label}</span><span style={{ color, fontWeight:600 }}>${value.toFixed(2)}</span>
      </div>
      <div style={{ background:"#F0EFE8", borderRadius:6, height:6, overflow:"hidden" }}>
        <div style={{ width:`${max>0?(value/max)*100:0}%`, background:color, height:"100%", borderRadius:6, transition:"width 0.6s ease" }} />
      </div>
    </div>
  );
}
function DonutChart({ data, size=130 }) {
  const total = data.reduce((s,d)=>s+d.value,0);
  if (!total) return <div style={{ width:size, height:size, borderRadius:"50%", background:"#F0EFE8", border:"2px solid #E8E6DE", margin:"0 auto" }} />;
  let offset=0; const r=50,cx=60,cy=60,sw=18,circ=2*Math.PI*r;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {data.map((d,i)=>{ const dash=(d.value/total)*circ; const el=<circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={sw} strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={-offset*circ/100}/>; offset+=(d.value/total)*100; return el; })}
      <circle cx={cx} cy={cy} r={r-sw/2} fill="#FFFFFF"/>
    </svg>
  );
}

// ─── ExpRow ───────────────────────────────────────────────────────────────────
function ExpRow({ e, onDelete, onEdit, categories }) {
  const [open,setOpen] = useState(false);
  const cat = getCatInfo(e.category, categories);
  return (
    <div style={{ position:"relative", overflow:"hidden", borderRadius:10, marginBottom:2 }}>
      {open && (
        <div style={{ position:"absolute", right:0, top:0, bottom:0, display:"flex", alignItems:"center", gap:6, padding:"0 8px", background:"#FFFFFF", zIndex:1 }}>
          <button onClick={()=>{ onEdit(e); setOpen(false); }} style={{ background:"#F3F0FF", border:"1px solid #C4B5FD", color:"#7C3AED", borderRadius:8, padding:"6px 12px", fontSize:12, cursor:"pointer", fontWeight:600 }}>✏️ Edit</button>
          <button onClick={()=>{ onDelete(e.id); setOpen(false); }} style={{ background:"#FEF2F2", border:"1px solid #FECACA", color:"#EF4444", borderRadius:8, padding:"6px 12px", fontSize:12, cursor:"pointer", fontWeight:600 }}>🗑️ Del</button>
          <button onClick={()=>setOpen(false)} style={{ background:"none", border:"none", color:"#9CA3AF", fontSize:16, cursor:"pointer" }}>✕</button>
        </div>
      )}
      <div style={{ display:"flex", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #F5F4EF", gap:12, background:"#FFFFFF", position:"relative", zIndex:0 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:`${cat.color}18`, border:`1.5px solid ${cat.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{cat.icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"#1A1A1A" }}>{e.description}</div>
          <div style={{ display:"flex", gap:5, marginTop:3, flexWrap:"wrap" }}>
            <Tag color={cat.color}>{cat.label}</Tag>
            <Tag color={e.tag==="house"?"#96CEB4":"#45B7D1"}>{e.tag==="house"?"🏠":"👤"}</Tag>
            {e.recurring && <Tag color="#F59E0B">🔁</Tag>}
            {e.source==="bank" && <Tag color="#0EA5E9">Bank</Tag>}
          </div>
        </div>
        <div style={{ fontSize:14, fontWeight:700, color:"#FF4757", flexShrink:0 }}>-${e.amount.toFixed(2)}</div>
        <button onClick={()=>setOpen(o=>!o)} style={{ background:"none", border:"none", color:"#D1D5DB", cursor:"pointer", fontSize:18, padding:"0 4px", flexShrink:0 }}>⋯</button>
      </div>
    </div>
  );
}

// ─── BudgetCard ───────────────────────────────────────────────────────────────
function BudgetCard({ tag, icon, color, spent, budget, onSetBudget, lastMonthAmt, dayOfMonth }) {
  const [editing,setEditing] = useState(false);
  const [inputVal,setInputVal] = useState(String(budget));
  const pct = Math.min((spent/budget)*100,100);
  const remaining = budget-spent;
  const bColor = pct>=90?"#EF4444":pct>=70?"#F59E0B":color;
  const vs = spent-lastMonthAmt;
  const vsPct = lastMonthAmt>0?(vs/lastMonthAmt)*100:0;
  const prev = new Date(); prev.setMonth(prev.getMonth()-1);
  const now = new Date();
  const daysLeft = new Date(now.getFullYear(),now.getMonth()+1,0).getDate()-now.getDate();
  const dailyLeft = remaining>0&&daysLeft>0?remaining/daysLeft:0;
  return (
    <div style={{ ...SC, borderColor:`${color}33` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`${color}18`, border:`1.5px solid ${color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{icon}</div>
          <div>
            <div style={{ fontSize:14, fontWeight:700 }}>{tag==="personal"?"Personal":"House"}</div>
            <div style={{ fontSize:10, color:"#9CA3AF" }}>Monthly budget</div>
          </div>
        </div>
        {editing?(
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <input value={inputVal} onChange={e=>setInputVal(e.target.value)} type="number" autoFocus
              style={{ width:80, background:"#F0EFE8", border:`1px solid ${color}66`, borderRadius:8, padding:"5px 8px", color:"#1A1A1A", fontSize:13, outline:"none", textAlign:"right" }}/>
            <button onClick={()=>{ onSetBudget(parseFloat(inputVal)||budget); setEditing(false); }}
              style={{ padding:"5px 10px", borderRadius:8, border:"none", background:color, color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer" }}>✓</button>
            <button onClick={()=>setEditing(false)} style={{ padding:"5px 8px", borderRadius:8, border:"1px solid #E0DDD4", background:"none", color:"#9CA3AF", fontSize:12, cursor:"pointer" }}>✕</button>
          </div>
        ):(
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:20, fontWeight:700, color:bColor }}>{pct.toFixed(0)}%</div>
            <button onClick={()=>{ setInputVal(String(budget)); setEditing(true); }} style={{ background:"none", border:"none", color:"#9CA3AF", fontSize:10, cursor:"pointer", padding:0 }}>${budget.toLocaleString()} ✏️</button>
          </div>
        )}
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:10 }}>
        {[["Spent","#FF4757","#FEF2F2","#FECACA",`$${spent.toFixed(0)}`],
          [remaining>=0?"Left":"Over",bColor,`${bColor}11`,`${bColor}33`,`$${Math.abs(remaining).toFixed(0)}`],
          [vs>0?"▲ Last":"▼ Last",vs>0?"#FF4757":"#22C55E",vs>0?"#FEF2F2":"#F0FDF4",vs>0?"#FECACA":"#BBF7D0",`${vs>0?"+":"-"}$${Math.abs(vs).toFixed(0)}`],
        ].map(([lb,col,bg,bd,val])=>(
          <div key={lb} style={{ flex:1, background:bg, borderRadius:10, padding:"8px 4px", border:`1px solid ${bd}`, textAlign:"center" }}>
            <div style={{ fontSize:9, color:col, textTransform:"uppercase", letterSpacing:0.4, marginBottom:3 }}>{lb}</div>
            <div style={{ fontSize:14, fontWeight:700, color:col }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ background:"#F0EFE8", borderRadius:8, height:7, overflow:"hidden", marginBottom:6 }}>
        <div style={{ width:`${pct}%`, background:`linear-gradient(90deg,${bColor}88,${bColor})`, height:"100%", borderRadius:8, transition:"width 0.8s ease" }}/>
      </div>
      {remaining>0&&<div style={{ fontSize:10, color:"#9CA3AF" }}>💡 ${dailyLeft.toFixed(0)}/day left · {vs>0?"📈":"📉"} {Math.abs(vsPct).toFixed(0)}% vs {MONTHS[prev.getMonth()]} 1–{dayOfMonth}</div>}
    </div>
  );
}

// ─── Category Manager Modal ───────────────────────────────────────────────────
function CategoryManagerModal({ categories, onSave, onClose }) {
  const [cats,setCats]           = useState(categories);
  const [editingCat,setEditingCat] = useState(false);
  const [newLabel,setNewLabel]   = useState("");
  const [newEmoji,setNewEmoji]   = useState("🌟");
  const [newColor,setNewColor]   = useState("#FF6B6B");
  const [showEmoji,setShowEmoji] = useState(false);
  const [showColor,setShowColor] = useState(false);

  function addCustom() {
    if (!newLabel.trim()) return;
    setCats(p=>[...p,{ id:"custom_"+genId(), label:newLabel.trim(), icon:newEmoji, color:newColor, custom:true }]);
    setNewLabel(""); setNewEmoji("🌟"); setNewColor("#FF6B6B");
    setEditingCat(false); setShowEmoji(false); setShowColor(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#FAFAF7", borderRadius:"20px 20px 0 0", padding:"20px 18px 40px", width:"100%", maxWidth:480, maxHeight:"88vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:700 }}>Manage Categories</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#9CA3AF", fontSize:22, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ background:"#FFFFFF", borderRadius:14, border:"1px solid #E8E6DE", marginBottom:14, overflow:"hidden" }}>
          {cats.map((c,i)=>(
            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", borderBottom:i<cats.length-1?"1px solid #F0EFE8":"none" }}>
              <div style={{ width:34, height:34, borderRadius:10, background:`${c.color}18`, border:`1.5px solid ${c.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{c.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{c.label}</div>
                {c.custom&&<div style={{ fontSize:10, color:"#9CA3AF" }}>Custom</div>}
              </div>
              <div style={{ width:14, height:14, borderRadius:"50%", background:c.color, flexShrink:0 }}/>
              <button onClick={()=>setCats(p=>p.filter(x=>x.id!==c.id))}
                style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:8, color:"#EF4444", width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, cursor:"pointer", flexShrink:0 }}>✕</button>
            </div>
          ))}
        </div>
        {editingCat==="new"?(
          <div style={{ background:"#FFFFFF", borderRadius:14, border:"1px solid #E8E6DE", padding:14, marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"#6B7280", marginBottom:12 }}>New Category</div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:`${newColor}18`, border:`2px solid ${newColor}66`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{newEmoji}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600, color:newLabel?"#1A1A1A":"#9CA3AF" }}>{newLabel||"Category name"}</div>
                <div style={{ fontSize:10, color:newColor, marginTop:2 }}>Custom</div>
              </div>
            </div>
            <input value={newLabel} onChange={e=>setNewLabel(e.target.value)} placeholder="e.g. Pet Care, Date Night..."
              style={{ width:"100%", border:"1px solid #E0DDD4", borderRadius:10, padding:"10px 12px", fontSize:14, color:"#1A1A1A", background:"#FAFAF7", outline:"none", boxSizing:"border-box", marginBottom:10 }}/>
            <button onClick={()=>{ setShowEmoji(e=>!e); setShowColor(false); }}
              style={{ width:"100%", padding:"9px", borderRadius:10, border:"1px solid #E0DDD4", background:"#FAFAF7", fontSize:13, cursor:"pointer", marginBottom:8, textAlign:"left", color:"#1A1A1A" }}>
              {showEmoji?"▲":"▼"} Icon: {newEmoji}
            </button>
            {showEmoji&&(
              <div style={{ display:"grid", gridTemplateColumns:"repeat(9,1fr)", gap:6, marginBottom:10, padding:10, background:"#F5F4EF", borderRadius:10 }}>
                {EMOJI_OPTIONS.map(em=>(
                  <button key={em} onClick={()=>{ setNewEmoji(em); setShowEmoji(false); }}
                    style={{ padding:"6px", borderRadius:8, border:newEmoji===em?"2px solid #FF4757":"2px solid transparent", background:newEmoji===em?"#FF475711":"transparent", fontSize:18, cursor:"pointer" }}>{em}</button>
                ))}
              </div>
            )}
            <button onClick={()=>{ setShowColor(c=>!c); setShowEmoji(false); }}
              style={{ width:"100%", padding:"9px", borderRadius:10, border:"1px solid #E0DDD4", background:"#FAFAF7", fontSize:13, cursor:"pointer", marginBottom:8, textAlign:"left", color:"#1A1A1A", display:"flex", alignItems:"center", gap:8 }}>
              {showColor?"▲":"▼"} Color: <span style={{ display:"inline-block", width:14, height:14, borderRadius:"50%", background:newColor }}/>
            </button>
            {showColor&&(
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:10, padding:10, background:"#F5F4EF", borderRadius:10 }}>
                {COLOR_OPTIONS.map(col=>(
                  <button key={col} onClick={()=>{ setNewColor(col); setShowColor(false); }}
                    style={{ width:28, height:28, borderRadius:"50%", background:col, border:newColor===col?"3px solid #1A1A1A":"2px solid transparent", cursor:"pointer", flexShrink:0 }}/>
                ))}
              </div>
            )}
            <div style={{ display:"flex", gap:8, marginTop:4 }}>
              <button onClick={()=>{ setEditingCat(false); setShowEmoji(false); setShowColor(false); }}
                style={{ flex:1, padding:"10px", borderRadius:10, border:"1px solid #E0DDD4", background:"transparent", color:"#6B7280", fontSize:13, cursor:"pointer" }}>Cancel</button>
              <button onClick={addCustom} disabled={!newLabel.trim()}
                style={{ flex:2, padding:"10px", borderRadius:10, border:"none", background:newLabel.trim()?"linear-gradient(135deg,#FF6B35,#FF4757)":"#E8E6DE", color:newLabel.trim()?"#fff":"#9CA3AF", fontSize:13, fontWeight:700, cursor:newLabel.trim()?"pointer":"default" }}>＋ Add Category</button>
            </div>
          </div>
        ):(
          <button onClick={()=>setEditingCat("new")}
            style={{ width:"100%", padding:"12px", borderRadius:12, border:"2px dashed #FF475766", background:"#FF475708", color:"#FF4757", fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:14 }}>＋ Add Custom Category</button>
        )}
        <button onClick={()=>onSave(cats)}
          style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:"linear-gradient(135deg,#FF6B35,#FF4757)", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer" }}>Save Changes</button>
      </div>
    </div>
  );
}

// ─── Edit Modals ──────────────────────────────────────────────────────────────
function EditExpenseModal({ expense, onSave, onClose, categories }) {
  const [tag,setTag]           = useState(expense.tag||"personal");
  const [category,setCategory] = useState(expense.category);
  const [amount,setAmount]     = useState(String(expense.amount));
  const [desc,setDesc]         = useState(expense.description);
  const [date,setDate]         = useState(expense.date);
  const CATS = categories||DEFAULT_CATEGORIES;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:100, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#FAFAF7", borderRadius:"20px 20px 0 0", padding:"24px 20px 40px", width:"100%", maxWidth:480, maxHeight:"90vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:17, fontWeight:700 }}>Edit Expense</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#9CA3AF", fontSize:22, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ marginBottom:16 }}>
          <span style={SL}>Tag</span>
          <div style={{ display:"flex", gap:10 }}>
            {[["personal","👤","Personal","#45B7D1"],["house","🏠","House","#96CEB4"]].map(([v,ic,lb,col])=>(
              <button key={v} onClick={()=>setTag(v)} style={{ flex:1, padding:"10px", borderRadius:12, border:tag===v?`2px solid ${col}`:"2px solid #E8E6DE", background:tag===v?`${col}18`:"#F0EFE8", cursor:"pointer", color:tag===v?col:"#9CA3AF", fontWeight:tag===v?700:400 }}>{ic} {lb}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:16 }}>
          <span style={SL}>Category</span>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6 }}>
            {CATS.map(c=>(
              <div key={c.id} onClick={()=>setCategory(c.id)} style={{ padding:"8px 4px", borderRadius:10, border:category===c.id?`2px solid ${c.color}`:"2px solid #E8E6DE", background:category===c.id?`${c.color}18`:"#F0EFE8", cursor:"pointer", textAlign:"center" }}>
                <div style={{ fontSize:18 }}>{c.icon}</div>
                <div style={{ fontSize:8, color:category===c.id?c.color:"#9CA3AF", marginTop:1 }}>{c.label.split(" ")[0]}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:12 }}><label style={SL}>Amount ($)</label><input style={SI} type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
        <div style={{ marginBottom:12 }}><label style={SL}>Description</label><input style={SI} type="text" value={desc} onChange={e=>setDesc(e.target.value)}/></div>
        <div style={{ marginBottom:20 }}>
          <label style={SL}>Date</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}
            style={{ width:"100%", background:"#F0EFE8", border:"1px solid #E0DDD4", borderRadius:10, padding:"11px 14px", color:"#1A1A1A", fontSize:14, outline:"none", boxSizing:"border-box", WebkitAppearance:"none", appearance:"none" }}/>
        </div>
        <button onClick={()=>onSave({ tag, category, amount:parseFloat(amount)||0, description:desc, date })}
          style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:"linear-gradient(135deg,#FF6B35,#FF4757)", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer" }}>Save Changes</button>
      </div>
    </div>
  );
}

function EditEarningModal({ earning, onSave, onClose }) {
  const [type,setType]     = useState(earning.type);
  const [amount,setAmount] = useState(String(earning.amount));
  const [desc,setDesc]     = useState(earning.description);
  const [date,setDate]     = useState(earning.date);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:100, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#FAFAF7", borderRadius:"20px 20px 0 0", padding:"24px 20px 40px", width:"100%", maxWidth:480 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:17, fontWeight:700 }}>Edit Earning</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#9CA3AF", fontSize:22, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ marginBottom:16 }}>
          <span style={SL}>Type</span>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
            {EARNING_TYPES.map(t=>(
              <div key={t.id} onClick={()=>setType(t.id)} style={{ padding:"10px 4px", borderRadius:12, border:type===t.id?"2px solid #22C55E":"2px solid #E8E6DE", background:type===t.id?"#22C55E18":"#F0EFE8", cursor:"pointer", textAlign:"center" }}>
                <div style={{ fontSize:20 }}>{t.icon}</div>
                <div style={{ fontSize:9, color:type===t.id?"#22C55E":"#9CA3AF", marginTop:2 }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:12 }}><label style={SL}>Amount ($)</label><input style={SI} type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
        <div style={{ marginBottom:12 }}><label style={SL}>Description</label><input style={SI} type="text" value={desc} onChange={e=>setDesc(e.target.value)}/></div>
        <div style={{ marginBottom:20 }}>
          <label style={SL}>Date</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}
            style={{ width:"100%", background:"#F0EFE8", border:"1px solid #E0DDD4", borderRadius:10, padding:"11px 14px", color:"#1A1A1A", fontSize:14, outline:"none", boxSizing:"border-box", WebkitAppearance:"none", appearance:"none" }}/>
        </div>
        <button onClick={()=>onSave({ type, amount:parseFloat(amount)||0, description:desc, date })}
          style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:"linear-gradient(135deg,#22C55E,#16A34A)", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer" }}>Save Changes</button>
      </div>
    </div>
  );
}

// ─── HOME TAB ─────────────────────────────────────────────────────────────────
function HomeTab({ user, expenses, earnings, budgets, setBudgets, savingsGoal, setSavingsGoal, streak, categories }) {
  const now          = new Date();
  const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const dayOfMonth   = now.getDate();
  const prevDate     = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${prevDate.getMonth()}`;

  const userExp       = expenses.filter(e=>e.user===user);
  const userEarn      = earnings.filter(e=>e.user===user);
  const thisMonthExp  = userExp.filter(e=>getMonthKey(e.date)===thisMonthKey);
  const prevMonthExp  = userExp.filter(e=>getMonthKey(e.date)===prevMonthKey&&new Date(e.date).getDate()<=dayOfMonth);
  const thisMonthEarn = userEarn.filter(e=>getMonthKey(e.date)===thisMonthKey);

  const totalEarned   = sumAmt(thisMonthEarn);
  const personalSpent = sumAmt(thisMonthExp.filter(e=>e.tag==="personal"));
  const houseSpent    = sumAmt(thisMonthExp.filter(e=>e.tag==="house"));
  const totalSpent    = personalSpent+houseSpent;
  const saved         = totalEarned-totalSpent;
  const savingsPct    = totalEarned>0?(saved/totalEarned)*100:0;
  const prevPersonal  = sumAmt(prevMonthExp.filter(e=>e.tag==="personal"));
  const prevHouse     = sumAmt(prevMonthExp.filter(e=>e.tag==="house"));
  const userBudgets   = budgets[user]||{ personal:1500, house:1500 };
  const recent        = [...thisMonthExp].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);

  const personalPct = (personalSpent/userBudgets.personal)*100;
  const housePct    = (houseSpent/userBudgets.house)*100;
  const alerts = [];
  if (personalPct>=80&&personalPct<100) alerts.push(`⚠️ Personal budget ${personalPct.toFixed(0)}% used`);
  if (personalPct>=100) alerts.push(`🚨 Personal budget exceeded!`);
  if (housePct>=80&&housePct<100) alerts.push(`⚠️ House budget ${housePct.toFixed(0)}% used`);
  if (housePct>=100) alerts.push(`🚨 House budget exceeded!`);

  const [editGoal,setEditGoal]   = useState(false);
  const [goalInput,setGoalInput] = useState(String(savingsGoal.target||0));
  const goalProgress = savingsGoal.target>0?Math.min((savingsGoal.saved/savingsGoal.target)*100,100):0;

  function setBudgetFor(tag,val) { setBudgets(b=>({...b,[user]:{...userBudgets,[tag]:val}})); }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700 }}>Hey {user} 👋</div>
          <div style={{ fontSize:12, color:"#9CA3AF" }}>{MONTHS[now.getMonth()]} {now.getFullYear()}</div>
        </div>
        {streak>0&&(
          <div style={{ background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:12, padding:"6px 12px", textAlign:"center" }}>
            <div style={{ fontSize:18 }}>🔥</div>
            <div style={{ fontSize:10, color:"#EA580C", fontWeight:700 }}>{streak}mo</div>
          </div>
        )}
      </div>

      {alerts.map((a,i)=>(
        <div key={i} style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:12, padding:"10px 14px", marginBottom:8, fontSize:12, color:"#DC2626" }}>{a}</div>
      ))}

      {/* Earned/Spent/Saved */}
      <div style={{ background:"linear-gradient(135deg,#F0FDF4,#FFFFFF)", borderRadius:16, padding:16, border:"1px solid #BBF7D0", marginBottom:12 }}>
        <div style={{ fontSize:11, color:"#16A34A", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:12 }}>💰 This Month</div>
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          {[["Earned","#22C55E","#F0FDF4","#BBF7D0",totalEarned===0?"$0":`$${totalEarned.toLocaleString()}`],
            ["Spent","#FF4757","#FEF2F2","#FECACA",`$${totalSpent.toFixed(0)}`],
            ["Saved",saved>=0?"#6366F1":"#FF4757",saved>=0?"#EEF2FF":"#FEF2F2",saved>=0?"#C7D2FE":"#FECACA",`$${Math.abs(saved).toFixed(0)}`],
          ].map(([lb,col,bg,bd,val])=>(
            <div key={lb} style={{ flex:1, textAlign:"center", padding:"10px 4px", background:bg, borderRadius:12, border:`1px solid ${bd}` }}>
              <div style={{ fontSize:9, color:`${col}aa`, textTransform:"uppercase", letterSpacing:0.5, marginBottom:4 }}>{lb}</div>
              <div style={{ fontSize:17, fontWeight:700, color:col }}>{val}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#9CA3AF", marginBottom:4 }}>
          <span>Savings rate</span>
          <span style={{ color:savingsPct>=20?"#22C55E":"#F59E0B", fontWeight:600 }}>{totalEarned>0?`${savingsPct.toFixed(0)}%`:"Add earnings ↑"}</span>
        </div>
        <div style={{ background:"#E8E6DE", borderRadius:6, height:6, overflow:"hidden" }}>
          <div style={{ width:`${Math.max(0,Math.min(savingsPct,100))}%`, background:"linear-gradient(90deg,#22C55E88,#22C55E)", height:"100%", borderRadius:6 }}/>
        </div>
      </div>

      {/* Savings goal */}
      {(savingsGoal.target>0||editGoal)&&(
        <div style={{ ...SC, borderColor:"#FDE68A" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:600 }}>🎯 Savings Goal</div>
            <button onClick={()=>{ setGoalInput(String(savingsGoal.target||0)); setEditGoal(true); }} style={{ background:"none", border:"none", color:"#9CA3AF", fontSize:11, cursor:"pointer" }}>✏️ edit</button>
          </div>
          {editGoal&&(
            <div style={{ display:"flex", gap:8, marginBottom:10 }}>
              <input value={goalInput} onChange={e=>setGoalInput(e.target.value)} type="number" placeholder="Target $"
                style={{ ...SI, flex:1, padding:"8px 10px" }} autoFocus/>
              <button onClick={()=>{ setSavingsGoal(g=>({...g,target:parseFloat(goalInput)||0})); setEditGoal(false); }}
                style={{ padding:"8px 14px", borderRadius:10, border:"none", background:"#F59E0B", color:"#fff", fontWeight:700, cursor:"pointer" }}>Set</button>
            </div>
          )}
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#6B7280", marginBottom:6 }}>
            <span>Saved: <span style={{ color:"#22C55E", fontWeight:600 }}>${savingsGoal.saved.toFixed(0)}</span></span>
            <span>Target: <span style={{ color:"#F59E0B", fontWeight:600 }}>${savingsGoal.target.toLocaleString()}</span></span>
          </div>
          <div style={{ background:"#F0EFE8", borderRadius:8, height:10, overflow:"hidden", marginBottom:6 }}>
            <div style={{ width:`${goalProgress}%`, background:"linear-gradient(90deg,#FDE68A,#F59E0B)", height:"100%", borderRadius:8, transition:"width 0.8s ease" }}/>
          </div>
          <div style={{ fontSize:11, color:"#9CA3AF" }}>{goalProgress.toFixed(0)}% of goal · ${Math.max(0,savingsGoal.target-savingsGoal.saved).toFixed(0)} to go</div>
        </div>
      )}
      {savingsGoal.target===0&&!editGoal&&(
        <button onClick={()=>setEditGoal(true)} style={{ width:"100%", padding:"10px", borderRadius:12, border:"1px dashed #E0DDD4", background:"transparent", color:"#9CA3AF", fontSize:12, cursor:"pointer", marginBottom:12 }}>🎯 Set a savings goal</button>
      )}

      <BudgetCard tag="personal" icon="👤" color="#45B7D1" spent={personalSpent} budget={userBudgets.personal} onSetBudget={v=>setBudgetFor("personal",v)} lastMonthAmt={prevPersonal} dayOfMonth={dayOfMonth}/>
      <BudgetCard tag="house"    icon="🏠" color="#22C55E" spent={houseSpent}    budget={userBudgets.house}    onSetBudget={v=>setBudgetFor("house",v)}    lastMonthAmt={prevHouse}    dayOfMonth={dayOfMonth}/>

      <div style={SC}>
        <div style={{ fontSize:11, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:12 }}>Recent</div>
        {recent.length===0
          ? <div style={{ textAlign:"center", color:"#9CA3AF", padding:"16px 0", fontSize:13 }}>No expenses yet. Tap ➖ to add!</div>
          : recent.map(e=><ExpRow key={e.id} e={e} onDelete={()=>{}} onEdit={()=>{}} categories={categories}/>)
        }
      </div>
    </div>
  );
}

// ─── ADD EXPENSE TAB ──────────────────────────────────────────────────────────
function AddExpenseTab({ user, expenses, onAdd, onDelete, onEdit, favourites, onToggleFav, categories, onManageCategories }) {
  const now = new Date();
  const [tag,setTag]             = useState("personal");
  const [category,setCategory]   = useState("food");
  const [amount,setAmount]       = useState("");
  const [desc,setDesc]           = useState("");
  const [date,setDate]           = useState(today());
  const [recurring,setRecurring] = useState(false);
  const [editTarget,setEditTarget] = useState(null);
  const [search,setSearch]       = useState("");
  const [editingFavs,setEditingFavs] = useState(false);

  const userExp    = expenses.filter(e=>e.user===user);
  const recentAll  = [...userExp].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const filtered   = search.trim()
    ? recentAll.filter(e=>e.description.toLowerCase().includes(search.toLowerCase())||e.category.includes(search.toLowerCase()))
    : recentAll.slice(0,30);

  function handleAdd() {
    if (!amount) return;
    const cat = getCatInfo(category, categories);
    onAdd({ tag, category, amount:parseFloat(amount), description:desc.trim()||cat.label, date, recurring });
    setAmount(""); setDesc(""); setRecurring(false);
  }

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:700, marginBottom:16 }}>Add Expense</div>

      {/* Quick-add favourites */}
      {favourites.length>0&&(
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ fontSize:11, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1 }}>⭐ Quick Add</div>
            <button onClick={()=>setEditingFavs(e=>!e)} style={{ background:"none", border:"none", color:editingFavs?"#22C55E":"#9CA3AF", fontSize:11, cursor:"pointer", padding:0 }}>
              {editingFavs?"✓ Done":"✏️ Edit"}
            </button>
          </div>
          <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4 }}>
            {favourites.map((f,i)=>{
              const cat=getCatInfo(f.category,categories);
              return (
                <div key={i} style={{ position:"relative", flexShrink:0 }}>
                  <button onClick={()=>!editingFavs&&onAdd({tag:f.tag,category:f.category,amount:f.amount,description:f.description,date:today(),recurring:false})}
                    style={{ display:"block", background:`${cat.color}11`, border:`1px solid ${editingFavs?"#EF444466":`${cat.color}33`}`, borderRadius:12, padding:"8px 12px", cursor:editingFavs?"default":"pointer", textAlign:"center", minWidth:72, opacity:editingFavs?0.65:1 }}>
                    <div style={{ fontSize:20 }}>{cat.icon}</div>
                    <div style={{ fontSize:10, color:cat.color, marginTop:2, fontWeight:600 }}>${f.amount}</div>
                    <div style={{ fontSize:9, color:"#9CA3AF", marginTop:1 }}>{f.description.slice(0,9)}</div>
                  </button>
                  {editingFavs&&(
                    <button onClick={()=>onToggleFav(f)}
                      style={{ position:"absolute", top:-7, right:-7, width:22, height:22, borderRadius:"50%", background:"#EF4444", border:"2px solid #FAFAF7", color:"#fff", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, padding:0, lineHeight:1 }}>×</button>
                  )}
                </div>
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
            <button key={v} onClick={()=>setTag(v)} style={{ flex:1, padding:"12px", borderRadius:14, border:tag===v?`2px solid ${col}`:"2px solid #E8E6DE", background:tag===v?`${col}18`:"#FFFFFF", cursor:"pointer" }}>
              <div style={{ fontSize:22, marginBottom:3 }}>{ic}</div>
              <div style={{ fontSize:13, fontWeight:600, color:tag===v?col:"#9CA3AF" }}>{lb}</div>
              <div style={{ fontSize:10, color:"#6B7280" }}>{sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
          <span style={{ fontSize:12, color:"#9CA3AF" }}>Category</span>
          <button onClick={onManageCategories} style={{ background:"none", border:"none", color:"#FF4757", fontSize:11, cursor:"pointer", padding:0, fontWeight:600 }}>⚙️ Manage</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
          {categories.map(c=>(
            <div key={c.id} onClick={()=>setCategory(c.id)} style={{ padding:"9px 4px", borderRadius:12, border:category===c.id?`2px solid ${c.color}`:"2px solid #E8E6DE", background:category===c.id?`${c.color}18`:"#FFFFFF", cursor:"pointer", textAlign:"center" }}>
              <div style={{ fontSize:20 }}>{c.icon}</div>
              <div style={{ fontSize:9, color:category===c.id?c.color:"#9CA3AF", marginTop:2 }}>{c.label.split(" ")[0]}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom:12 }}><label style={SL}>Amount ($)</label><input style={SI} type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
      <div style={{ marginBottom:12 }}>
        <label style={SL}>Description (optional)</label>
        <input style={SI} type="text" placeholder={getCatInfo(category,categories).label} value={desc} onChange={e=>setDesc(e.target.value)}/>
      </div>
      <div style={{ marginBottom:12 }}>
        <label style={SL}>Date</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}
          style={{ width:"100%", background:"#F0EFE8", border:"1px solid #E0DDD4", borderRadius:10, padding:"11px 14px", color:"#1A1A1A", fontSize:14, outline:"none", boxSizing:"border-box", WebkitAppearance:"none", appearance:"none" }}/>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        <button onClick={()=>setRecurring(r=>!r)}
          style={{ flex:1, padding:"10px", borderRadius:12, border:recurring?"1px solid #F59E0B66":"1px solid #E0DDD4", background:recurring?"#FEF3C7":"transparent", color:recurring?"#D97706":"#9CA3AF", fontSize:12, cursor:"pointer" }}>
          🔁 {recurring?"Recurring":"Set Recurring"}
        </button>
        <button onClick={()=>{ if(amount) onToggleFav({tag,category,amount:parseFloat(amount),description:desc.trim()||getCatInfo(category,categories).label}); }}
          style={{ flex:1, padding:"10px", borderRadius:12, border:"1px solid #E0DDD4", background:"transparent", color:"#9CA3AF", fontSize:12, cursor:"pointer", opacity:amount?1:0.4 }}>
          ⭐ Save as Fav
        </button>
      </div>

      <button onClick={handleAdd} disabled={!amount}
        style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:"linear-gradient(135deg,#FF6B35,#FF4757)", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", opacity:amount?1:0.5, marginBottom:24 }}>
        Add Expense
      </button>

      <div style={{ fontSize:11, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>🔍 All Transactions</div>
      <input style={{ ...SI, marginBottom:10 }} placeholder="Search by name or category..." value={search} onChange={e=>setSearch(e.target.value)}/>
      <div style={SC}>
        {filtered.length===0
          ? <div style={{ textAlign:"center", color:"#9CA3AF", padding:"16px 0", fontSize:13 }}>No transactions found.</div>
          : filtered.map(e=><ExpRow key={e.id} e={e} onDelete={onDelete} onEdit={setEditTarget} categories={categories}/>)
        }
      </div>
      {editTarget&&<EditExpenseModal expense={editTarget} categories={categories} onSave={data=>{ onEdit(editTarget.id,data); setEditTarget(null); }} onClose={()=>setEditTarget(null)}/>}
    </div>
  );
}

// ─── EARN TAB ─────────────────────────────────────────────────────────────────
function AddEarningTab({ user, earnings, onAdd, onDelete, onEdit }) {
  const now          = new Date();
  const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const thisMonthEarn = earnings.filter(e=>e.user===user&&getMonthKey(e.date)===thisMonthKey);
  const totalEarned  = sumAmt(thisMonthEarn);
  const [type,setType]     = useState("salary");
  const [amount,setAmount] = useState("");
  const [desc,setDesc]     = useState("");
  const [date,setDate]     = useState(today());
  const [editTarget,setEditTarget] = useState(null);

  function handleAdd() {
    if (!amount) return;
    onAdd({ type, amount:parseFloat(amount), description:desc.trim()||EARNING_TYPES.find(t=>t.id===type)?.label||type, date });
    setAmount(""); setDesc("");
  }

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>Add Earning</div>
      <div style={{ fontSize:12, color:"#9CA3AF", marginBottom:16 }}>This month: <span style={{ color:"#22C55E", fontWeight:600 }}>${totalEarned.toLocaleString()}</span></div>

      {thisMonthEarn.length>0&&(
        <div style={{ ...SC, marginBottom:16 }}>
          <div style={{ fontSize:11, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:10 }}>This Month</div>
          {thisMonthEarn.map(e=>(
            <div key={e.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #F5F4EF" }}>
              <div>
                <div style={{ fontSize:13, fontWeight:500 }}>{e.description}</div>
                <div style={{ fontSize:11, color:"#9CA3AF", marginTop:2 }}>{e.date} · {e.type}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ fontSize:14, fontWeight:700, color:"#22C55E" }}>+${e.amount.toLocaleString()}</div>
                <button onClick={()=>setEditTarget(e)} style={{ background:"none", border:"none", color:"#9CA3AF", cursor:"pointer", fontSize:14 }}>✏️</button>
                <button onClick={()=>onDelete(e.id)} style={{ background:"none", border:"none", color:"#D1D5DB", cursor:"pointer", fontSize:14 }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom:16 }}>
        <span style={SL}>Type</span>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {EARNING_TYPES.map(t=>(
            <div key={t.id} onClick={()=>setType(t.id)} style={{ padding:"10px 4px", borderRadius:12, border:type===t.id?"2px solid #22C55E":"2px solid #E8E6DE", background:type===t.id?"#22C55E18":"#FFFFFF", cursor:"pointer", textAlign:"center" }}>
              <div style={{ fontSize:20 }}>{t.icon}</div>
              <div style={{ fontSize:9, color:type===t.id?"#22C55E":"#9CA3AF", marginTop:2 }}>{t.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom:12 }}><label style={SL}>Amount ($)</label><input style={SI} type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
      <div style={{ marginBottom:12 }}><label style={SL}>Description (optional)</label><input style={SI} type="text" placeholder={EARNING_TYPES.find(t=>t.id===type)?.label} value={desc} onChange={e=>setDesc(e.target.value)}/></div>
      <div style={{ marginBottom:20 }}>
        <label style={SL}>Date</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}
          style={{ width:"100%", background:"#F0EFE8", border:"1px solid #E0DDD4", borderRadius:10, padding:"11px 14px", color:"#1A1A1A", fontSize:14, outline:"none", boxSizing:"border-box", WebkitAppearance:"none", appearance:"none" }}/>
      </div>
      <button onClick={handleAdd} disabled={!amount}
        style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:"linear-gradient(135deg,#22C55E,#16A34A)", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", opacity:amount?1:0.5 }}>
        Add Earning
      </button>
      {editTarget&&<EditEarningModal earning={editTarget} onSave={data=>{ onEdit(editTarget.id,data); setEditTarget(null); }} onClose={()=>setEditTarget(null)}/>}
    </div>
  );
}

// ─── STATS TAB ────────────────────────────────────────────────────────────────
function StatsTab({ user, expenses, earnings, categories }) {
  const now          = new Date();
  const dayOfMonth   = now.getDate();
  const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const prevDate     = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${prevDate.getMonth()}`;

  const [tagFilter,setTagFilter]             = useState("all");
  const [analyticsPeriod,setAnalyticsPeriod] = useState(thisMonthKey);

  const userExp    = expenses.filter(e=>e.user===user);
  const userEarn   = earnings.filter(e=>e.user===user);
  const available  = [...new Set(userExp.map(e=>getMonthKey(e.date)))].sort().reverse();
  const periodExp  = userExp.filter(e=>getMonthKey(e.date)===analyticsPeriod);
  const filtered   = tagFilter==="all"?periodExp:periodExp.filter(e=>e.tag===tagFilter);
  const thisSpent  = sumAmt(filtered);
  const prevFiltered = userExp.filter(e=>{ const d=new Date(e.date); return getMonthKey(e.date)===prevMonthKey&&d.getDate()<=dayOfMonth&&(tagFilter==="all"||e.tag===tagFilter); });
  const prevSpent  = sumAmt(prevFiltered);
  const vs         = thisSpent-prevSpent;
  const vsPct      = prevSpent>0?(vs/prevSpent)*100:0;
  const byCat      = categories.map(c=>({...c,value:sumAmt(filtered.filter(e=>e.category===c.id))})).filter(c=>c.value>0).sort((a,b)=>b.value-a.value);

  // 6-month trend
  const trendMonths = Array.from({length:6},(_,i)=>{ const d=new Date(now.getFullYear(),now.getMonth()-5+i,1); return `${d.getFullYear()}-${d.getMonth()}`; });
  const trendData   = trendMonths.map(mk=>{
    const [,m] = mk.split("-").map(Number);
    const exp  = userExp.filter(e=>getMonthKey(e.date)===mk);
    return { label:MONTHS[m], personal:sumAmt(exp.filter(e=>e.tag==="personal")), house:sumAmt(exp.filter(e=>e.tag==="house")) };
  });
  const trendMax = Math.max(...trendData.map(d=>d.personal+d.house),1);

  // Report card
  const grade = (()=>{ if(thisSpent===0) return null; const earnAmt=sumAmt(userEarn.filter(e=>getMonthKey(e.date)===analyticsPeriod)); if(!earnAmt) return null; const pct=(thisSpent/earnAmt)*100; if(pct<50) return {g:"A",c:"#22C55E",t:"Excellent!"}; if(pct<70) return {g:"B",c:"#F59E0B",t:"Good job"}; if(pct<90) return {g:"C",c:"#F97316",t:"Watch out"}; return {g:"D",c:"#EF4444",t:"Over budget"}; })();

  function exportCSV() {
    const rows=[["Date","Description","Category","Tag","Amount","Recurring"],...filtered.map(e=>[e.date,e.description,e.category,e.tag||"",e.amount,e.recurring?"yes":"no"])];
    const blob=new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`spendwise-${analyticsPeriod}.csv`; a.click();
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ fontSize:18, fontWeight:700 }}>Analytics</div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button onClick={exportCSV} style={{ background:"#F3F0FF", border:"1px solid #C4B5FD", borderRadius:10, padding:"6px 12px", color:"#7C3AED", fontSize:11, cursor:"pointer" }}>📤 CSV</button>
          <select value={analyticsPeriod} onChange={e=>setAnalyticsPeriod(e.target.value)}
            style={{ background:"#F0EFE8", border:"1px solid #E0DDD4", borderRadius:10, padding:"6px 10px", color:"#1A1A1A", fontSize:12, outline:"none" }}>
            {available.length===0&&<option value={thisMonthKey}>{MonthLabel(thisMonthKey)}</option>}
            {available.map(m=><option key={m} value={m}>{MonthLabel(m)}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {[["all","All 📊","#6366F1"],["personal","Personal 👤","#45B7D1"],["house","House 🏠","#22C55E"]].map(([v,l,c])=>(
          <button key={v} onClick={()=>setTagFilter(v)} style={{ flex:1, padding:"9px 4px", borderRadius:10, border:tagFilter===v?`1.5px solid ${c}`:"1.5px solid #E0DDD4", background:tagFilter===v?`${c}18`:"#FFFFFF", color:tagFilter===v?c:"#9CA3AF", fontSize:11, fontWeight:tagFilter===v?700:400, cursor:"pointer" }}>{l}</button>
        ))}
      </div>

      {/* Report card */}
      {grade&&analyticsPeriod===thisMonthKey&&(
        <div style={{ ...SC, borderColor:`${grade.c}33`, display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:52, height:52, borderRadius:14, background:`${grade.c}18`, border:`2px solid ${grade.c}66`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, fontWeight:900, color:grade.c, flexShrink:0 }}>{grade.g}</div>
          <div>
            <div style={{ fontSize:14, fontWeight:700 }}>{grade.t}</div>
            <div style={{ fontSize:11, color:"#9CA3AF", marginTop:2 }}>Monthly spending grade</div>
            {byCat[0]&&<div style={{ fontSize:11, color:"#6B7280", marginTop:4 }}>Biggest: {byCat[0].icon} {byCat[0].label} ${byCat[0].value.toFixed(0)}</div>}
          </div>
        </div>
      )}

      {/* 6-month trend */}
      <div style={SC}>
        <div style={{ fontSize:11, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:14 }}>📊 6-Month Trend</div>
        <div style={{ display:"flex", gap:6, alignItems:"flex-end", height:80 }}>
          {trendData.map((d,i)=>{
            const total=d.personal+d.house;
            const h=trendMax>0?(total/trendMax)*72:0;
            const pH=total>0?(d.personal/total)*h:0;
            const hH=h-pH;
            return (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center" }}>
                <div style={{ width:"100%", display:"flex", flexDirection:"column" }}>
                  <div style={{ width:"100%", height:hH, background:"#22C55E66", borderRadius:"4px 4px 0 0", minHeight:hH>0?2:0 }}/>
                  <div style={{ width:"100%", height:pH, background:"#45B7D166", minHeight:pH>0?2:0 }}/>
                </div>
                <div style={{ fontSize:9, color:i===5?"#FF4757":"#9CA3AF", fontWeight:i===5?700:400, marginTop:4 }}>{d.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display:"flex", gap:12, marginTop:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:"#9CA3AF" }}><div style={{ width:10, height:10, background:"#45B7D166", borderRadius:2 }}/>Personal</div>
          <div style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:"#9CA3AF" }}><div style={{ width:10, height:10, background:"#22C55E66", borderRadius:2 }}/>House</div>
        </div>
      </div>

      {filtered.length===0?(
        <div style={{ textAlign:"center", color:"#9CA3AF", padding:"32px 0", fontSize:13 }}>No expenses for this selection.</div>
      ):(
        <>
          <div style={{ ...SC, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:11, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Total Spent</div>
              <div style={{ fontSize:30, fontWeight:700, color:"#FF4757" }}>${thisSpent.toFixed(2)}</div>
              <div style={{ fontSize:12, color:"#9CA3AF", marginTop:4 }}>{filtered.length} transactions</div>
            </div>
            <DonutChart data={byCat.map(c=>({color:c.color,value:c.value}))}/>
          </div>

          {analyticsPeriod===thisMonthKey&&prevSpent>0&&(
            <div style={SC}>
              <div style={{ fontSize:11, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:12 }}>
                {MONTHS[now.getMonth()]} 1–{dayOfMonth} vs {MONTHS[prevDate.getMonth()]} 1–{dayOfMonth}
              </div>
              <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                {[["This month","#6366F1","#EEF2FF","#C7D2FE",`$${thisSpent.toFixed(0)}`],
                  ["Last month","#0EA5E9","#EFF6FF","#BAE6FD",`$${prevSpent.toFixed(0)}`],
                ].map(([lb,col,bg,bd,val])=>(
                  <div key={lb} style={{ flex:1, background:bg, borderRadius:12, padding:"12px", border:`1px solid ${bd}` }}>
                    <div style={{ fontSize:10, color:col, marginBottom:4 }}>{lb}</div>
                    <div style={{ fontSize:20, fontWeight:700, color:col }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding:"10px 14px", background:vs>0?"#FEF2F2":"#F0FDF4", borderRadius:12, border:`1px solid ${vs>0?"#FECACA":"#BBF7D0"}`, display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:18 }}>{vs>0?"📈":"📉"}</span>
                <span style={{ fontSize:13, fontWeight:700, color:vs>0?"#EF4444":"#22C55E" }}>{vs>0?"+":"-"}${Math.abs(vs).toFixed(0)}</span>
                <span style={{ fontSize:11, color:"#6B7280" }}>{Math.abs(vsPct).toFixed(0)}% {vs>0?"more":"less"} than same period last month</span>
              </div>
            </div>
          )}

          <div style={SC}>
            <div style={{ fontSize:11, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:14 }}>By Category</div>
            {byCat.map(c=><BarRow key={c.id} label={c.label} value={c.value} max={byCat[0].value} color={c.color} icon={c.icon}/>)}
          </div>

          <div style={SC}>
            <div style={{ fontSize:11, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:10 }}>All Transactions</div>
            {[...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(e=><ExpRow key={e.id} e={e} onDelete={()=>{}} onEdit={()=>{}} categories={categories}/>)}
          </div>
        </>
      )}
    </div>
  );
}

// ─── BANK TAB ─────────────────────────────────────────────────────────────────
function BankTab({ onImport }) {
  const [bankText,setBankText]       = useState("");
  const [bankParsing,setBankParsing] = useState(false);
  const [pdfLoading,setPdfLoading]   = useState(false);
  const [pdfInfo,setPdfInfo]         = useState(null);
  const [bankResults,setBankResults] = useState([]);
  const [bankError,setBankError]     = useState("");
  const [bankImported,setBankImported] = useState(false);
  const [defaultTag,setDefaultTag]   = useState("personal");
  const fileRef = useRef();

  async function handleFile(e) {
    const file=e.target.files[0]; if(!file) return;
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
    try { const r=await categorizeStatement(bankText); if(!Array.isArray(r)||r.length===0) throw new Error("No transactions found."); setBankResults(r); }
    catch(err) { setBankError(err.message||"Failed to parse."); }
    setBankParsing(false);
  }

  const spin = { width:16, height:16, border:"2px solid currentColor", borderTopColor:"transparent", borderRadius:"50%", display:"inline-block", animation:"spin 0.7s linear infinite" };

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>Bank Import</div>
      <div style={{ fontSize:12, color:"#9CA3AF", marginBottom:14 }}>Upload a PDF, CSV, or TXT bank statement — AI categorizes everything.</div>
      <div style={SC}>
        <input ref={fileRef} type="file" accept=".pdf,.csv,.txt" style={{ display:"none" }} onChange={handleFile}/>
        <button onClick={()=>fileRef.current.click()} disabled={pdfLoading}
          style={{ width:"100%", padding:13, borderRadius:12, border:"2px dashed #C7D2FE", background:"#EEF2FF", color:"#6366F1", fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:10, opacity:pdfLoading?0.6:1 }}>
          {pdfLoading?"⏳ Reading PDF...":"📄 Upload Statement (PDF / CSV / TXT)"}
        </button>
        {pdfInfo&&!pdfLoading&&(
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:10, marginBottom:10 }}>
            <span style={{ fontSize:20 }}>📄</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:"#16A34A", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{pdfInfo.name}</div>
              <div style={{ fontSize:11, color:"#9CA3AF" }}>{pdfInfo.pages?`${pdfInfo.pages} pages · `:""}{bankText.length.toLocaleString()} chars ✓</div>
            </div>
            <button onClick={()=>{ setBankText(""); setPdfInfo(null); setBankResults([]); setBankError(""); }} style={{ background:"none", border:"none", color:"#9CA3AF", cursor:"pointer", fontSize:18 }}>✕</button>
          </div>
        )}
        {!pdfInfo&&!pdfLoading&&(
          <textarea value={bankText} onChange={e=>{ setBankText(e.target.value); setBankImported(false); setBankResults([]); setBankError(""); }}
            placeholder={"Paste statement text...\n2024-03-05  GRAB FOOD  $24.50"}
            style={{ width:"100%", background:"#F0EFE8", border:"1px solid #E0DDD4", borderRadius:10, padding:"12px 14px", color:"#1A1A1A", fontSize:13, outline:"none", resize:"vertical", minHeight:90, fontFamily:"monospace", boxSizing:"border-box", marginBottom:10 }}/>
        )}
        {bankError&&<div style={{ color:"#EF4444", fontSize:12, marginBottom:10, padding:"10px 12px", background:"#FEF2F2", borderRadius:8, border:"1px solid #FECACA" }}>⚠️ {bankError}</div>}
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:"#9CA3AF", marginBottom:6 }}>Tag imports as:</div>
          <div style={{ display:"flex", gap:8 }}>
            {[["personal","👤 Personal","#45B7D1"],["house","🏠 House","#22C55E"]].map(([v,l,c])=>(
              <button key={v} onClick={()=>setDefaultTag(v)} style={{ flex:1, padding:"8px", borderRadius:10, border:defaultTag===v?`1.5px solid ${c}`:"1.5px solid #E0DDD4", background:defaultTag===v?`${c}18`:"transparent", color:defaultTag===v?c:"#9CA3AF", fontSize:12, fontWeight:defaultTag===v?700:400, cursor:"pointer" }}>{l}</button>
            ))}
          </div>
        </div>
        <button onClick={handleParse} disabled={bankParsing||!bankText.trim()||pdfLoading}
          style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:"linear-gradient(135deg,#FF6B35,#FF4757)", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", opacity:(bankParsing||!bankText.trim()||pdfLoading)?0.45:1 }}>
          {bankParsing?<span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><span style={spin}/>Analyzing...</span>:"🤖 Categorize with AI"}
        </button>
      </div>
      {bankResults.length>0&&!bankImported&&(
        <div style={SC}>
          <div style={{ fontSize:12, color:"#9CA3AF", fontWeight:600, marginBottom:4 }}>FOUND {bankResults.length} TRANSACTIONS</div>
          <div style={{ fontSize:11, color:"#6B7280", marginBottom:12 }}>Total: <span style={{ color:"#FF4757", fontWeight:600 }}>${bankResults.reduce((s,r)=>s+parseFloat(r.amount||0),0).toFixed(2)}</span></div>
          {bankResults.map((r,i)=>{ const cat=getCatInfo(r.category,[]); return (
            <div key={i} style={{ display:"flex", alignItems:"center", padding:"9px 0", borderBottom:"1px solid #F5F4EF", gap:12 }}>
              <div style={{ width:34, height:34, borderRadius:9, background:`${cat.color}18`, border:`1.5px solid ${cat.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>{cat.icon}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.description}</div>
                <div style={{ fontSize:11, color:"#9CA3AF", marginTop:2 }}>{r.date} · <span style={{ color:cat.color }}>{cat.label}</span></div>
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:"#FF4757" }}>-${parseFloat(r.amount).toFixed(2)}</div>
            </div>
          ); })}
          <button onClick={()=>{ onImport(bankResults.map(r=>({...r,tag:defaultTag,amount:parseFloat(r.amount)||0}))); setBankImported(true); setBankText(""); setBankResults([]); setPdfInfo(null); }}
            style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:"linear-gradient(135deg,#22C55E,#16A34A)", color:"#fff", fontSize:15, fontWeight:700, cursor:"pointer", marginTop:14 }}>
            ✅ Import All {bankResults.length} Transactions
          </button>
        </div>
      )}
      {bankImported&&(
        <div style={{ ...SC, background:"#F0FDF4", borderColor:"#BBF7D0", textAlign:"center", padding:28 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
          <div style={{ color:"#16A34A", fontWeight:700, fontSize:16 }}>Imported Successfully!</div>
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS TAB ─────────────────────────────────────────────────────────────
function SettingsTab({ expenses, earnings, budgets, favourites, categories, onRestore }) {
  const [importing,setImporting]     = useState(false);
  const [importMsg,setImportMsg]     = useState(null);
  const [showConfirm,setShowConfirm] = useState(false);
  const [pendingData,setPendingData] = useState(null);
  const fileRef = useRef();

  function exportBackup() {
    const backup={ version:2, exportedAt:new Date().toISOString(), expenses, earnings, budgets, favourites, categories };
    const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob); a.download=`spendwise-backup-${new Date().toISOString().split("T")[0]}.json`; a.click();
  }

  function exportCSV() {
    const rows=[["Date","User","Description","Category","Tag","Amount","Recurring","Source"],...expenses.map(e=>[e.date,e.user,`"${e.description}"`,e.category,e.tag||"",e.amount,e.recurring?"yes":"no",e.source||"manual"])];
    const blob=new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob); a.download=`spendwise-expenses-${new Date().toISOString().split("T")[0]}.csv`; a.click();
  }

  async function handleFileSelect(e) {
    const file=e.target.files[0]; if(!file) return;
    e.target.value=""; setImporting(true); setImportMsg(null);
    try {
      const data=JSON.parse(await file.text());
      if (!data.expenses||!data.earnings) throw new Error("Invalid backup file — missing required fields.");
      setPendingData(data); setShowConfirm(true);
    } catch(err) { setImportMsg({type:"err",text:err.message||"Could not read file."}); }
    setImporting(false);
  }

  const statItems=[
    ["💳 Total Expenses",expenses.length],
    ["💰 Total Earnings",earnings.length],
    ["⭐ Favourites",favourites.length],
    ["🏷️ Categories",categories.length],
  ];

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>Settings</div>
      <div style={{ fontSize:12, color:"#9CA3AF", marginBottom:20 }}>Backup, restore & app data</div>

      <div style={SC}>
        <div style={{ fontSize:11, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:12 }}>Your Data</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {statItems.map(([label,val])=>(
            <div key={label} style={{ background:"#FAFAF7", borderRadius:10, padding:"10px 12px", border:"1px solid #F0EFE8" }}>
              <div style={{ fontSize:11, color:"#9CA3AF", marginBottom:3 }}>{label}</div>
              <div style={{ fontSize:18, fontWeight:700, color:"#1A1A1A" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={SC}>
        <div style={{ fontSize:11, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:4 }}>Export & Backup</div>
        <div style={{ fontSize:12, color:"#9CA3AF", marginBottom:14 }}>Save your data before switching devices or updating the app.</div>
        <button onClick={exportBackup}
          style={{ width:"100%", padding:13, borderRadius:12, border:"none", background:"linear-gradient(135deg,#FF6B35,#FF4757)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", marginBottom:10 }}>
          📦 Download Full Backup (.json)
        </button>
        <button onClick={exportCSV}
          style={{ width:"100%", padding:13, borderRadius:12, border:"1px solid #E0DDD4", background:"#FAFAF7", color:"#1A1A1A", fontSize:14, fontWeight:600, cursor:"pointer" }}>
          📊 Export Expenses as CSV
        </button>
        <div style={{ fontSize:11, color:"#9CA3AF", marginTop:10, lineHeight:1.6 }}>
          💡 <strong>.json backup</strong> saves everything — expenses, earnings, budgets, favourites, custom categories. Use it to fully restore.
        </div>
      </div>

      <div style={SC}>
        <div style={{ fontSize:11, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1, fontWeight:600, marginBottom:4 }}>Restore from Backup</div>
        <div style={{ fontSize:12, color:"#9CA3AF", marginBottom:14 }}>Upload a <code>.json</code> backup file to restore all data.</div>
        <input ref={fileRef} type="file" accept=".json" style={{ display:"none" }} onChange={handleFileSelect}/>
        <button onClick={()=>fileRef.current.click()} disabled={importing}
          style={{ width:"100%", padding:13, borderRadius:12, border:"2px dashed #BBF7D0", background:"#F0FDF4", color:"#16A34A", fontSize:14, fontWeight:700, cursor:"pointer", opacity:importing?0.6:1 }}>
          {importing?"⏳ Reading file...":"📂 Choose Backup File (.json)"}
        </button>
        {importMsg&&(
          <div style={{ marginTop:12, padding:"11px 14px", borderRadius:10, background:importMsg.type==="ok"?"#F0FDF4":"#FEF2F2", border:`1px solid ${importMsg.type==="ok"?"#BBF7D0":"#FECACA"}`, color:importMsg.type==="ok"?"#065F46":"#991B1B", fontSize:13 }}>
            {importMsg.type==="ok"?"✅ ":"⚠️ "}{importMsg.text}
          </div>
        )}
      </div>

      {showConfirm&&pendingData&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background:"#FFFFFF", borderRadius:20, padding:24, width:"100%", maxWidth:380 }}>
            <div style={{ fontSize:28, textAlign:"center", marginBottom:8 }}>⚠️</div>
            <div style={{ fontSize:16, fontWeight:700, textAlign:"center", marginBottom:8 }}>Replace All Data?</div>
            <div style={{ fontSize:13, color:"#6B7280", textAlign:"center", marginBottom:6 }}>This will replace your current data with backup from:</div>
            <div style={{ fontSize:12, color:"#FF4757", fontWeight:600, textAlign:"center", marginBottom:6 }}>{new Date(pendingData.exportedAt).toLocaleString()}</div>
            <div style={{ fontSize:12, color:"#6B7280", textAlign:"center", marginBottom:20 }}>{pendingData.expenses?.length||0} expenses · {pendingData.earnings?.length||0} earnings</div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>{ setShowConfirm(false); setPendingData(null); }}
                style={{ flex:1, padding:12, borderRadius:12, border:"1px solid #E0DDD4", background:"transparent", color:"#6B7280", fontSize:14, cursor:"pointer" }}>Cancel</button>
              <button onClick={()=>{ onRestore(pendingData); setPendingData(null); setShowConfirm(false); setImportMsg({type:"ok",text:`Restored ${pendingData.expenses?.length||0} expenses, ${pendingData.earnings?.length||0} earnings.`}); }}
                style={{ flex:1, padding:12, borderRadius:12, border:"none", background:"linear-gradient(135deg,#22C55E,#16A34A)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>✅ Restore</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeUser,setActiveUser] = useState("Suresh");
  const [view,setView]             = useState("expense");

  const [expenses,  setExpenses]   = useState(()=>{ try{return JSON.parse(localStorage.getItem("spendwise_expenses")||"[]");}catch{return[];} });
  const [earnings,  setEarnings]   = useState(()=>{ try{return JSON.parse(localStorage.getItem("spendwise_earnings")||"[]");}catch{return[];} });
  const [budgets,   setBudgets]    = useState(()=>{ try{return JSON.parse(localStorage.getItem("spendwise_budgets") ||"{}");}catch{return{};} });
  const [favourites,setFavourites] = useState(()=>{ try{return JSON.parse(localStorage.getItem("spendwise_favs")   ||"[]");}catch{return[];} });
  const [categories,setCategories] = useState(()=>{ try{ const s=localStorage.getItem("spendwise_cats"); return s?JSON.parse(s):DEFAULT_CATEGORIES; }catch{return DEFAULT_CATEGORIES;} });
  const [savingsGoal,setSavingsGoal]=useState(()=>{ try{return JSON.parse(localStorage.getItem("spendwise_goal")  ||'{"target":0,"saved":0}');}catch{return{target:0,saved:0};} });
  const [showCatMgr,setShowCatMgr] = useState(false);

  useEffect(()=>localStorage.setItem("spendwise_expenses",JSON.stringify(expenses)), [expenses]);
  useEffect(()=>localStorage.setItem("spendwise_earnings",JSON.stringify(earnings)), [earnings]);
  useEffect(()=>localStorage.setItem("spendwise_budgets", JSON.stringify(budgets)),  [budgets]);
  useEffect(()=>localStorage.setItem("spendwise_favs",    JSON.stringify(favourites)),[favourites]);
  useEffect(()=>localStorage.setItem("spendwise_cats",    JSON.stringify(categories)),[categories]);
  useEffect(()=>localStorage.setItem("spendwise_goal",    JSON.stringify(savingsGoal)),[savingsGoal]);

  // Sync savings goal saved amount
  useEffect(()=>{
    const now=new Date(); const mk=`${now.getFullYear()}-${now.getMonth()}`;
    const earn=sumAmt(earnings.filter(e=>e.user===activeUser&&getMonthKey(e.date)===mk));
    const spent=sumAmt(expenses.filter(e=>e.user===activeUser&&getMonthKey(e.date)===mk));
    setSavingsGoal(g=>({...g,saved:Math.max(0,earn-spent)}));
  },[expenses,earnings,activeUser]);

  // Savings streak
  const streak = (()=>{
    let s=0; const now=new Date();
    for (let i=0;i<12;i++) {
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      const mk=`${d.getFullYear()}-${d.getMonth()}`;
      const earn=sumAmt(earnings.filter(e=>e.user===activeUser&&getMonthKey(e.date)===mk));
      const spent=sumAmt(expenses.filter(e=>e.user===activeUser&&getMonthKey(e.date)===mk));
      if (earn>0&&earn>spent) s++; else break;
    }
    return s;
  })();

  // Auto-add recurring
  useEffect(()=>{
    const now=new Date(); const mk=`${now.getFullYear()}-${now.getMonth()}`;
    const already=expenses.some(e=>e.recurring&&e.user===activeUser&&getMonthKey(e.date)===mk);
    if (!already) {
      const prev=new Date(now.getFullYear(),now.getMonth()-1,1);
      const prevMk=`${prev.getFullYear()}-${prev.getMonth()}`;
      const recurring=expenses.filter(e=>e.recurring&&e.user===activeUser&&getMonthKey(e.date)===prevMk);
      if (recurring.length>0) setExpenses(p=>[...p,...recurring.map(e=>({...e,id:genId(),date:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`,source:"recurring"}))]);
    }
  },[activeUser]);

  // CRUD
  const addExpense    = d   => setExpenses(p=>[...p,{id:genId(),user:activeUser,source:"manual",...d}]);
  const deleteExpense = id  => setExpenses(p=>p.filter(e=>e.id!==id));
  const editExpense   = (id,d) => setExpenses(p=>p.map(e=>e.id===id?{...e,...d}:e));
  const addEarning    = d   => setEarnings(p=>[...p,{id:genId(),user:activeUser,...d}]);
  const deleteEarning = id  => setEarnings(p=>p.filter(e=>e.id!==id));
  const editEarning   = (id,d) => setEarnings(p=>p.map(e=>e.id===id?{...e,...d}:e));
  const importBank    = rows => setExpenses(p=>[...p,...rows.map(r=>({id:genId(),user:activeUser,source:"bank",...r}))]);
  const toggleFav     = fav => setFavourites(f=>{ const idx=f.findIndex(x=>x.description===fav.description&&x.amount===fav.amount); return idx>=0?f.filter((_,i)=>i!==idx):[...f,fav]; });
  const restoreBackup = data => {
    if(data.expenses)   setExpenses(data.expenses);
    if(data.earnings)   setEarnings(data.earnings);
    if(data.budgets)    setBudgets(data.budgets);
    if(data.favourites) setFavourites(data.favourites);
    if(data.categories) setCategories(data.categories);
  };

  const tabs = [
    {id:"home",    icon:"📊", label:"Home"},
    {id:"expense", icon:"➖", label:"Spend"},
    {id:"earning", icon:"➕", label:"Earn"},
    {id:"stats",   icon:"📈", label:"Stats"},
    {id:"bank",    icon:"🏦", label:"Bank"},
    {id:"settings",icon:"⚙️", label:"Settings"},
  ];

  return (
    <div style={{ background:"#FAFAF7", minHeight:"100vh", color:"#1A1A1A", fontFamily:"'Sora','DM Sans','Segoe UI',sans-serif", maxWidth:480, margin:"0 auto" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box} button{font-family:inherit} select{font-family:inherit} input[type="date"]{-webkit-appearance:none;appearance:none;min-height:44px;} input[type="date"]::-webkit-date-and-time-value{text-align:left;} input[type="date"]::-webkit-calendar-picker-indicator{opacity:0.5;cursor:pointer;}`}</style>

      {/* Header */}
      <div style={{ padding:"14px 20px 10px", borderBottom:"1px solid #E8E6DE", background:"rgba(250,250,247,0.97)", backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:17, fontWeight:700 }}>💸 Spendwise</div>
          <div style={{ display:"flex", gap:6 }}>
            {USERS.map(u=>(
              <button key={u} onClick={()=>setActiveUser(u)}
                style={{ padding:"5px 12px", borderRadius:20, border:activeUser===u?"1px solid #FF475766":"1px solid #E0DDD4", background:activeUser===u?"#FF475711":"transparent", color:activeUser===u?"#FF4757":"#9CA3AF", fontSize:12, cursor:"pointer", fontWeight:activeUser===u?600:400 }}>
                {u==="Suresh"?"👤":"👩"} {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding:"18px 18px 100px" }}>
        {view==="home"     && <HomeTab user={activeUser} expenses={expenses} earnings={earnings} budgets={budgets} setBudgets={setBudgets} savingsGoal={savingsGoal} setSavingsGoal={setSavingsGoal} streak={streak} categories={categories}/>}
        {view==="expense"  && <AddExpenseTab user={activeUser} expenses={expenses} onAdd={addExpense} onDelete={deleteExpense} onEdit={editExpense} favourites={favourites} onToggleFav={toggleFav} categories={categories} onManageCategories={()=>setShowCatMgr(true)}/>}
        {view==="earning"  && <AddEarningTab user={activeUser} earnings={earnings} onAdd={addEarning} onDelete={deleteEarning} onEdit={editEarning}/>}
        {view==="stats"    && <StatsTab user={activeUser} expenses={expenses} earnings={earnings} categories={categories}/>}
        {view==="bank"     && <BankTab onImport={importBank}/>}
        {view==="settings" && <SettingsTab expenses={expenses} earnings={earnings} budgets={budgets} favourites={favourites} categories={categories} onRestore={restoreBackup}/>}
      </div>

      {showCatMgr&&<CategoryManagerModal categories={categories} onSave={cats=>{ setCategories(cats); setShowCatMgr(false); }} onClose={()=>setShowCatMgr(false)}/>}

      {/* Bottom nav */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, background:"rgba(250,250,247,0.98)", backdropFilter:"blur(16px)", borderTop:"1px solid #E8E6DE", boxShadow:"0 -4px 20px rgba(0,0,0,0.06)", padding:"10px 12px 28px", display:"flex", gap:4 }}>
        {tabs.map(t=>{ const active=view===t.id; return (
          <button key={t.id} onClick={()=>setView(t.id)}
            style={{ flex:1, padding:"8px 2px", borderRadius:12, border:"none", background:active?"#FF4757":"transparent", color:active?"#fff":"#9CA3AF", fontSize:9, fontWeight:active?700:400, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <span style={{ fontSize:16 }}>{t.icon}</span>{t.label}
          </button>
        ); })}
      </div>
    </div>
  );
}
