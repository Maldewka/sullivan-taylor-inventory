const KEY='coffeeInventory.v1';
const DEFAULT_HEADERS=['Coffee Beans','Espresso & Decaf','Milk & Dairy','Non-Dairy Milks','Syrups & Sauces','Tea','Cups','Lids','Sleeves & Straws','Pastries & Food','Cleaning Supplies','Paper Goods & Napkins'];
let S;let HS=localStorage.getItem('coffeeInventory.headerStyle');if(HS===null)HS='border';if(HS==='both')HS='border tint';document.body.dataset.hs=HS;const hsOn=k=>HS.split(' ').includes(k);let tab='inventory';let histSel=null;let reorderMode=false; // phone-only item reorder mode (not persisted)
function load(){const raw=localStorage.getItem(KEY);if(raw===null){const d=seeded();localStorage.setItem(KEY,JSON.stringify(d));return d}try{return JSON.parse(raw)||blank()}catch{return blank()}}
function seeded(){const d=blank();d.headers=DEFAULT_HEADERS.map(name=>({id:uid(),name,items:[]}));return d}
function blank(){return{headers:[],snapshots:[],draft:null}}
function save(){localStorage.setItem(KEY,JSON.stringify(S));if(typeof Sync!=="undefined")Sync.changed()} // local first, then cloud (sync.js)
const uid=()=>Math.random().toString(36).slice(2,10);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
const fmt=d=>new Date(d).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
S=load();
const V=document.getElementById('view');
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{if(b.dataset.tab!==tab)reorderMode=false;tab=b.dataset.tab;histSel=null;render()});
let printMode=false; // on-screen print-friendly sales view (not persisted)
function render(){document.body.classList.toggle('printView',printMode);if(printMode)return printView();document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));({inventory,orders,database,history:historyTab})[tab]()}
// snapshot helpers
function freeze(counts,skipped={}){return S.headers.map(h=>({name:h.name,items:h.items.map(i=>skipped[i.id]?{name:i.name,par:i.par,count:null,skipped:true}:{name:i.name,par:i.par,count:counts[i.id]??null})}))}
function shortList(groups){return groups.map(g=>({name:g.name,items:g.items.filter(i=>!i.skipped&&i.count!==null&&i.count<i.par).map(i=>({...i,need:Math.ceil(+(i.par-i.count).toFixed(6))}))})).filter(g=>g.items.length)}
function latest(){return S.snapshots[S.snapshots.length-1]}
// INVENTORY
function inventory(){
 if(!S.headers.some(h=>h.items.length)){V.innerHTML=`<div class="card empty">No items yet. Add headers and items in the <b>Database</b> tab.</div>`;return}
 if(!S.draft)S.draft={id:uid(),started:new Date().toISOString(),counts:{}};
 const d=S.draft;d.skipped=d.skipped||{};
 let h=`<div class="bar"><div style="flex:1"><b>Count date:</b> <input type="date" id="cdate" value="${d.date||today()}"> <span class="muted">started ${fmt(d.started)}</span></div>
 <button id="saveCount">Save count</button><button class="light" id="newCount">New count</button><span class="muted lastSaved">${lastSavedText()}</span></div>`;
 for(const g of S.headers){if(!g.items.length)continue;h+=`<div class="card"><h3 class="ghead">${esc(g.name)}</h3>`;
  for(const i of g.items){const c=d.counts[i.id],sk=!!d.skipped[i.id];h+=`<div class="item${sk?' skipped':''}" data-item="${i.id}"><div class="name">${esc(i.name)}<div class="muted">${sk?'Skipped this week':'PAR '+i.par}</div></div>
  <input type="number" inputmode="decimal" step="any" min="0" data-id="${i.id}" value="${sk?'':c??''}" placeholder="${sk?'—':'count'}" ${sk?'disabled':''} aria-label="count ${esc(i.name)}"><button class="light sm skipBtn" data-id="${i.id}" aria-pressed="${sk}">${sk?'Unskip':'Skip'}</button></div>`}
  h+=`</div>`}
 V.innerHTML=h;
 V.querySelectorAll('input[type=number]').forEach(inp=>inp.oninput=()=>{const v=inp.value===''?null:Number(inp.value);if(v===null)delete d.counts[inp.dataset.id];else d.counts[inp.dataset.id]=v;save()});
 V.querySelectorAll('.skipBtn').forEach(b=>b.onclick=()=>{const id=b.dataset.id;if(d.skipped[id])delete d.skipped[id];else{d.skipped[id]=true;delete d.counts[id]}save();render()});
 cdate.onchange=()=>{d.date=cdate.value;save()};
 saveCount.onclick=()=>{const blanks=S.headers.flatMap(g=>g.items).filter(i=>!d.skipped[i.id]&&d.counts[i.id]==null).map(i=>i.name);
  if(blanks.length){const counted=Object.keys(d.counts).length;const list=blanks.slice(0,8).map(n=>'• '+n).join('\n')+(blanks.length>8?`\n+${blanks.length-8} more`:'');
   if(!confirm((counted?'These items have no count:\n':'No counts entered. These items have no count:\n')+list+'\n\nSave anyway?'))return}
  {const dt=d.date||today();const snap={id:d.id,date:dt,savedAt:new Date().toISOString(),groups:freeze(d.counts,d.skipped)};const ix=S.snapshots.findIndex(x=>x.date===dt);if(ix>=0){snap.id=S.snapshots[ix].id;S.snapshots.splice(ix,1)}S.snapshots.push(snap)}S.draft=null;save();tab='orders';render()};
 newCount.onclick=()=>{const has=Object.keys(d.counts).length||Object.keys(d.skipped).length;if(has&&!confirm('Discard the unsaved count and start a new one?'))return;S.draft=null;S.ordersClearedAt=new Date().toISOString();save();render();toast('New count started. Order List cleared.')};
}
function lastSavedText(){const t=S.snapshots.map(x=>x.savedAt).filter(Boolean).sort().pop();if(!t)return 'Not saved yet';const d=new Date(t);return 'Last saved '+d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})+', '+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}
function toast(m){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');document.body.appendChild(t)}t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),2600)}
// ORDERS
function orders(){const s=latest();if(s&&S.ordersClearedAt&&S.ordersClearedAt>=s.savedAt){V.innerHTML=`<div class="card empty">New count started. The Order List will fill in when you tap <b>Save count</b>. Earlier order lists are in <b>History</b>.</div>`;return}if(!s){V.innerHTML=`<div class="card empty">No saved counts yet. Do a count in the <b>Inventory</b> tab.</div>`;return}
 V.innerHTML=`<p class="muted">From count on <b>${s.date}</b> (saved ${fmt(s.savedAt)})</p>`+orderHtml(s)}
function orderHtml(s){const L=shortList(s.groups);if(!L.length)return`<div class="card empty">Nothing to order — everything is at or above par. 🎉</div>`;
 return L.map(g=>`<div class="card"><h3>${esc(g.name)}</h3>`+g.items.map(i=>`<div class="item"><div class="name">${esc(i.name)}<div class="muted">have ${i.count} / par ${i.par}</div></div><span class="short">Order ${i.need}</span></div>`).join('')+`</div>`).join('')}
function countHtml(s){return s.groups.filter(g=>g.items.length).map(g=>`<div class="card"><h3>${esc(g.name)}</h3>`+g.items.map(i=>{const c=costOf(g.name,i.name);return`<div class="item"><div class="name">${esc(i.name)}<div class="muted">PAR ${i.par}</div>${c===null?'':`<div class="muted cCount">cost ${money(c)}</div>`}</div>${i.skipped?'<span class="muted skipTag">Skipped</span>':i.count==null?'<span class="muted">Not counted</span>':`<b>${i.count}</b>`}</div>`}).join('')+`</div>`).join('')}
// COST (what the shop paid per unit; Database only, used by Sales + receipt, never on Order List/Inventory)
const money=n=>'$'+(Math.round(n*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const hasCost=i=>i&&typeof i.cost==='number'&&isFinite(i.cost);
function parseCost(v){v=String(v).trim().replace(/[$,\s]/g,'');if(v==='')return null;const n=Number(v);return isFinite(n)&&n>=0?Math.round(n*100)/100:NaN}
function costOf(hn,n){for(const h of S.headers)if(h.name===hn)for(const i of h.items)if(i.name===n&&hasCost(i))return i.cost;return null} // current Database cost, matched by header + item name
// HISTORY
const SALES_KEY='coffeeInventory.salesWindow';
const SALES_WINDOWS={weekly:{days:7,label:'Weekly'},biweekly:{days:14,label:'Bi-weekly'},monthly:{days:30,label:'Monthly'},quarterly:{days:90,label:'Quarterly'}};
function salesKind(){const v=localStorage.getItem(SALES_KEY);return v==='off'?'off':SALES_WINDOWS[v]?v:'weekly'} // 'off' = sales hidden on History (toggle-off); no saved choice = Weekly
function isoLocal(d){return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)}
const SALES_END_KEY='coffeeInventory.salesEnd';
function salesEnd(){const v=localStorage.getItem(SALES_END_KEY);return /^\d{4}-\d{2}-\d{2}$/.test(v||'')&&!isNaN(new Date(v+'T12:00:00'))?v:today()}
function setSalesEnd(v){if(/^\d{4}-\d{2}-\d{2}$/.test(v||''))localStorage.setItem(SALES_END_KEY,v);else localStorage.removeItem(SALES_END_KEY)}
const dayOf=iso=>new Date(iso+'T12:00:00');
const addDays=(iso,n)=>{const d=dayOf(iso);d.setDate(d.getDate()+n);return isoLocal(d)};
function lastSunday(){const t=today();return addDays(t,-dayOf(t).getDay())} // today if today is Sunday
function windowRange(kind){
 // N days ending on the picked end day (default today). Counts dated start..end (= after the "from" day) are the
 // later side of a pair, so sales run from the count on the "from" day to the count on the end day.
 // Pick a Sunday with Bi-weekly => Sunday-to-Sunday, two weeks.
 const days=SALES_WINDOWS[kind].days;const end=salesEnd();
 return{start:addDays(end,-(days-1)),end,from:addDays(end,-days),days}}
function fmtShort(iso){return dayOf(iso).toLocaleDateString(undefined,{month:'short',day:'numeric'})}
function fmtDay(iso,yr){return dayOf(iso).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',...(yr?{year:'numeric'}:{})})}
function rangeText(r){const y=r.from.slice(0,4)!==r.end.slice(0,4)||r.end.slice(0,4)!==today().slice(0,4);
 return`${fmtDay(r.from,y)} – ${fmtDay(r.end,y)}`}
function windowText(kind,r){return r.end===today()?`Last ${r.days} days`:`${SALES_WINDOWS[kind].label} (${r.days} days)`}
function computeSales(kind){
 // Sold = drop between consecutive dated snapshots, attributed to the later date.
 // Interval included when later.date is inside [start, end] (rolling window ending today).
 // Match items by header name + item name. Skip skipped/null. Ignore negative (restock).
 const{start,end,days}=windowRange(kind);
 const snaps=[...S.snapshots].filter(s=>s&&s.date).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.savedAt<b.savedAt?-1:1);
 const totals={};let pairs=0;
 for(let i=1;i<snaps.length;i++){
  const earlier=snaps[i-1],later=snaps[i];
  if(later.date<start||later.date>end)continue;
  pairs++;
  const em={};for(const g of earlier.groups||[])for(const it of g.items||[])em[g.name+'\0'+it.name]=it;
  for(const g of later.groups||[])for(const it of g.items||[]){
   const prev=em[g.name+'\0'+it.name];if(!prev)continue;
   if(prev.skipped||it.skipped)continue;
   if(typeof prev.count!=='number'||typeof it.count!=='number')continue;
   const sold=+(prev.count-it.count).toFixed(6);if(!(sold>0))continue;
   (totals[g.name]||(totals[g.name]={}))[it.name]=+(((totals[g.name]&&totals[g.name][it.name])||0)+sold).toFixed(6);
  }
 }
 return{start,end,from:addDays(end,-days),days,pairs,totals}
}
function salesUsed(r){const order=[...S.headers.map(h=>h.name)];for(const n of Object.keys(r.totals))if(!order.includes(n))order.push(n);
 return order.filter(n=>r.totals[n]&&Object.keys(r.totals[n]).length).map(hn=>[hn,Object.entries(r.totals[hn]).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))])}
