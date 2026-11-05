const KEY='coffeeInventory.v1';
const DEFAULT_HEADERS=['Coffee Beans','Espresso & Decaf','Milk & Dairy','Non-Dairy Milks','Syrups & Sauces','Tea','Cups','Lids','Sleeves & Straws','Pastries & Food','Cleaning Supplies','Paper Goods & Napkins'];
let S;let HS=localStorage.getItem('coffeeInventory.headerStyle');if(HS===null)HS='border';if(HS==='both')HS='border tint';document.body.dataset.hs=HS;const hsOn=k=>HS.split(' ').includes(k);let tab='inventory';let histSel=null;let reorderMode=false; // phone-only item reorder mode (not persisted)
function load(){const raw=localStorage.getItem(KEY);if(raw===null){const d=seeded();localStorage.setItem(KEY,JSON.stringify(d));return d}try{return JSON.parse(raw)||blank()}catch{return blank()}}
function seeded(){const d=blank();d.headers=DEFAULT_HEADERS.map(name=>({id:uid(),name,items:[]}));return d}
function blank(){return{headers:[],snapshots:[],draft:null}}
function save(){localStorage.setItem(KEY,JSON.stringify(S))}
const uid=()=>Math.random().toString(36).slice(2,10);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
const fmt=d=>new Date(d).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
S=load();
const V=document.getElementById('view');
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{if(b.dataset.tab!==tab)reorderMode=false;tab=b.dataset.tab;histSel=null;render()});
function render(){document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));({inventory,orders,database,history})[tab]()}
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
function countHtml(s){return s.groups.filter(g=>g.items.length).map(g=>`<div class="card"><h3>${esc(g.name)}</h3>`+g.items.map(i=>`<div class="item"><div class="name">${esc(i.name)}<div class="muted">PAR ${i.par}</div></div>${i.skipped?'<span class="muted skipTag">Skipped</span>':i.count==null?'<span class="muted">Not counted</span>':`<b>${i.count}</b>`}</div>`).join('')+`</div>`).join('')}
// HISTORY
function history(){
 if(histSel){const s=S.snapshots.find(x=>x.id===histSel);
  V.innerHTML=`<div class="bar"><button class="light" id="back">← All counts</button><b style="flex:1">Count of ${s.date}</b><button class="danger sm" id="delSnap">Delete</button></div>
  <div class="split"><section><h2>Count</h2>${countHtml(s)}</section><section><h2>Order list</h2>${orderHtml(s)}</section></div>`;
  back.onclick=()=>{histSel=null;render()};delSnap.onclick=()=>{if(confirm('Delete this count from history?')){S.snapshots=S.snapshots.filter(x=>x.id!==s.id);save();histSel=null;render()}};return}
 if(!S.snapshots.length){V.innerHTML=`<div class="card empty">No history yet.</div>`;return}
 V.innerHTML=[...S.snapshots].reverse().map(s=>{const n=shortList(s.groups).reduce((a,g)=>a+g.items.length,0);
  return`<button class="hist" data-id="${s.id}"><span><b>${s.date}</b> <span class="muted">${fmt(s.savedAt)}</span></span><span>${n?`<span class="badge">${n} to order</span>`:'all good'}</span></button>`}).join('');
 V.querySelectorAll('.hist').forEach(b=>b.onclick=()=>{histSel=b.dataset.id;render()});
}
// DATABASE
function database(){
 document.body.classList.toggle('reorder',reorderMode);
 let h=`<div class="bar"><button id="addH">+ Add header</button><button id="reorderBtn" class="light sm reorderBtn${reorderMode?' on':''}" aria-pressed="${reorderMode}">${reorderMode?'Done':'Reorder'}</button><span style="flex:1"></span><span class="hsw muted">Header style: <button class="sm ${hsOn('border')?'on':''}" data-hs="border" aria-pressed="${hsOn('border')}">Border</button><button class="sm ${hsOn('tint')?'on':''}" data-hs="tint" aria-pressed="${hsOn('tint')}">Tint</button></span></div>`;
 if(!S.headers.length)h+=`<div class="card empty">Database is empty. Tap <b>+ Add header</b> to create a category like “Coffee”.</div>`;
 S.headers.forEach((g,gi)=>{h+=`<div class="card"><div class="hrow ghead"><input type="text" class="nm hname" data-g="${gi}" value="${esc(g.name)}" aria-label="header name">
  <button class="sm addI" data-g="${gi}">+ Add item</button><button class="light sm mvH" data-g="${gi}" data-d="-1" aria-label="move up">↑</button><button class="light sm mvH" data-g="${gi}" data-d="1" aria-label="move down">↓</button><button class="danger sm delH" data-g="${gi}" aria-label="delete header">✕</button></div>`;
  g.items.forEach((i,ii)=>{h+=`<div class="item"><input type="text" class="nm iname" data-g="${gi}" data-i="${ii}" value="${esc(i.name)}" aria-label="item name"><label class="muted">PAR <input type="number" min="0" class="ipar" data-g="${gi}" data-i="${ii}" value="${i.par}"></label>
   <button class="light sm mvI" data-g="${gi}" data-i="${ii}" data-d="-1" aria-label="move item up">↑</button><button class="light sm mvI" data-g="${gi}" data-i="${ii}" data-d="1" aria-label="move item down">↓</button><button class="danger sm delI" data-g="${gi}" data-i="${ii}">✕</button></div>`});
  if(!g.items.length)h+=`<div class="muted" style="padding:8px 0">No items yet.</div>`;h+=`</div>`});
 V.innerHTML=h;const q=s=>V.querySelectorAll(s);
 q('.hsw button').forEach(b=>b.onclick=()=>{const k=b.dataset.hs;const set=HS.split(' ').filter(x=>x&&x!==k);if(!hsOn(k))set.push(k);HS=set.sort().join(' ');localStorage.setItem('coffeeInventory.headerStyle',HS);document.body.dataset.hs=HS;render()});
 addH.onclick=()=>{const n=prompt('Header name (e.g. Coffee, Non-food):');if(n&&n.trim()){S.headers.push({id:uid(),name:n.trim(),items:[]});save();render()}};
 q('.addI').forEach(b=>b.onclick=()=>{const g=S.headers[b.dataset.g];const n=prompt(`New item under “${g.name}”:`);if(!n||!n.trim())return;const p=prompt('PAR (required stock level):','');g.items.push({id:uid(),name:n.trim(),par:Math.max(0,Number(p)||0)});save();render()});
 q('.hname').forEach(e=>e.onchange=()=>{S.headers[e.dataset.g].name=e.value.trim()||'Untitled';save()});
 q('.iname').forEach(e=>e.onchange=()=>{S.headers[e.dataset.g].items[e.dataset.i].name=e.value.trim()||'Untitled';save()});
 q('.ipar').forEach(e=>e.onchange=()=>{S.headers[e.dataset.g].items[e.dataset.i].par=Math.max(0,Number(e.value)||0);save()});
 const mv=(a,i,d)=>{const j=i+d;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];save();render()};
 q('.mvH').forEach(b=>b.onclick=()=>mv(S.headers,+b.dataset.g,+b.dataset.d));
 reorderBtn.onclick=()=>{reorderMode=!reorderMode;render()};
 q('.mvI').forEach(b=>b.onclick=()=>mv(S.headers[b.dataset.g].items,+b.dataset.i,+b.dataset.d));
 q('.delH').forEach(b=>b.onclick=()=>{const g=S.headers[b.dataset.g];if(confirm(`Delete header “${g.name}” and its ${g.items.length} item(s)?`)){S.headers.splice(b.dataset.g,1);save();render()}});
 q('.delI').forEach(b=>b.onclick=()=>{const a=S.headers[b.dataset.g].items;if(confirm(`Delete “${a[b.dataset.i].name}”?`)){a.splice(b.dataset.i,1);save();render()}});
}
// export/import
exportBtn.onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,2)],{type:'application/json'}));a.download=`coffee-inventory-${today()}.json`;a.click()};
importFile.onchange=async()=>{const f=importFile.files[0];if(!f)return;try{const d=JSON.parse(await f.text());delete d.auth;if(!Array.isArray(d.headers)||!Array.isArray(d.snapshots))throw 0;if(confirm('Replace all current data with this backup?')){S=d;save();render()}}catch{alert('That file is not a valid backup.')}importFile.value=''};
// initial render is done by auth.js after sign-in
