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
let printMode=false; // on-screen print-friendly view (not persisted)
function render(){closeSheet();document.body.classList.toggle('printView',printMode);if(printMode)return printView();document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));({inventory,orders,database,history:historyTab})[tab]()}
// snapshot helpers
// Primary count is the only number that feeds below-par, the Order List, and Overhead.
// count2 / count2Label are kept for reference when an item is counted in a second unit.
// count2Location is an optional place name for that second count. Missing or blank means none.
function freeze(counts,skipped={},counts2={}){return S.headers.map(h=>({name:h.name,items:h.items.map(i=>{
 const label=String(i.count2Label||'').trim();
 const loc2=itemCount2Loc(i);
 const stamp=row=>{if(label){row.count2Label=label;if(loc2)row.count2Location=loc2}return row};
 if(skipped[i.id])return stamp({name:i.name,par:i.par,count:null,skipped:true});
 const row=stamp({name:i.name,par:i.par,count:counts[i.id]??null});
 if(label)row.count2=counts2[i.id]??null;
 return row})}))}
function shortList(groups){return groups.map(g=>({name:g.name,items:g.items.filter(i=>!i.skipped&&i.count!==null&&i.count<i.par).map(i=>({...i,need:Math.ceil(+(i.par-i.count).toFixed(6))}))})).filter(g=>g.items.length)}
function latest(){return S.snapshots[S.snapshots.length-1]}
// allowDecimal false = whole units. Missing keeps the old decimal number-input behavior.
// count2Label empty/missing = a single count. Ordering never uses the second count.
// count2Location is optional free text. Non-strings and blanks are treated as unset so older items load cleanly.
const itemDecimal=i=>!i||i.allowDecimal!==false;
const itemCount2=i=>String(i&&i.count2Label||'').trim();
const itemCount2Loc=i=>{const v=i&&i.count2Location;return typeof v==='string'?v.trim():''};
let onSheetKey=null;
function closeSheet(){
 const el=document.getElementById('sheetBack');if(el)el.remove();
 document.body.classList.remove('sheetOpen');
 const app=document.getElementById('app');if(app)app.inert=false;
 if(onSheetKey){document.removeEventListener('keydown',onSheetKey);onSheetKey=null}
}
function mountSheet(html){
 closeSheet();
 const back=document.createElement('div');back.id='sheetBack';back.className='sheetBack';back.innerHTML=html;
 document.body.appendChild(back);document.body.classList.add('sheetOpen');
 const app=document.getElementById('app');if(app)app.inert=true;
 back.addEventListener('click',e=>{if(e.target===back)closeSheet()});
 onSheetKey=e=>{if(e.key==='Escape'){e.preventDefault();closeSheet()}};
 document.addEventListener('keydown',onSheetKey);
 return back;
}
function locateItem(id){
 for(let gi=0;gi<S.headers.length;gi++){const ii=S.headers[gi].items.findIndex(x=>x.id===id);if(ii>=0)return{gi,ii,header:S.headers[gi],item:S.headers[gi].items[ii]}}
 return null;
}
function readCount(raw,dec){
 raw=String(raw==null?'':raw).trim().replace(/\.$/,'');
 if(raw==='')return null;
 if(!/^\d+(\.\d+)?$/.test(raw))return NaN;
 const n=Number(raw);
 if(!isFinite(n)||n<0)return NaN;
 if(!dec&&!Number.isInteger(n))return NaN;
 return dec?Math.round(n*1000)/1000:n;
}
function nudge(input,dir,dec){
 const cur=readCount(input.value,true);
 let n=Number.isNaN(cur)?null:cur;
 if(n===null){if(dir<0){input.value='';return}n=0}
 n+=dir;if(n<0)n=0;
 if(!dec)n=Math.round(n);else n=Math.round(n*1000)/1000;
 input.value=String(n);
}
function stepHtml(label,id,val,dec){
 const shown=val==null?'':String(val);
 return `<div class="stepRow"><span class="stepLbl">${esc(label)}</span><button type="button" class="stepBtn" data-for="${id}" data-dir="-1" aria-label="Decrease ${esc(label)}">−</button><input id="${id}" class="stepVal" inputmode="${dec?'decimal':'numeric'}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" value="${esc(shown)}" aria-label="${esc(label)}"><button type="button" class="stepBtn" data-for="${id}" data-dir="1" aria-label="Increase ${esc(label)}">+</button></div>`;
}
function openCountSheet(id){
 const loc=locateItem(id);if(!loc||!S.draft)return;
 const d=S.draft;d.counts=d.counts||{};d.counts2=d.counts2||{};d.skipped=d.skipped||{};
 const i=loc.item,dec=itemDecimal(i),lab=itemCount2(i),loc2=itemCount2Loc(i),sk=!!d.skipped[id];
 const c2ui=lab?stepHtml(lab,'shCount2',sk?null:d.counts2[id],dec)+(loc2?`<div class="sheetC2Loc">Location: ${esc(loc2)}</div>`:''):'';
 const back=mountSheet(`<form class="sheet" id="shForm" novalidate role="dialog" aria-modal="true" aria-labelledby="shTitle"><div class="sheetBody"><div class="sheetGrab" aria-hidden="true"></div><h2 id="shTitle">${esc(i.name)}</h2><p class="muted sheetPar">PAR ${esc(i.par)}</p>${stepHtml('Count','shCount',sk?null:d.counts[id],dec)}${c2ui}<div class="sheetLoc">Location: ${esc(loc.header.name)}</div></div><div class="sheetFoot"><button type="button" class="light sheetSkip" id="shSkip">Skip</button><div class="aerr" id="shErr" role="alert"></div><div class="sheetActs"><button type="button" class="light" id="shCancel">Cancel</button><button type="submit" id="shSave">Save</button></div></div></form>`);
 const form=back.querySelector('form');
 const applySkip=on=>{
  const b=form.querySelector('#shSkip');
  b.classList.toggle('skipOn',on);b.setAttribute('aria-pressed',on?'true':'false');b.textContent=on?'Unskip':'Skip';
  form.querySelectorAll('.stepRow').forEach(r=>r.classList.toggle('off',on));
  form.querySelectorAll('.stepBtn,.stepVal').forEach(el=>{el.disabled=on});
 };
 applySkip(sk);
 form.querySelector('#shSkip').onclick=()=>applySkip(form.querySelector('#shSkip').getAttribute('aria-pressed')!=='true');
 form.querySelectorAll('.stepBtn').forEach(b=>b.onclick=()=>nudge(form.querySelector('#'+b.dataset.for),+b.dataset.dir,dec));
 form.querySelector('#shCancel').onclick=()=>closeSheet();
 form.onsubmit=e=>{
  e.preventDefault();
  const err=form.querySelector('#shErr');err.textContent='';
  if(form.querySelector('#shSkip').getAttribute('aria-pressed')==='true'){d.skipped[id]=true;delete d.counts[id];delete d.counts2[id];save();render();return}
  const e1=form.querySelector('#shCount'),e2=form.querySelector('#shCount2');
  const n1=readCount(e1.value,dec),n2=e2?readCount(e2.value,dec):null;
  if(Number.isNaN(n1)||Number.isNaN(n2)){err.textContent=dec?'Enter a number that is 0 or more.':'Enter a whole number, 0 or more.';(Number.isNaN(n1)?e1:e2).focus();return}
  delete d.skipped[id];
  if(n1===null)delete d.counts[id];else d.counts[id]=n1;
  if(lab){if(n2===null)delete d.counts2[id];else d.counts2[id]=n2}else delete d.counts2[id];
  save();render();
 };
 const first=form.querySelector('#shCount');
 setTimeout(()=>{if(first&&!first.disabled)first.focus();else form.querySelector('#shSkip').focus()},0);
}
function openItemSheet(o){
 const isEdit=o.mode==='edit',gi=o.gi,ii=isEdit?o.ii:-1;
 const cur=isEdit?(S.headers[gi]&&S.headers[gi].items[ii]):null;
 if(isEdit&&!cur)return;
 const decOn=isEdit?itemDecimal(cur):false,lab=isEdit?itemCount2(cur):'',loc2=lab?itemCount2Loc(cur):'';
 const opts=S.headers.map((h,n)=>`<option value="${n}"${n===gi?' selected':''}>${esc(h.name)}</option>`).join('');
 const back=mountSheet(`<form class="sheet" id="shItemForm" novalidate role="dialog" aria-modal="true" aria-labelledby="shTitle"><div class="sheetBody"><div class="sheetGrab" aria-hidden="true"></div><h2 id="shTitle">${isEdit?'Edit item':'New item'}</h2><label class="afield">Name<input id="shName" type="text" autocomplete="off" value="${esc(isEdit?cur.name:o.name)}"></label><label class="afield">PAR<input id="shPar" type="number" min="0" inputmode="decimal" placeholder="0" value="${isEdit?esc(cur.par??0):''}"></label><label class="afield">Cost $<input id="shCost" type="text" inputmode="decimal" autocomplete="off" placeholder="optional" value="${isEdit&&hasCost(cur)?esc(cur.cost.toFixed(2)):''}"></label><label class="acheck"><input type="checkbox" id="shDec"${decOn?' checked':''}> Allow decimals</label><p class="muted">Off counts whole units. On allows numbers like 0.5.</p><label class="afield">Location<select id="shLoc">${opts}</select></label><label class="acheck"><input type="checkbox" id="shC2"${lab?' checked':''}> Add a second count</label><div id="shC2wrap"${lab?'':' hidden'}><label class="afield">Second count label<input id="shC2lab" type="text" autocomplete="off" placeholder="bags, cases, trays…" value="${esc(lab)}"></label><label class="afield"><span>Second count location <span class="muted opt">optional</span></span><input id="shC2loc" type="text" autocomplete="off" placeholder="walk-in, back stock…" value="${esc(loc2)}"></label></div><p class="muted" id="shC2note"${lab?'':' hidden'}>The order list uses the main count only.</p></div><div class="sheetFoot"><div class="aerr" id="shErr" role="alert"></div><div class="sheetActs"><button type="button" class="light" id="shCancel">Cancel</button><button type="submit" id="shItemSave">Save</button></div></div></form>`);
 const form=back.querySelector('form');
 const c2=form.querySelector('#shC2'),wrap=form.querySelector('#shC2wrap'),note=form.querySelector('#shC2note'),labI=form.querySelector('#shC2lab'),locI=form.querySelector('#shC2loc'),err=form.querySelector('#shErr');
 form.addEventListener('input',()=>{err.textContent=''});
 const revealC2=()=>requestAnimationFrame(()=>{if(!c2.checked)return;const over=locI.getBoundingClientRect().bottom-form.querySelector('.sheetFoot').getBoundingClientRect().top+8;if(over>0)form.querySelector('.sheetBody').scrollTop+=over});
 c2.onchange=()=>{const on=c2.checked;wrap.hidden=!on;note.hidden=!on;err.textContent='';if(!on){labI.value='';locI.value=''}else{labI.focus();revealC2()}};
 form.querySelector('#shCancel').onclick=()=>closeSheet();
 form.onsubmit=e=>{
  e.preventDefault();
  err.textContent='';
  const nm=form.querySelector('#shName').value.trim();
  if(!nm){err.textContent='Enter a name.';return}
  const parRaw=form.querySelector('#shPar').value.trim();
  const par=parRaw===''?0:Number(parRaw);
  if(!isFinite(par)||par<0){err.textContent='PAR must be a number that is 0 or more.';return}
  const cost=parseCost(form.querySelector('#shCost').value);
  if(Number.isNaN(cost)){err.textContent='Cost must be a dollar amount, like 4.50.';return}
  const allow=form.querySelector('#shDec').checked,want2=c2.checked,label=labI.value.trim(),loc2v=locI.value.trim();
  if(want2&&!label){err.textContent='Name the second count, like bags or cases, or turn it off.';return}
  const toGi=+form.querySelector('#shLoc').value;
  if(!S.headers[toGi]){err.textContent='Choose a location.';return}
  const write=it=>{it.name=nm;it.par=par;it.allowDecimal=allow;if(cost===null)delete it.cost;else it.cost=cost;if(want2){it.count2Label=label;if(loc2v)it.count2Location=loc2v;else delete it.count2Location}else{delete it.count2Label;delete it.count2Location;if(S.draft&&S.draft.counts2)delete S.draft.counts2[it.id]}};
  if(isEdit){
   const now=locateItem(cur.id);if(!now){err.textContent='That item is no longer in the database.';return}
   write(now.item);
   if(toGi!==now.gi){S.headers[now.gi].items.splice(now.ii,1);S.headers[toGi].items.push(now.item)}
  }else{
   const it={id:uid()};
   write(it);
   S.headers[toGi].items.push(it);
  }
  save();render();
 };
 setTimeout(()=>{const p=form.querySelector('#shPar');p.focus();if(isEdit)p.select();revealC2()},30);
}
// INVENTORY
function inventory(){
 if(!S.headers.some(h=>h.items.length)){V.innerHTML=`<div class="card empty">No items yet. Add headers and items in the <b>Database</b> tab.</div>`;return}
 if(!S.draft)S.draft={id:uid(),started:new Date().toISOString(),counts:{},counts2:{}};
 const d=S.draft;d.skipped=d.skipped||{};d.counts=d.counts||{};d.counts2=d.counts2||{};
 let h=`<div class="bar"><div style="flex:1"><b>Count date:</b> <input type="date" id="cdate" value="${d.date||today()}"> <span class="muted">started ${fmt(d.started)}</span></div>
 <button id="saveCount">Save count</button><button class="light" id="newCount">New count</button><span class="muted lastSaved">${lastSavedText()}</span></div>`;
 for(const g of S.headers){if(!g.items.length)continue;
  h+=`<section class="card invSec" data-header="${esc(g.name)}"><h3 class="ghead invSticky">${esc(g.name)}</h3>`;
  for(const i of g.items){
   const sk=!!d.skipped[i.id],c=d.counts[i.id],has=c!=null&&!sk;
   const cls=sk?'skipped':has?'counted':'uncounted';
   const c2lab=itemCount2(i),c2n=d.counts2[i.id],c2loc=c2lab?itemCount2Loc(i):'';
   let stat='';
   if(sk)stat='Skipped';
   else if(has){stat=String(c);if(c2lab&&c2n!=null)stat+=' · '+c2n+' '+c2lab+(c2loc?' · '+c2loc:'')}
   const aria=sk?'Skipped '+i.name:has?i.name+', '+stat:'Count '+i.name;
   const c2quiet=has&&c2lab&&c2n!=null?`<span class="muted invC2">${esc(c2n+' '+c2lab+(c2loc?' · '+c2loc:''))}</span>`:'';
   h+=`<button type="button" class="item invRow ${cls}" data-id="${esc(i.id)}" data-state="${cls}" aria-label="${esc(aria)}"><span class="name">${esc(i.name)}</span><span class="invNums"><span class="invStat">${esc(sk?stat:has?String(c):'')}</span>${c2quiet}</span></button>`}
  h+=`</section>`}
 V.innerHTML=h;
 V.querySelectorAll('.invRow').forEach(b=>b.onclick=()=>openCountSheet(b.dataset.id));
 cdate.onchange=()=>{d.date=cdate.value;save()};
 saveCount.onclick=()=>{const blanks=S.headers.flatMap(g=>g.items).filter(i=>!d.skipped[i.id]&&d.counts[i.id]==null).map(i=>i.name);
  if(blanks.length){const counted=Object.keys(d.counts).length;const list=blanks.slice(0,8).map(n=>'• '+n).join('\n')+(blanks.length>8?`\n+${blanks.length-8} more`:'');
   if(!confirm((counted?'These items have no count:\n':'No counts entered. These items have no count:\n')+list+'\n\nSave anyway?'))return}
  {const dt=d.date||today();const snap={id:d.id,date:dt,savedAt:new Date().toISOString(),groups:freeze(d.counts,d.skipped,d.counts2)};const ix=S.snapshots.findIndex(x=>x.date===dt);if(ix>=0){snap.id=S.snapshots[ix].id;S.snapshots.splice(ix,1)}S.snapshots.push(snap)}S.draft=null;save();tab='orders';render()};
 newCount.onclick=()=>{const has=Object.keys(d.counts).length||Object.keys(d.counts2).length||Object.keys(d.skipped).length;if(has&&!confirm('Discard the unsaved count and start a new one?'))return;S.draft=null;S.ordersClearedAt=new Date().toISOString();save();render();toast('New count started. Order List cleared.')};
}
function lastSavedText(){const t=S.snapshots.map(x=>x.savedAt).filter(Boolean).sort().pop();if(!t)return 'Not saved yet';const d=new Date(t);return 'Last saved '+d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})+', '+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}
function toast(m){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');document.body.appendChild(t)}t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),2600)}
// ORDERS
function orders(){const s=latest();if(s&&S.ordersClearedAt&&S.ordersClearedAt>=s.savedAt){V.innerHTML=`<div class="card empty">New count started. The Order List will fill in when you tap <b>Save count</b>. Earlier order lists are in <b>History</b>.</div>`;return}if(!s){V.innerHTML=`<div class="card empty">No saved counts yet. Do a count in the <b>Inventory</b> tab.</div>`;return}
 V.innerHTML=`<p class="muted">From count on <b>${s.date}</b> (saved ${fmt(s.savedAt)})</p>`+orderHtml(s)}
function orderHtml(s){const L=shortList(s.groups);if(!L.length)return`<div class="card empty">Nothing to order — everything is at or above par. 🎉</div>`;
 return L.map(g=>`<div class="card"><h3>${esc(g.name)}</h3>`+g.items.map(i=>`<div class="item"><div class="name">${esc(i.name)}<div class="muted">have ${i.count} / par ${i.par}</div></div><span class="short">Order ${i.need}</span></div>`).join('')+`</div>`).join('')}
function count2Note(i){const label=String(i&&i.count2Label||'').trim();if(!label||i.count2==null)return '';const loc=itemCount2Loc(i);return ` <span class="muted c2note">· ${esc(i.count2)} ${esc(label)}${loc?` · ${esc(loc)}`:''}</span>`}
function countHtml(s){return s.groups.filter(g=>g.items.length).map(g=>`<div class="card"><h3>${esc(g.name)}</h3>`+g.items.map(i=>{const c=costOf(g.name,i.name);const c2=count2Note(i);return`<div class="item"><div class="name">${esc(i.name)}<div class="muted">PAR ${i.par}</div>${c===null?'':`<div class="muted cCount">cost ${money(c)}</div>`}</div>${i.skipped?'<span class="muted skipTag">Skipped</span>':i.count==null?`<span class="muted">Not counted</span>${c2}`:`<b>${esc(i.count)}</b>${c2}`}</div>`}).join('')+`</div>`).join('')}
// COST (what the shop paid per unit; Database only; used by Overhead + receipts + count detail, never on Order List/Inventory)
const money=n=>'$'+(Math.round(n*100)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const hasCost=i=>i&&typeof i.cost==='number'&&isFinite(i.cost);
function parseCost(v){v=String(v).trim().replace(/[$,\s]/g,'');if(v==='')return null;const n=Number(v);return isFinite(n)&&n>=0?Math.round(n*100)/100:NaN}
function costOf(hn,n){for(const h of S.headers)if(h.name===hn)for(const i of h.items)if(i.name===n&&hasCost(i))return i.cost;return null} // current Database cost, matched by header + item name
// HISTORY: OVERHEAD = what was spent on orders. For each saved count dated in the window, order cost = Σ need × current cost
// (need = the same rounded-up shortfall that count's order list shows). Counts outside the window add nothing; each count once.
const OH_KEY='coffeeInventory.overheadWindow',OH_END_KEY='coffeeInventory.overheadEnd',PRINT_KIND_KEY='coffeeInventory.printKind';
(()=>{for(const[o,n]of[['coffeeInventory.salesWindow',OH_KEY],['coffeeInventory.salesEnd',OH_END_KEY]]){const v=localStorage.getItem(o);if(v!==null){if(localStorage.getItem(n)===null)localStorage.setItem(n,v);localStorage.removeItem(o)}}})(); // migrate old keys
const OH_WINDOWS={weekly:{days:7,label:'Weekly'},biweekly:{days:14,label:'Bi-weekly'},monthly:{days:30,label:'Monthly'},quarterly:{days:90,label:'Quarterly'}};
function ohKind(){const v=localStorage.getItem(OH_KEY);return v==='off'?'off':OH_WINDOWS[v]?v:'weekly'} // 'off' = report hidden (toggle-off); no saved choice = Weekly
function isoLocal(d){return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)}
function ohEnd(){const v=localStorage.getItem(OH_END_KEY);return /^\d{4}-\d{2}-\d{2}$/.test(v||'')&&!isNaN(new Date(v+'T12:00:00'))?v:today()}
function setOhEnd(v){if(/^\d{4}-\d{2}-\d{2}$/.test(v||''))localStorage.setItem(OH_END_KEY,v);else localStorage.removeItem(OH_END_KEY)}
const dayOf=iso=>new Date(iso+'T12:00:00');
const addDays=(iso,n)=>{const d=dayOf(iso);d.setDate(d.getDate()+n);return isoLocal(d)};
function lastSunday(){const t=today();return addDays(t,-dayOf(t).getDay())} // today if today is Sunday
function windowRange(kind){const days=OH_WINDOWS[kind].days;const end=ohEnd();return{start:addDays(end,-(days-1)),end,days}} // N days ending on the picked day
function fmtDay(iso,yr){return dayOf(iso).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',...(yr?{year:'numeric'}:{})})}
function rangeText(r){const y=r.start.slice(0,4)!==r.end.slice(0,4)||r.end.slice(0,4)!==today().slice(0,4);return`${fmtDay(r.start,y)} – ${fmtDay(r.end,y)}`}
function windowText(kind,r){return r.end===today()?`Last ${r.days} days`:`${OH_WINDOWS[kind].label} (${r.days} days)`}
function costGroups(groups){ // [{name,items:[{name,qty,...}]}] -> adds c (current cost|null) and line per item; subtotals; total of costed lines only
 let total=0,missing=0;const out=groups.map(g=>{let sub=0,subN=0;const items=g.items.map(i=>{const c=costOf(g.name,i.name);if(c===null){missing++;return{...i,c:null,line:null}}const line=Math.round(i.qty*c*100)/100;sub+=line;subN++;return{...i,c,line}});
  sub=Math.round(sub*100)/100;total+=sub;return{name:g.name,items,sub,subN}});
 return{groups:out,total:Math.round(total*100)/100,missing}}
function computeOverhead(kind){
 const r=windowRange(kind);const tot={};let counts=0;
 for(const s of S.snapshots){if(!s||!s.date||s.date<r.start||s.date>r.end)continue;counts++;
  for(const g of shortList(s.groups||[]))for(const i of g.items){const m=tot[g.name]||(tot[g.name]={});m[i.name]=(m[i.name]||0)+i.need}}
 const order=[...S.headers.map(h=>h.name)];for(const n of Object.keys(tot))if(!order.includes(n))order.push(n);
 const groups=order.filter(n=>tot[n]).map(n=>({name:n,items:Object.entries(tot[n]).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([name,qty])=>({name,qty}))}));
 return{...r,counts,...costGroups(groups)}}
function ohEmpty(o){if(!S.snapshots.length)return'No saved count yet.';if(!o.counts)return'No saved counts in this window. Try a longer window or another end date.';if(!o.groups.length)return'Nothing was ordered in this window — every count was at or above par.';return''}
function ohWinBtns(kind){return Object.entries(OH_WINDOWS).map(([k,v])=>`<button type="button" class="sm ${k===kind?'on':''}" data-ow="${k}" aria-pressed="${k===kind}">${v.label}</button>`).join('')}
function ohControlsHtml(kind){return`<span class="hsw ohWin">${ohWinBtns(kind)}</span><span class="ohEndBox"><label class="ohEndLbl">Ending <input type="date" class="ohEnd" value="${ohEnd()}" max="${today()}" aria-label="Overhead end date"></label><button type="button" class="light sm" data-oe="sun">Last Sunday</button><button type="button" class="light sm" data-oe="today">Today</button></span>`}
function bindOh(root,canOff){ // canOff: tapping the selected window hides the report (History only, not the print view)
 root.querySelectorAll('.ohWin button').forEach(b=>b.onclick=()=>{localStorage.setItem(OH_KEY,canOff&&b.dataset.ow===ohKind()?'off':b.dataset.ow);render()});
 root.querySelectorAll('input.ohEnd').forEach(i=>i.onchange=()=>{setOhEnd(i.value);render()});
 root.querySelectorAll('[data-oe]').forEach(b=>b.onclick=()=>{setOhEnd(b.dataset.oe==='sun'?lastSunday():today());render()})}
function overheadHtml(){
 if(!S.snapshots.length)return'';
 const kind=ohKind();
 if(kind==='off')return`<section class="overhead ohOff" aria-label="Overhead (off)"><div class="bar ohBar"><b>Overhead</b><span class="hsw ohWin">${ohWinBtns(kind)}</span></div></section><h2 class="histHead">Saved counts</h2>`;
 const o=computeOverhead(kind);const msg=ohEmpty(o);
 const body=msg?`<div class="card empty">${esc(msg)}</div>`:o.groups.map(g=>`<div class="card"><h3 class="ghead">${esc(g.name)}</h3>`+g.items.map(i=>`<div class="item"><div class="name">${esc(i.name)}</div><span class="ohQty">${i.qty} @ ${i.c===null?'—':money(i.c)}</span><b class="ohLine">${i.line===null?'—':money(i.line)}</b></div>`).join('')
  +(g.subN?`<div class="item ohSubRow"><div class="name muted">Subtotal</div><b class="ohSub">${money(g.sub)}</b></div>`:'')+`</div>`).join('')
  +`<div class="card ohTotalCard"><div class="item"><div class="name"><b>Overhead total</b></div><b class="ohTotal">${money(o.total)}</b></div>${o.missing?`<p class="muted ohNote">${o.missing} item${o.missing===1?'':'s'} without a cost ${o.missing===1?"isn't":"aren't"} in the total. Add costs in the <b>Database</b> tab.</p>`:''}<p class="muted ohHow">Order cost of the ${o.counts} saved count${o.counts===1?'':'s'} in this window.</p></div>`;
 return`<section class="overhead" aria-label="Overhead"><div class="bar ohBar"><b>Overhead</b>${ohControlsHtml(kind)}<button type="button" class="light sm ohPrint" id="ohPrint" aria-label="Print overhead">Print overhead</button></div><p class="muted ohRange">${esc(windowText(kind,o)+' · '+rangeText(o))}</p>${body}</section><h2 class="histHead">Saved counts</h2>`}
// PRINT VIEW (typewriter / receipt; @media print prints only .receipt). Two independent prints: To order | Overhead (timeframe).
let pvOpts=false,pvSnap=null; // Options panel collapsed on every open; pvSnap = saved count to print (null = latest)
function printKind(){return localStorage.getItem(PRINT_KIND_KEY)==='overhead'?'overhead':'order'} // remembered; default To order
function enterPrint(k){printMode=true;pvOpts=false;pvSnap=null;if(k)localStorage.setItem(PRINT_KIND_KEY,k);reorderMode=false;document.body.classList.remove('reorder');render();window.scrollTo(0,0)}
function exitPrint(){printMode=false;render();window.scrollTo(0,0)}
const rLines=(g,extra)=>g.items.map(i=>`<div class="rOLine"><span class="rName">${esc(i.name)}</span><span class="rDots"></span><span class="rNeed">${i.qty}</span></div>${extra?extra(i):''}<div class="rOCost"><span class="rOEach">${i.qty} @ ${i.c===null?'—':money(i.c)}</span><span class="rDots"></span><span class="rOTot">${i.line===null?'—':money(i.line)}</span></div>`).join('');
const rSub=g=>g.subN?`<div class="rOCost rSubLine"><span>Subtotal</span><span class="rDots"></span><span class="rOSub">${money(g.sub)}</span></div>`:'';
function printSnap(){return(pvSnap&&S.snapshots.find(x=>x.id===pvSnap))||latest()}
function orderReceiptHtml(){ // To order print: one saved count's order list (default latest) with cost on the receipt only
 const s=printSnap();let body;
 if(!s)body=`<p class="rEmpty">No saved count yet. Count on the Inventory tab, then tap Save count.</p>`;
 else{const L=shortList(s.groups).map(g=>({name:g.name,items:g.items.map(i=>({...i,qty:i.need}))}));
  body=`<div class="rRange">From count ${esc(fmtDay(s.date))}</div><div class="rRule thin"></div>`;
  if(!L.length)body+=`<p class="rEmpty">Nothing to order — everything is at or above par.</p>`;
  else{const M=costGroups(L);
   body+=M.groups.map(g=>`<div class="rOGroup"><div class="rHead">${esc(g.name)}</div>`+rLines(g,i=>`<div class="rOInfo">have ${i.count} / par ${i.par}</div>`)+rSub(g)+`</div>`).join('')
    +`<div class="rRule"></div><div class="rOLine rGrandLine"><span class="rName">ORDER TOTAL</span><span class="rDots"></span><span class="rOrderTotal">${money(M.total)}</span></div>${M.missing?`<div class="rNote">* Items without a cost (—) aren't in the order total.</div>`:''}`}}
 return`<section class="rOrder" aria-label="Order list"><div class="rRule"></div><h2 class="rHeading">To order</h2>${body}</section>`}
function overheadReceiptHtml(){ // Overhead print: the History Overhead report for the chosen window + end date
 const kind=ohKind()==='off'?'weekly':ohKind();const o=computeOverhead(kind);const msg=ohEmpty(o);
 const body=msg?`<p class="rEmpty">${esc(msg)}</p>`:o.groups.map(g=>`<div class="rOGroup"><div class="rHead">${esc(g.name)}</div>`+rLines(g)+rSub(g)+`</div>`).join('')
  +`<div class="rRule"></div><div class="rOLine rGrandLine"><span class="rName">OVERHEAD TOTAL</span><span class="rDots"></span><span class="rOhTotal">${money(o.total)}</span></div>${o.missing?`<div class="rNote">* Items without a cost (—) aren't in the overhead total.</div>`:''}`;
 return`<section class="rOh" aria-label="Overhead"><div class="rRule"></div><h2 class="rHeading">Overhead</h2><div class="rRange">${esc(rangeText(o))}</div><div class="rWin">${esc(OH_WINDOWS[kind].label)} · ${o.days} days</div><div class="rRule thin"></div>${body}${msg?'':`<div class="rFoot rOhFoot">Order cost of ${o.counts} saved count${o.counts===1?'':'s'} in this range.</div>`}</section>`}
function printView(){try{printViewInner()}catch(e){ // never leave a blank page: show what went wrong
 console.error(e);document.getElementById('printView').innerHTML=`<div class="pvCtl"><div class="pvBtns"><button type="button" class="light" id="pvBack">← Back</button></div></div><article class="receipt"><div class="rTitle">Sullivan Taylor Uptown</div><p class="rEmpty">Couldn’t build the print view: ${esc(e&&e.message||e)}</p></article>`;pvBack.onclick=exitPrint}}
function printViewInner(){
 const P=document.getElementById('printView');const pk=printKind();
 const hasOpts=pk==='overhead'?S.snapshots.length>0:S.snapshots.length>1;
 const sel=printSnap();
 const opts=pk==='overhead'?`<div class="bar ohBar pvOh">${ohControlsHtml(ohKind()==='off'?'weekly':ohKind())}</div>`
  :`<label class="pvSnapLbl">Count to print <select id="pvSnapSel" aria-label="Saved count to print">${[...S.snapshots].reverse().map(s=>`<option value="${esc(s.id)}" ${sel&&s.id===sel.id?'selected':''}>${esc(fmtDay(s.date,true))}</option>`).join('')}</select></label>`;
 const now=new Date();
 P.innerHTML=`<div class="pvCtl noprint"><div class="pvBtns"><button type="button" class="light" id="pvBack" aria-label="Exit print view">← Back</button><button type="button" id="pvPrint" aria-label="Print">Print…</button>${hasOpts?`<button type="button" class="light pvOptsBtn" id="pvOptsBtn" aria-expanded="${pvOpts}" aria-controls="pvOpts">Options <span class="pvCaret" aria-hidden="true">${pvOpts?'▾':'▸'}</span></button>`:''}</div>
 <div class="pvKind" role="radiogroup" aria-label="What to print"><button type="button" role="radio" data-pk="order" aria-checked="${pk==='order'}" class="${pk==='order'?'on':''}">To order</button><button type="button" role="radio" data-pk="overhead" aria-checked="${pk==='overhead'}" class="${pk==='overhead'?'on':''}">Overhead (timeframe)</button></div>
 ${hasOpts?`<div id="pvOpts" class="pvOpts" ${pvOpts?'':'hidden'}>${opts}</div>`:''}</div>
 <article class="receipt" data-kind="${pk}" aria-label="${pk==='order'?'Printable order list':'Printable overhead'}">
 <div class="rTitle">Sullivan Taylor Uptown</div>
 ${pk==='order'?orderReceiptHtml():overheadReceiptHtml()}
 <div class="rRule"></div><div class="rFoot">Printed ${esc(now.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}))} ${esc(now.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}))}</div></article>`;
 pvBack.onclick=exitPrint;pvPrint.onclick=()=>window.print();
 const ob=document.getElementById('pvOptsBtn');if(ob)ob.onclick=()=>{pvOpts=!pvOpts;render()};
 P.querySelectorAll('[data-pk]').forEach(b=>b.onclick=()=>{if(b.dataset.pk!==pk){localStorage.setItem(PRINT_KIND_KEY,b.dataset.pk);pvOpts=false;render()}});
 const ss=document.getElementById('pvSnapSel');if(ss)ss.onchange=()=>{pvSnap=ss.value;render()};
 bindOh(P,false)}
function historyTab(){ // (not named "history": that would hide the browser's window.history)
 if(histSel){const s=S.snapshots.find(x=>x.id===histSel);
  V.innerHTML=`<div class="bar"><button class="light" id="back">← All counts</button><b style="flex:1">Count of ${s.date}</b><button class="danger sm" id="delSnap">Delete</button></div>
  <div class="split"><section><h2>Count</h2>${countHtml(s)}</section><section><h2>Order list</h2>${orderHtml(s)}</section></div>`;
  back.onclick=()=>{histSel=null;render()};delSnap.onclick=()=>{if(confirm('Delete this count from history?')){S.snapshots=S.snapshots.filter(x=>x.id!==s.id);save();histSel=null;render()}};return}
 let h=overheadHtml();
 if(!S.snapshots.length)V.innerHTML=h+`<div class="card empty">No history yet.</div>`;
 else{V.innerHTML=h+[...S.snapshots].reverse().map(s=>{const n=shortList(s.groups).reduce((a,g)=>a+g.items.length,0);
  return`<button class="hist" data-id="${esc(s.id)}" aria-label="Open count of ${esc(s.date)}"><span><b>${s.date}</b> <span class="muted">${fmt(s.savedAt)}</span></span><span class="histR">${n?`<span class="badge">${n} to order</span>`:'all good'}<span class="histGo" aria-hidden="true">›</span></span></button>`}).join('');
  V.querySelectorAll('.hist').forEach(b=>b.onclick=()=>{histSel=b.dataset.id;render()})}
 bindOh(V,true);const op=document.getElementById('ohPrint');if(op)op.onclick=()=>enterPrint('overhead');
}
// DATABASE
function database(){
 document.body.classList.toggle('reorder',reorderMode);
 let h=`<div class="bar"><button id="addH">+ Add header</button><button id="reorderBtn" class="light sm reorderBtn${reorderMode?' on':''}" aria-pressed="${reorderMode}">${reorderMode?'Done':'Reorder'}</button><span style="flex:1"></span><span class="hsw muted">Header style: <button class="sm ${hsOn('border')?'on':''}" data-hs="border" aria-pressed="${hsOn('border')}">Border</button><button class="sm ${hsOn('tint')?'on':''}" data-hs="tint" aria-pressed="${hsOn('tint')}">Tint</button></span></div>`;
 if(!S.headers.length)h+=`<div class="card empty">Database is empty. Tap <b>+ Add header</b> to create a category like “Coffee”.</div>`;
 S.headers.forEach((g,gi)=>{h+=`<div class="card"><div class="hrow ghead"><input type="text" class="nm hname" data-g="${gi}" value="${esc(g.name)}" aria-label="header name">
  <button class="sm addI" data-g="${gi}">+ Add item</button><button class="light sm mvH" data-g="${gi}" data-d="-1" aria-label="move up">↑</button><button class="light sm mvH" data-g="${gi}" data-d="1" aria-label="move down">↓</button><button class="danger sm delH" data-g="${gi}" aria-label="delete header">✕</button></div>`;
  g.items.forEach((i,ii)=>{const c2=itemCount2(i),c2loc=c2?itemCount2Loc(i):'';h+=`<div class="item dbItem"><div class="dbName"><input type="text" class="nm iname" data-g="${gi}" data-i="${ii}" value="${esc(i.name)}" aria-label="item name">${c2?`<div class="muted dbC2">Also count ${esc(c2)}${c2loc?` · ${esc(c2loc)}`:''}</div>`:''}</div><label class="muted">PAR <input type="number" min="0" class="ipar" data-g="${gi}" data-i="${ii}" value="${i.par}"></label><label class="muted icostL">Cost $<input type="text" inputmode="decimal" class="icost" data-g="${gi}" data-i="${ii}" value="${hasCost(i)?i.cost.toFixed(2):''}" placeholder="cost" aria-label="cost per unit ${esc(i.name)}"></label><button type="button" class="light sm dbEdit" data-g="${gi}" data-i="${ii}" aria-label="Edit ${esc(i.name)}">Edit</button><button class="light sm mvI" data-g="${gi}" data-i="${ii}" data-d="-1" aria-label="move item up">↑</button><button class="light sm mvI" data-g="${gi}" data-i="${ii}" data-d="1" aria-label="move item down">↓</button><button class="danger sm delI" data-g="${gi}" data-i="${ii}">✕</button></div>`});
  if(!g.items.length)h+=`<div class="muted" style="padding:8px 0">No items yet.</div>`;h+=`</div>`});
 V.innerHTML=h;const q=s=>V.querySelectorAll(s);
 q('.hsw button').forEach(b=>b.onclick=()=>{const k=b.dataset.hs;const set=HS.split(' ').filter(x=>x&&x!==k);if(!hsOn(k))set.push(k);HS=set.sort().join(' ');localStorage.setItem('coffeeInventory.headerStyle',HS);document.body.dataset.hs=HS;render()});
 addH.onclick=()=>{const n=prompt('Header name (e.g. Coffee, Non-food):');if(n&&n.trim()){S.headers.push({id:uid(),name:n.trim(),items:[]});save();render()}};
 q('.addI').forEach(b=>b.onclick=()=>{const gi=+b.dataset.g,g=S.headers[gi];const n=prompt(`New item under “${g.name}”:`);if(!n||!n.trim())return;openItemSheet({mode:'add',gi,name:n.trim()})});
 q('.dbEdit').forEach(b=>b.onclick=()=>openItemSheet({mode:'edit',gi:+b.dataset.g,ii:+b.dataset.i}));
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
// header buttons
printBtn.onclick=()=>printMode?exitPrint():enterPrint();
logoutBtn.addEventListener('click',()=>{printMode=false;document.body.classList.remove('printView')});
// initial render is done by auth.js after sign-in