function salesMoney(used){ // per line: [name, sold, cost|null, line|null]; subtotal per category; grand total of costed lines only
 let grand=0,missing=0;const groups=used.map(([hn,items])=>{let sub=0,subN=0;const rows=items.map(([n,q])=>{const c=costOf(hn,n);if(c===null){missing++;return[n,q,null,null]}const t=Math.round(q*c*100)/100;sub+=t;subN++;return[n,q,c,t]});
  sub=Math.round(sub*100)/100;grand+=sub;return{hn,rows,sub,subN}});
 return{groups,grand:Math.round(grand*100)/100,missing}}
function salesEmpty(r){if(S.snapshots.length<2)return'Need at least two saved counts to see sales and their cost. The drop between one count and the next is what sold.';
 if(r.pairs===0)return'No count pairs fall in this window yet. Try a longer window or another end date, or save another count.';
 if(!salesUsed(r).length)return'Nothing sold in this window — counts didn’t drop between saves.';return''}
function salesWinBtns(kind){return Object.entries(SALES_WINDOWS).map(([k,v])=>`<button type="button" class="sm ${k===kind?'on':''}" data-sw="${k}" aria-pressed="${k===kind}">${v.label}</button>`).join('')}
function salesControlsHtml(kind){ // shared by History > Sales and the print view
 const btns=Object.entries(SALES_WINDOWS).map(([k,v])=>`<button type="button" class="sm ${k===kind?'on':''}" data-sw="${k}" aria-pressed="${k===kind}">${v.label}</button>`).join('');
 const e=salesEnd();
 return`<span class="hsw salesWin">${btns}</span><span class="salesEndBox"><label class="salesEndLbl">Ending <input type="date" class="salesEnd" value="${e}" max="${today()}" aria-label="Sales end date"></label><button type="button" class="light sm" data-se="sun">Last Sunday</button><button type="button" class="light sm" data-se="today">Today</button></span>`}
function bindSales(root,canOff){ // canOff: tapping the selected window turns sales off (History only, not the print view)
 root.querySelectorAll('.salesWin button').forEach(b=>b.onclick=()=>{localStorage.setItem(SALES_KEY,canOff&&b.dataset.sw===salesKind()?'off':b.dataset.sw);render()});
 root.querySelectorAll('input.salesEnd').forEach(i=>i.onchange=()=>{setSalesEnd(i.value);render()});
 root.querySelectorAll('[data-se]').forEach(b=>b.onclick=()=>{setSalesEnd(b.dataset.se==='sun'?lastSunday():today());render()})}
function salesHtml(){
 const kind=salesKind();
 if(kind==='off')return`<section class="sales salesOff" aria-label="Sales (off)"><div class="bar salesBar"><b>Sales</b><span class="hsw salesWin">${salesWinBtns(kind)}</span></div></section><h2 class="histHead">Saved counts</h2>`;
 const r=computeSales(kind);
 const range=`${windowText(kind,r)} · ${rangeText(r)}`;
 const msg=salesEmpty(r);
 let body;if(msg)body=`<div class="card empty">${esc(msg)}</div>`;else{const M=salesMoney(salesUsed(r));
 body=M.groups.map(g=>`<div class="card"><h3 class="ghead">${esc(g.hn)}</h3>`+g.rows.map(([n,q,c,t])=>`<div class="item"><div class="name">${esc(n)}</div><span class="sold">Sold ${q}</span><span class="costInfo"><span class="muted cEach">${c===null?'no cost':money(c)+' ea'}</span><b class="cLine">${t===null?'—':money(t)}</b></span></div>`).join('')
  +(g.subN?`<div class="item subTot"><div class="name muted">Subtotal</div><b class="cSub">${money(g.sub)}</b></div>`:'')+`</div>`).join('')
  +`<div class="card grandTot"><div class="item"><div class="name"><b>Total cost of items sold</b></div><b class="cGrand">${money(M.grand)}</b></div>${M.missing?`<p class="muted costNote">${M.missing} item${M.missing===1?'':'s'} without a cost ${M.missing===1?"isn't":"aren't"} in the total. Add costs in the <b>Database</b> tab.</p>`:''}</div>`}
 return`<section class="sales" aria-label="Sales"><div class="bar salesBar"><b>Sales</b>${salesControlsHtml(kind)}</div><p class="muted salesRange">${esc(range)}</p>${body}</section><h2 class="histHead">Saved counts</h2>`
}
// PRINT-FRIENDLY SALES VIEW (typewriter / receipt layout; @media print prints only .receipt)
let preKind=null;
function enterPrint(){printMode=true;preKind=salesKind();localStorage.setItem(SALES_KEY,'biweekly');reorderMode=false;document.body.classList.remove('reorder');render();window.scrollTo(0,0)}
function exitPrint(){printMode=false;if(preKind==='off')localStorage.setItem(SALES_KEY,'off');preKind=null; // History sales stay off if they were off
 render();window.scrollTo(0,0)}
function orderReceiptHtml(){ // same list as the Order List tab (latest saved count, respects New count). No cost here.
 const s=latest();let body;
 if(!s)body=`<p class="rEmpty">No saved count yet. Count on the Inventory tab, then tap Save count.</p>`;
 else if(S.ordersClearedAt&&S.ordersClearedAt>=s.savedAt)body=`<p class="rEmpty">New count started. The list fills in when you tap Save count.</p>`;
 else{const L=shortList(s.groups);
  body=`<div class="rRange">From count ${esc(fmtDay(s.date))}</div><div class="rRule thin"></div>`+(L.length?L.map(g=>`<div class="rOGroup"><div class="rHead">${esc(g.name)}</div>`+g.items.map(i=>`<div class="rOLine"><span class="rName">${esc(i.name)}</span><span class="rDots"></span><span class="rNeed">${i.need}</span></div><div class="rCost"><span>have ${i.count} / par ${i.par}</span></div>`).join('')+`</div>`).join(''):`<p class="rEmpty">Nothing to order — everything is at or above par.</p>`)}
 return`<section class="rOrder" aria-label="Order list"><div class="rRule"></div><h2 class="rSales">To order</h2>${body}</section>`}
function printView(){try{printViewInner()}catch(e){ // never leave a blank page: show what went wrong
 console.error(e);document.getElementById('printView').innerHTML=`<div class="pvCtl"><div class="pvBtns"><button type="button" class="light" id="pvBack">← Back</button></div></div><article class="receipt"><div class="rTitle">Sullivan Taylor Uptown</div><p class="rEmpty">Couldn’t build the print view: ${esc(e&&e.message||e)}</p></article>`;pvBack.onclick=exitPrint}}
function printViewInner(){
 const P=document.getElementById('printView');const kind=salesKind();const r=computeSales(kind);const msg=salesEmpty(r);
 let lines;if(msg)lines=`<p class="rEmpty">${esc(msg)}</p>`;else{const M=salesMoney(salesUsed(r));
 lines=M.groups.map(g=>`<div class="rGroup"><div class="rHead">${esc(g.hn)}</div>`+g.rows.map(([n,q,c,t])=>`<div class="rLine"><span class="rName">${esc(n)}</span><span class="rDots"></span><span class="rQty">${q}</span></div><div class="rCost"><span class="rEach">${q} @ ${c===null?'—':money(c)}</span><span class="rDots"></span><span class="rTot">${t===null?'—':money(t)}</span></div>`).join('')
  +(g.subN?`<div class="rCost rSubLine"><span>Subtotal</span><span class="rDots"></span><span class="rSub">${money(g.sub)}</span></div>`:'')+`</div>`).join('')
  +`<div class="rRule"></div><div class="rLine rGrandLine"><span class="rName">TOTAL COST</span><span class="rDots"></span><span class="rGrand">${money(M.grand)}</span></div>${M.missing?`<div class="rNote">* Items without a cost (—) aren't in the total.</div>`:''}`}
 const now=new Date();
 P.innerHTML=`<div class="pvCtl noprint"><div class="pvBtns"><button type="button" class="light" id="pvBack" aria-label="Exit print view">← Back</button><button type="button" id="pvPrint" aria-label="Print sales">Print…</button></div>
 <div class="bar salesBar pvSales">${salesControlsHtml(kind)}</div>
 <p class="muted pvHint">Pick the last day to include. Bi-weekly covers the 14 days ending that day, from the count on the start day to the count on the end day — pick a Sunday for Sunday-to-Sunday.</p></div>
 <article class="receipt" aria-label="Printable sales and order list">
 <div class="rTitle">Sullivan Taylor Uptown</div><h2 class="rSales">Sales</h2>
 <div class="rRange">${esc(rangeText(r))}</div><div class="rWin">${esc(SALES_WINDOWS[kind].label)} · ${r.days} days</div>
 <div class="rRule"></div><div class="rCols"><span>ITEM / QTY @ COST</span><span>SOLD / TOTAL</span></div><div class="rRule thin"></div>
 ${lines}
 <div class="rFoot rSalesFoot">Sold = drop between saved counts (restocks not counted). ${r.pairs} count ${r.pairs===1?'pair':'pairs'}.</div>
 ${orderReceiptHtml()}
 <div class="rRule"></div><div class="rFoot">Printed ${esc(now.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}))} ${esc(now.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}))}</div></article>`;
 pvBack.onclick=exitPrint;pvPrint.onclick=()=>window.print();bindSales(P)}
function historyTab(){ // (not named "history": that would hide the browser's window.history)
 if(histSel){const s=S.snapshots.find(x=>x.id===histSel);
  V.innerHTML=`<div class="bar"><button class="light" id="back">← All counts</button><b style="flex:1">Count of ${s.date}</b><button class="danger sm" id="delSnap">Delete</button></div>
  <div class="split"><section><h2>Count</h2>${countHtml(s)}</section><section><h2>Order list</h2>${orderHtml(s)}</section></div>`;
  back.onclick=()=>{histSel=null;render()};delSnap.onclick=()=>{if(confirm('Delete this count from history?')){S.snapshots=S.snapshots.filter(x=>x.id!==s.id);save();histSel=null;render()}};return}
 let h=salesHtml();
 if(!S.snapshots.length)V.innerHTML=h+`<div class="card empty">No history yet.</div>`;
 else{V.innerHTML=h+[...S.snapshots].reverse().map(s=>{const n=shortList(s.groups).reduce((a,g)=>a+g.items.length,0);
  return`<button class="hist" data-id="${s.id}"><span><b>${s.date}</b> <span class="muted">${fmt(s.savedAt)}</span></span><span>${n?`<span class="badge">${n} to order</span>`:'all good'}</span></button>`}).join('');
  V.querySelectorAll('.hist').forEach(b=>b.onclick=()=>{histSel=b.dataset.id;render()})}
 bindSales(V,true);
}
// DATABASE
function database(){
 document.body.classList.toggle('reorder',reorderMode);
 let h=`<div class="bar"><button id="addH">+ Add header</button><button id="reorderBtn" class="light sm reorderBtn${reorderMode?' on':''}" aria-pressed="${reorderMode}">${reorderMode?'Done':'Reorder'}</button><span style="flex:1"></span><span class="hsw muted">Header style: <button class="sm ${hsOn('border')?'on':''}" data-hs="border" aria-pressed="${hsOn('border')}">Border</button><button class="sm ${hsOn('tint')?'on':''}" data-hs="tint" aria-pressed="${hsOn('tint')}">Tint</button></span></div>`;
 if(!S.headers.length)h+=`<div class="card empty">Database is empty. Tap <b>+ Add header</b> to create a category like “Coffee”.</div>`;
 S.headers.forEach((g,gi)=>{h+=`<div class="card"><div class="hrow ghead"><input type="text" class="nm hname" data-g="${gi}" value="${esc(g.name)}" aria-label="header name">
  <button class="sm addI" data-g="${gi}">+ Add item</button><button class="light sm mvH" data-g="${gi}" data-d="-1" aria-label="move up">↑</button><button class="light sm mvH" data-g="${gi}" data-d="1" aria-label="move down">↓</button><button class="danger sm delH" data-g="${gi}" aria-label="delete header">✕</button></div>`;
  g.items.forEach((i,ii)=>{h+=`<div class="item dbItem"><input type="text" class="nm iname" data-g="${gi}" data-i="${ii}" value="${esc(i.name)}" aria-label="item name"><label class="muted">PAR <input type="number" min="0" class="ipar" data-g="${gi}" data-i="${ii}" value="${i.par}"></label><label class="muted icostL">Cost $<input type="text" inputmode="decimal" class="icost" data-g="${gi}" data-i="${ii}" value="${hasCost(i)?i.cost.toFixed(2):''}" placeholder="cost" aria-label="cost per unit ${esc(i.name)}"></label>
   <button class="light sm mvI" data-g="${gi}" data-i="${ii}" data-d="-1" aria-label="move item up">↑</button><button class="light sm mvI" data-g="${gi}" data-i="${ii}" data-d="1" aria-label="move item down">↓</button><button class="danger sm delI" data-g="${gi}" data-i="${ii}">✕</button></div>`});
  if(!g.items.length)h+=`<div class="muted" style="padding:8px 0">No items yet.</div>`;h+=`</div>`});
 V.innerHTML=h;const q=s=>V.querySelectorAll(s);
 q('.hsw button').forEach(b=>b.onclick=()=>{const k=b.dataset.hs;const set=HS.split(' ').filter(x=>x&&x!==k);if(!hsOn(k))set.push(k);HS=set.sort().join(' ');localStorage.setItem('coffeeInventory.headerStyle',HS);document.body.dataset.hs=HS;render()});
 addH.onclick=()=>{const n=prompt('Header name (e.g. Coffee, Non-food):');if(n&&n.trim()){S.headers.push({id:uid(),name:n.trim(),items:[]});save();render()}};
 q('.addI').forEach(b=>b.onclick=()=>{const g=S.headers[b.dataset.g];const n=prompt(`New item under “${g.name}”:`);if(!n||!n.trim())return;const p=prompt('PAR (required stock level):','');g.items.push({id:uid(),name:n.trim(),par:Math.max(0,Number(p)||0)});save();render()});
 q('.hname').forEach(e=>e.onchange=()=>{S.headers[e.dataset.g].name=e.value.trim()||'Untitled';save()});
 q('.iname').forEach(e=>e.onchange=()=>{S.headers[e.dataset.g].items[e.dataset.i].name=e.value.trim()||'Untitled';save()});
 q('.icost').forEach(e=>e.onchange=()=>{const it=S.headers[e.dataset.g].items[e.dataset.i],c=parseCost(e.value);
  if(Number.isNaN(c)){e.value=hasCost(it)?it.cost.toFixed(2):'';toast('Cost must be a dollar amount, like 4.50');return}
  if(c===null)delete it.cost;else{it.cost=c;e.value=c.toFixed(2)}save()});
 q('.ipar').forEach(e=>e.onchange=()=>{S.headers[e.dataset.g].items[e.dataset.i].par=Math.max(0,Number(e.value)||0);save()});
 const mv=(a,i,d)=>{const j=i+d;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];save();render()};
 q('.mvH').forEach(b=>b.onclick=()=>mv(S.headers,+b.dataset.g,+b.dataset.d));
 reorderBtn.onclick=()=>{reorderMode=!reorderMode;render()};
 q('.mvI').forEach(b=>b.onclick=()=>mv(S.headers[b.dataset.g].items,+b.dataset.i,+b.dataset.d));
 q('.delH').forEach(b=>b.onclick=()=>{const g=S.headers[b.dataset.g];if(confirm(`Delete header “${g.name}” and its ${g.items.length} item(s)?`)){S.headers.splice(b.dataset.g,1);save();render()}});
 q('.delI').forEach(b=>b.onclick=()=>{const a=S.headers[b.dataset.g].items;if(confirm(`Delete “${a[b.dataset.i].name}”?`)){a.splice(b.dataset.i,1);save();render()}});
}
// export/import
printBtn.onclick=()=>printMode?exitPrint():enterPrint();
logoutBtn.addEventListener('click',()=>{printMode=false;document.body.classList.remove('printView')});
exportBtn.onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,2)],{type:'application/json'}));a.download=`coffee-inventory-${today()}.json`;a.click()};
importFile.onchange=async()=>{const f=importFile.files[0];if(!f)return;try{const d=JSON.parse(await f.text());delete d.auth;if(!Array.isArray(d.headers)||!Array.isArray(d.snapshots))throw 0;if(confirm('Replace all current data with this backup?')){S=d;save();render()}}catch{alert('That file is not a valid backup.')}importFile.value=''};
// initial render is done by auth.js after sign-in
