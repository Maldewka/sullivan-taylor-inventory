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
// On-hand for ordering is the primary count plus the second count. count2Label is a name only
// (a place, bags, cases). A blank side counts as 0 when the other side has a number.
// Both blank, or a skipped item, is not counted.
// A pack (unitsPerCase + unitName + reorderBelow) is optional. The count is still entered in
// the small unit (sleeves). On-hand cases = that sum / unitsPerCase. The order list uses the
// reorder point, and the quantity is PAR minus on-hand, rounded up to whole cases.
// Cost stays the case price. Items and saved counts without a complete pack keep the plain
// PAR comparison, so older data is unchanged.
// location is where the item sits in the store. count2Location is the place for the second count.
// vendor is the optional supplier. All three are optional free text. None is a catalog header.
// Missing or blank means none. A leftover halfStep on an old item is ignored.
function freeze(counts,skipped={},counts2={}){return S.headers.map(h=>({name:h.name,items:h.items.map(i=>{
 const label=String(i.count2Label||'').trim();
 const loc2=itemCount2Loc(i),place=itemLoc(i),vend=itemVendor(i),pack=packOf(i);
 const stamp=row=>{if(place)row.location=place;if(vend)row.vendor=vend;if(label){row.count2Label=label;if(loc2)row.count2Location=loc2}if(pack){row.unitsPerCase=pack.units;row.unitName=pack.unit;row.reorderBelow=pack.below}return row};
 if(skipped[i.id])return stamp({name:i.name,par:i.par,count:null,skipped:true});
 const row=stamp({name:i.name,par:i.par,count:counts[i.id]??null});
 if(label)row.count2=counts2[i.id]??null;
 return row})}))}
function orderNeed(par,count){return Math.ceil(+(par-count).toFixed(6))} // same shortfall the Order List and Overhead use
function qtyNum(v){if(typeof v==='number')return isFinite(v)?v:null;if(v==null||v==='')return null;const n=Number(v);return isFinite(n)?n:null}
function onHandOf(i){ // null = not counted. Otherwise primary + second, with one blank side treated as 0.
 if(!i||i.skipped)return null;
 const secondLabel=String(i.count2Label||'').trim();
 const primary=qtyNum(i.count),second=secondLabel?qtyNum(i.count2):null;
 if(primary==null&&second==null)return null;
 return Math.round(((primary==null?0:primary)+(second==null?0:second))*1000)/1000;
}
// A pack is set only when all three pieces are usable. Anything else is a normal item.
function packOf(i){
 if(!i)return null;
 const units=qtyNum(i.unitsPerCase),below=qtyNum(i.reorderBelow);
 const unit=typeof i.unitName==='string'?i.unitName.trim():'';
 if(units==null||!(units>0)||below==null||below<0||!unit)return null;
 return {units,unit,below};
}
function fmtNum(n){return String(Math.round(n*1000)/1000)}
function fmtCases(n){return String(Math.round(n*100)/100)}
function caseWord(n){const r=Math.round(Math.abs(n)*100)/100;return r>0&&r<=1?'case':'cases'}
function fmtCaseQty(n){return fmtCases(n)+' '+caseWord(n)}
function orderMath(row){ // null = not counted. listed = it belongs on the Order List.
 const units=onHandOf(row);
 if(units==null)return null;
 const pack=packOf(row);
 if(!pack){
  const listed=units<row.par;
  return {pack:null,units,haveShown:units,need:listed?orderNeed(row.par,units):0,listed,eq:''};
 }
 const cases=units/pack.units,rawNeed=orderNeed(row.par,cases),listed=cases<pack.below&&rawNeed>0;
 return {pack,units,cases,haveShown:Math.round(cases*100)/100,need:listed?rawNeed:0,listed,eq:fmtNum(units)+' '+pack.unit+' = '+fmtCaseQty(cases)};
}
function shortList(groups){return (groups||[]).map(g=>({name:g.name,items:(g.items||[]).filter(i=>{const m=orderMath(i);return !!m&&m.listed}).map(i=>{const m=orderMath(i);return {...i,have:m.haveShown,need:m.need}})})).filter(g=>g.items.length)}
function orderHaveText(i){const pack=packOf(i);return pack?`Have ${fmtCaseQty(i.have)}, par ${fmtCaseQty(i.par)}`:`Have ${i.have}, par ${i.par}`}
function orderInfoText(i){const pack=packOf(i);return pack?`have ${fmtCaseQty(i.have)} / par ${fmtCaseQty(i.par)}`:`have ${i.have} / par ${i.par}`}
function fmtReorder(n){return String(Math.round(Number(n)*1000)/1000)} // 0.50 -> 0.5, 1.0 -> 1
function reorderHtml(pack){return pack?`<span class="reordAt">reorder @ ${esc(fmtReorder(pack.below))}</span>`:''}
function latest(){return S.snapshots[S.snapshots.length-1]}
// allowDecimal false = whole units. Missing keeps the old decimal number-input behavior.
// count2Label empty/missing = a single count. A label does not change the unit; ordering adds the numbers.
// location, count2Location, and vendor are optional free text. Non-strings and blanks are unset so older items load cleanly.
// Steppers always move by 1. A fraction slider, only for decimal items, edits the tenths.
const itemDecimal=i=>!i||i.allowDecimal!==false;
const itemCount2=i=>String(i&&i.count2Label||'').trim();
const itemLoc=i=>{const v=i&&i.location;return typeof v==='string'?v.trim():''};
const itemCount2Loc=i=>{const v=i&&i.count2Location;return typeof v==='string'?v.trim():''};
const itemVendor=i=>{const v=i&&i.vendor;return typeof v==='string'?v.trim():''};
// Order List prefers the vendor currently saved on the matching Database item, so a correction shows up
// before the next count. A line whose item is gone keeps the vendor stored on that saved count.
function vendorForLine(groupName,snapItem){
 for(const h of S.headers)if(h.name===groupName)for(const it of h.items||[])if(it.name===snapItem.name)return itemVendor(it);
 return itemVendor(snapItem);
}
function uniqueSorted(vals){
 const seen=new Map();
 for(const v of vals){if(typeof v!=='string')continue;const t=v.trim();if(!t)continue;const k=t.toLowerCase();if(!seen.has(k))seen.set(k,t)}
 return [...seen.values()].sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base',numeric:true}));
}
// Saved place names: location and count2Location, trimmed, blanks dropped,
// case-insensitive duplicates collapsed to the first spelling, then A–Z.
function locationChoices(){
 const vals=[];
 for(const h of S.headers)for(const it of h.items||[]){vals.push(it.location);vals.push(it.count2Location)}
 return uniqueSorted(vals);
}
// Previously used vendor names, same rules as places. Locations are not vendors.
function vendorChoices(){
 const vals=[];
 for(const h of S.headers)for(const it of h.items||[])vals.push(it.vendor);
 return uniqueSorted(vals);
}
function bindSuggest(input,choicesFn){
 const list=document.createElement('div');list.className='suggestList';list.hidden=true;list.setAttribute('role','listbox');
 input.insertAdjacentElement('afterend',list);
 input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls',input.id+'List');
 list.id=input.id+'List';
 let hi=-1,base='';
 const close=()=>{list.hidden=true;list.innerHTML='';hi=-1;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant')};
 const hits=()=>{
  const q=input.value.trim().toLowerCase(),all=choicesFn();
  if(q===base)return all.filter(s=>s.toLowerCase()!==q); // focused text unchanged: the other saved names
  return all.filter(s=>{const k=s.toLowerCase();return k!==q&&k.includes(q)});
 };
 const paint=()=>{
  const rows=hits();
  if(!rows.length){close();return}
  if(hi>=rows.length)hi=-1;
  list.hidden=false;input.setAttribute('aria-expanded','true');
  list.innerHTML=rows.map((s,n)=>`<button type="button" role="option" id="${input.id}o${n}" aria-selected="${n===hi?'true':'false'}">${esc(s)}</button>`).join('');
  if(hi>=0)input.setAttribute('aria-activedescendant',input.id+'o'+hi);else input.removeAttribute('aria-activedescendant');
  requestAnimationFrame(()=>{
   const body=input.closest('.sheetBody');if(!body)return;
   const sheet=input.closest('.sheet'),foot=sheet&&sheet.querySelector('.sheetFoot');
   const vv=window.visualViewport;
   const viewBottom=(vv?vv.offsetTop+vv.height:window.innerHeight)-8;
   const limit=foot?Math.min(foot.getBoundingClientRect().top-8,viewBottom):viewBottom;
   const over=list.getBoundingClientRect().bottom-limit;
   if(over>0)body.scrollTop+=over;
  });
 };
 const pick=s=>{input.value=s;close();input.dispatchEvent(new Event('input',{bubbles:true}));input.focus()};
 input.addEventListener('focus',()=>{base=input.value.trim().toLowerCase();hi=-1;paint()});
 input.addEventListener('input',()=>{hi=-1;paint()});
 input.addEventListener('keydown',e=>{
  if(list.hidden)return;
  const n=list.children.length;
  if(e.key==='ArrowDown'){e.preventDefault();hi=hi<0?0:(hi+1)%n;paint()}
  else if(e.key==='ArrowUp'){e.preventDefault();hi=hi<0?n-1:(hi-1+n)%n;paint()}
  else if(e.key==='Enter'&&hi>=0){e.preventDefault();pick(list.children[hi].textContent)}
  else if(e.key==='Escape'){e.stopPropagation();e.preventDefault();close()}
 });
 list.addEventListener('pointerdown',e=>{const b=e.target.closest('button');if(!b)return;e.preventDefault();pick(b.textContent)});
 input.addEventListener('blur',()=>setTimeout(()=>{if(document.activeElement!==input&&!list.contains(document.activeElement))close()},160));
}
function bindLocSuggest(input){bindSuggest(input,locationChoices)}
function bindVendorSuggest(input){bindSuggest(input,vendorChoices)}
let onSheetKey=null;
function closeSheet(){
 const el=document.getElementById('sheetBack');if(el)el.remove();
 document.body.classList.remove('sheetOpen','fracDrag');
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
function nudge(input,dir,dec,step){
 const cur=readCount(input.value,true);
 let n=Number.isNaN(cur)?null:cur;
 if(n===null){if(dir<0){input.value='';return}n=0}
 n+=dir*(step||1);if(n<0)n=0;
 if(!dec)n=Math.round(n);else n=Math.round(n*1000)/1000;
 input.value=String(n);
}
function stepHtml(label,id,val,dec){
 const shown=val==null?'':String(val);
 return `<div class="stepRow"><span class="stepLbl">${esc(label)}</span><button type="button" class="stepBtn" data-for="${id}" data-dir="-1" aria-label="Decrease ${esc(label)}">−</button><input id="${id}" class="stepVal" inputmode="${dec?'decimal':'numeric'}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" value="${esc(shown)}" aria-label="${esc(label)}"><button type="button" class="stepBtn" data-for="${id}" data-dir="1" aria-label="Increase ${esc(label)}">+</button></div>`;
}
function fracHtml(id,label){
 return `<div class="fracBar" id="${id}" role="slider" tabindex="0" aria-orientation="horizontal" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="1" aria-valuestep="0.1" aria-valuenow="0.5"><div class="fracFill"></div><div class="fracMid" aria-hidden="true"></div><div class="fracRead">0.5</div></div>`;
}
function bindFrac(bar,input,onChange){ // one fraction slider for one count field; parked at 0.5 when that count is whole
 const noop={paint(){},reset(){},abort(){}};
 if(!bar||!input)return noop;
 let shown=null,drag=null;
 const fill=bar.querySelector('.fracFill'),read=bar.querySelector('.fracRead');
 const fracPart=n=>{if(n==null||Number.isNaN(n))return 0;const whole=Math.floor(n+1e-9);let f=Math.round((n-whole)*10)/10;return f>0&&f<1?f:0};
 const paint=()=>{
  const raw=readCount(input.value,true);
  const blank=raw==null||Number.isNaN(raw);
  const actual=blank?0:fracPart(raw);
  const parked=shown==null&&(blank||actual===0);
  const display=shown==null?(parked?0.5:actual):shown;
  const clamped=Math.min(1,Math.max(0,Math.round(display*10)/10));
  fill.style.width=(clamped*100)+'%';
  read.textContent=clamped.toFixed(1);
  bar.setAttribute('aria-valuenow',clamped.toFixed(1));
  bar.classList.toggle('parked',parked);
  if(parked)bar.setAttribute('aria-valuetext','Inactive. Tap to add one half.');
  else bar.removeAttribute('aria-valuetext');
 };
 const changed=()=>{paint();if(onChange)onChange()};
 const applyFrac=(base,frac)=>{
  const whole=frac===0||frac===1;
  shown=whole?null:frac;
  let n=Math.round((base+frac)*10)/10;if(n<0)n=0;
  input.value=String(n);
  if(whole&&drag){drag.parked=true;drag.moved=true}
  changed();
 };
 const fromX=x=>{const r=bar.getBoundingClientRect();const w=r.width||1;let t=(x-r.left)/w;if(t<0)t=0;if(t>1)t=1;return Math.round(t*10)/10};
 const baseOf=()=>{const raw=readCount(input.value,true);return (raw==null||Number.isNaN(raw))?0:Math.floor(raw+1e-9)};
 const resting=()=>{const raw=readCount(input.value,true);return raw==null||Number.isNaN(raw)||fracPart(raw)===0};
 bar.addEventListener('pointerdown',e=>{
  if(bar.classList.contains('off'))return;
  if(e.pointerType==='mouse'&&e.button!==0)return;
  e.preventDefault();e.stopPropagation();
  drag={id:e.pointerId,base:baseOf(),x:e.clientX,y:e.clientY,parked:resting(),moved:false};
  document.body.classList.add('fracDrag');
  try{bar.setPointerCapture(e.pointerId)}catch{}
  if(!drag.parked)applyFrac(drag.base,fromX(e.clientX));
 });
 bar.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  e.preventDefault();
  if(drag.parked){if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>12)drag.moved=true;return}
  applyFrac(drag.base,fromX(e.clientX));
 });
 const up=e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const tap=drag.parked&&!drag.moved;
  drag=null;shown=null;document.body.classList.remove('fracDrag');
  if(tap){const raw=readCount(input.value,true);const base=(raw==null||Number.isNaN(raw))?0:raw;let n=Math.round((base+0.5)*10)/10;if(n<0)n=0;input.value=String(n)}
  changed();
 };
 bar.addEventListener('pointerup',up);
 bar.addEventListener('pointercancel',e=>{if(!drag||e.pointerId!==drag.id)return;drag=null;shown=null;document.body.classList.remove('fracDrag');paint()});
 bar.addEventListener('touchmove',e=>{if(drag)e.preventDefault()},{passive:false});
 bar.addEventListener('keydown',e=>{
  if(bar.classList.contains('off'))return;
  const raw=readCount(input.value,true);
  const blank=raw==null||Number.isNaN(raw);
  const n=blank?0:raw;
  if(blank||fracPart(n)===0){
   if(e.key==='ArrowRight'||e.key==='ArrowUp'||e.key==='End'){e.preventDefault();input.value=String(Math.round((n+0.5)*10)/10);shown=null;changed()}
   else if(e.key==='ArrowLeft'||e.key==='ArrowDown'||e.key==='Home')e.preventDefault();
   return;
  }
  const base=Math.floor(n+1e-9);
  let f=fracPart(n);
  if(e.key==='ArrowRight'||e.key==='ArrowUp')f=Math.min(1,Math.round((f+0.1)*10)/10);
  else if(e.key==='ArrowLeft'||e.key==='ArrowDown')f=Math.max(0,Math.round((f-0.1)*10)/10);
  else if(e.key==='Home')f=0;
  else if(e.key==='End')f=1;
  else return;
  e.preventDefault();
  shown=null;applyFrac(base,f);shown=null;changed();
 });
 return {paint,reset(){shown=null},abort(){drag=null;shown=null;document.body.classList.remove('fracDrag')}};
}
function openCountSheet(id){
 const loc=locateItem(id);if(!loc||!S.draft)return;
 const d=S.draft;d.counts=d.counts||{};d.counts2=d.counts2||{};d.skipped=d.skipped||{};
 const i=loc.item,dec=itemDecimal(i),lab=itemCount2(i),loc2=itemCount2Loc(i),place=itemLoc(i),sk=!!d.skipped[id],pack=packOf(i);
 const c2frac=dec&&lab?fracHtml('shFrac2','Fractional part of the second count'):'';
 const c2step=lab?stepHtml(lab,'shCount2',sk?null:d.counts2[id],dec)+c2frac:'';
 const c2locUi=lab&&loc2?`<div class="sheetC2Loc">Location: ${esc(loc2)}</div>`:'';
 const placeUi=place?`<div class="sheetLoc">Location: ${esc(place)}</div>`:'';
 const eqUi=pack?`<p class="packEq" id="shPackEq" aria-live="polite"></p>`:'';
 const parLine=pack?`Par ${fmtCaseQty(i.par)}`:`Par ${i.par}`;
 const countLbl=pack?pack.unit:'Count';
 // Fraction bars are only for decimal items. A whole count leaves its own bar dimmed at 0.5 until a tap adds a half.
 const fracUi=dec?fracHtml('shFrac','Fractional part of the count'):'';
 const back=mountSheet(`<form class="sheet" id="shForm" novalidate role="dialog" aria-modal="true" aria-labelledby="shTitle"><div class="sheetBody"><div class="sheetGrab" aria-hidden="true"></div><h2 id="shTitle">${esc(i.name)}</h2><p class="muted sheetPar">${esc(parLine)}${reorderHtml(pack)}</p>${stepHtml(countLbl,'shCount',sk?null:d.counts[id],dec)}${fracUi}${c2step}${eqUi}${c2locUi}${placeUi}</div><div class="sheetFoot"><div class="sheetStrip" aria-live="polite"><span id="shOnHand">On hand: —</span><span id="shOrder">Order —</span></div><button type="button" class="light sheetSkip" id="shSkip">Skip</button><div class="aerr" id="shErr" role="alert"></div><div class="sheetActs"><button type="button" class="light" id="shCancel">Cancel</button><button type="submit" id="shSave">Save</button></div></div></form>`);
 const form=back.querySelector('form');
 const countEl=form.querySelector('#shCount');
 const c2el=form.querySelector('#shCount2');
 const paintStrip=()=>{
  const skipOn=form.querySelector('#shSkip').getAttribute('aria-pressed')==='true';
  const raw=readCount(countEl.value,dec);
  const raw2=c2el?readCount(c2el.value,dec):null;
  const hand=form.querySelector('#shOnHand'),ord=form.querySelector('#shOrder');
  const eq=form.querySelector('#shPackEq');
  const blank=()=>{hand.textContent='On hand: —';ord.textContent='Order —';if(eq)eq.textContent=pack?'— '+pack.unit+' = —':'';};
  if(skipOn||Number.isNaN(raw)||Number.isNaN(raw2)){blank();return}
  const m=orderMath({...i,count:raw,count2:raw2,count2Label:lab,skipped:false});
  if(!m){blank();return}
  if(m.pack){hand.textContent='On hand: '+fmtCaseQty(m.cases);ord.textContent=m.need>0?'Order '+m.need+' '+caseWord(m.need):'Order 0';if(eq)eq.textContent=m.eq;return}
  hand.textContent='On hand: '+String(m.haveShown);
  ord.textContent='Order '+m.need;
 };
 const applySkip=on=>{
  const b=form.querySelector('#shSkip');
  b.classList.toggle('skipOn',on);b.setAttribute('aria-pressed',on?'true':'false');b.textContent=on?'Unskip':'Skip';
  form.querySelectorAll('.stepRow').forEach(r=>r.classList.toggle('off',on));
  form.querySelectorAll('.stepBtn,.stepVal').forEach(el=>{el.disabled=on});
  form.querySelectorAll('.fracBar').forEach(el=>{el.classList.toggle('off',on);if(on)el.setAttribute('aria-disabled','true');else el.removeAttribute('aria-disabled')});
  if(on){fracs.forEach(f=>f.abort());document.body.classList.remove('fracDrag')}
  paintStrip();
 };
 const frac1=bindFrac(form.querySelector('#shFrac'),countEl,paintStrip);
 const frac2=bindFrac(form.querySelector('#shFrac2'),c2el,paintStrip);
 const fracs=[frac1,frac2];
 applySkip(sk);
 form.querySelector('#shSkip').onclick=()=>{applySkip(form.querySelector('#shSkip').getAttribute('aria-pressed')!=='true');fracs.forEach(f=>f.paint())};
 form.querySelectorAll('.stepBtn').forEach(b=>b.onclick=()=>{
  nudge(form.querySelector('#'+b.dataset.for),+b.dataset.dir,dec,1); // always one whole unit; a leftover halfStep is ignored
  const frac=b.dataset.for==='shCount2'?frac2:frac1;
  frac.reset();frac.paint();paintStrip();
 });
 countEl.addEventListener('input',()=>{frac1.reset();frac1.paint();paintStrip()});
 if(c2el)c2el.addEventListener('input',()=>{frac2.reset();frac2.paint();paintStrip()});
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
 fracs.forEach(f=>f.paint());
 const first=countEl;
 setTimeout(()=>{if(first&&!first.disabled)first.focus();else form.querySelector('#shSkip').focus()},0);
}
function openItemSheet(o){
 const isEdit=o.mode==='edit',gi=o.gi,ii=isEdit?o.ii:-1;
 const cur=isEdit?(S.headers[gi]&&S.headers[gi].items[ii]):null;
 if(isEdit&&!cur)return;
 const decOn=isEdit?itemDecimal(cur):false,lab=isEdit?itemCount2(cur):'',loc2=lab?itemCount2Loc(cur):'';
 const place=isEdit?itemLoc(cur):''; // older items have no location; the box stays blank
 const vend=isEdit?itemVendor(cur):''; // older items have no vendor; the box stays blank
 const pack=isEdit?packOf(cur):null;
 const packUnits=pack?String(pack.units):'';
 const packUnit=pack?pack.unit:'';
 const packBelow=pack?String(pack.below):'';
 const opts=S.headers.map((h,n)=>`<option value="${n}"${n===gi?' selected':''}>${esc(h.name)}</option>`).join('');
 const back=mountSheet(`<form class="sheet" id="shItemForm" novalidate role="dialog" aria-modal="true" aria-labelledby="shTitle"><div class="sheetBody"><div class="sheetGrab" aria-hidden="true"></div><h2 id="shTitle">${isEdit?'Edit item':'New item'}</h2><section class="fieldGroup" aria-label="Basics"><h3 class="fieldHead">Basics</h3><label class="fieldRow z0"><span class="fieldLbl">Name</span><input id="shName" type="text" autocomplete="off" value="${esc(isEdit?cur.name:o.name)}"></label><label class="fieldRow z1"><span class="fieldLbl">Category</span><span class="fieldHelp">The section this item is listed under.</span><select id="shCat">${opts}</select></label><label class="fieldRow z0"><span class="fieldLbl">PAR</span><span class="fieldHelp" id="shParHelp">${pack?'How many cases to keep on hand.':'How many to keep on hand.'}</span><span class="reordAt" id="shParReord"${pack?'':` hidden`}>${pack?`reorder @ ${esc(fmtReorder(pack.below))}`:''}</span><input id="shPar" type="number" min="0" inputmode="decimal" placeholder="0" value="${isEdit?esc(cur.par??0):''}"></label></section><section class="fieldGroup" aria-label="Pack"><h3 class="fieldHead">Pack</h3><label class="fieldRow z1 isCheck"><input type="checkbox" id="shPack"${pack?' checked':''}><span class="checkCopy"><span class="fieldLbl">Comes in a case</span><span class="fieldHelp">Optional. Count the pieces inside. PAR and cost stay in cases.</span></span></label><div id="shPackWrap"${pack?'':' hidden'}><label class="fieldRow z0"><span class="fieldLbl">Units per case</span><span class="fieldHelp">How many pieces are in one case.</span><input id="shPackUnits" type="number" min="0" step="any" inputmode="decimal" placeholder="32" value="${esc(packUnits)}"></label><label class="fieldRow z1"><span class="fieldLbl">Unit name</span><span class="fieldHelp">What you count, like sleeves.</span><input id="shPackUnit" type="text" autocomplete="off" autocapitalize="off" placeholder="sleeves" value="${esc(packUnit)}"></label><label class="fieldRow z0"><span class="fieldLbl">Reorder when below</span><span class="fieldHelp">In cases. Stays off the order list until on-hand drops below this.</span><input id="shPackBelow" type="number" min="0" step="any" inputmode="decimal" placeholder="0.5" value="${esc(packBelow)}"></label></div></section><section class="fieldGroup" aria-label="Ordering"><h3 class="fieldHead">Ordering</h3><label class="fieldRow z1"><span class="fieldLbl">Vendor <span class="opt">optional</span></span><span class="fieldHelp">Groups the order list.</span><input id="shVendor" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Cafe Imports, Sysco" value="${esc(vend)}"></label><label class="fieldRow z0"><span class="fieldLbl" id="shCostLbl">${pack?'Cost per case $':'Cost $'} <span class="opt">optional</span></span><span class="fieldHelp" id="shCostHelp">${pack?'Per case. Overhead only, not the order list.':'Per unit. Overhead only, not the order list.'}</span><input id="shCost" type="text" inputmode="decimal" autocomplete="off" placeholder="optional" value="${isEdit&&hasCost(cur)?esc(cur.cost.toFixed(2)):''}"></label></section><section class="fieldGroup" aria-label="Where it lives"><h3 class="fieldHead">Where it lives</h3><label class="fieldRow z1"><span class="fieldLbl">Location <span class="opt">optional</span></span><span class="fieldHelp">Where it sits in the shop.</span><input id="shLoc" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="walk-in, bar fridge" value="${esc(place)}"></label></section><section class="fieldGroup" aria-label="Counting"><h3 class="fieldHead">Counting</h3><label class="fieldRow z0 isCheck"><input type="checkbox" id="shDec"${decOn?' checked':''}><span class="checkCopy"><span class="fieldLbl">Allow decimals</span><span class="fieldHelp">Off counts whole units. On allows numbers like 0.5.</span></span></label><div class="fieldRow z1"><label class="isCheck"><input type="checkbox" id="shC2"${lab?' checked':''}><span class="fieldLbl">Add a second count</span></label><p class="fieldHelp" id="shC2note"${lab?'':' hidden'}>Added to the main count. On-hand and the order list use the sum.</p></div><div id="shC2wrap"${lab?'':' hidden'}><label class="fieldRow z0"><span class="fieldLbl">Second count label</span><input id="shC2lab" type="text" autocomplete="off" placeholder="bags, cases, trays…" value="${esc(lab)}"></label><label class="fieldRow z1"><span class="fieldLbl">Second count location <span class="opt">optional</span></span><input id="shC2loc" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="walk-in, back stock…" value="${esc(loc2)}"></label></div></section></div><div class="sheetFoot"><div class="aerr" id="shErr" role="alert"></div><div class="sheetActs"><button type="button" class="light" id="shCancel">Cancel</button><button type="submit" id="shItemSave">Save</button></div></div></form>`);
 const form=back.querySelector('form');
 const c2=form.querySelector('#shC2'),wrap=form.querySelector('#shC2wrap'),note=form.querySelector('#shC2note'),labI=form.querySelector('#shC2lab'),locI=form.querySelector('#shC2loc'),err=form.querySelector('#shErr');
 const packBox=form.querySelector('#shPack'),packWrap=form.querySelector('#shPackWrap'),packUnitsI=form.querySelector('#shPackUnits');
 bindLocSuggest(form.querySelector('#shLoc'));bindVendorSuggest(form.querySelector('#shVendor'));bindLocSuggest(locI);
 form.addEventListener('input',()=>{err.textContent=''});
 const paintPack=()=>{const on=packBox.checked;packWrap.hidden=!on;form.querySelector('#shCostLbl').firstChild.textContent=on?'Cost per case $ ':'Cost $ ';form.querySelector('#shCostHelp').textContent=on?'Per case. Overhead only, not the order list.':'Per unit. Overhead only, not the order list.';form.querySelector('#shParHelp').textContent=on?'How many cases to keep on hand.':'How many to keep on hand.';const note=form.querySelector('#shParReord');const raw=form.querySelector('#shPackBelow').value.trim(),n=raw===''?NaN:Number(raw),show=on&&isFinite(n)&&n>=0;note.hidden=!show;note.textContent=show?'reorder @ '+fmtReorder(n):'';};
 const revealC2=()=>requestAnimationFrame(()=>{if(!c2.checked)return;const over=locI.getBoundingClientRect().bottom-form.querySelector('.sheetFoot').getBoundingClientRect().top+8;if(over>0)form.querySelector('.sheetBody').scrollTop+=over});
 c2.onchange=()=>{const on=c2.checked;wrap.hidden=!on;note.hidden=!on;err.textContent='';if(!on){labI.value='';locI.value=''}else{labI.focus();revealC2()}};
 packBox.onchange=()=>{paintPack();err.textContent='';if(packBox.checked){packUnitsI.focus();requestAnimationFrame(()=>{const over=form.querySelector('#shPackBelow').getBoundingClientRect().bottom-form.querySelector('.sheetFoot').getBoundingClientRect().top+8;if(over>0)form.querySelector('.sheetBody').scrollTop+=over})}};
 form.querySelector('#shPackBelow').addEventListener('input',paintPack);
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
  const allow=form.querySelector('#shDec').checked,want2=c2.checked,label=labI.value.trim(),loc2v=locI.value.trim(),placeV=form.querySelector('#shLoc').value.trim(),vendorV=form.querySelector('#shVendor').value.trim();
  if(want2&&!label){err.textContent='Name the second count, like bags or cases, or turn it off.';return}
  let unitsPerCase=null,unitName='',reorderBelow=null;
  if(packBox.checked){
   const uRaw=packUnitsI.value.trim(),u=uRaw===''?NaN:Number(uRaw);
   if(!isFinite(u)||!(u>0)){err.textContent='Units per case must be a number above 0, like 32.';packUnitsI.focus();return}
   unitName=form.querySelector('#shPackUnit').value.trim();
   if(!unitName){err.textContent='Name the unit you count, like sleeves.';form.querySelector('#shPackUnit').focus();return}
   const bRaw=form.querySelector('#shPackBelow').value.trim(),b=bRaw===''?NaN:Number(bRaw);
   if(!isFinite(b)||b<0){err.textContent='Reorder when below must be a number of cases, 0 or more, like 0.5.';form.querySelector('#shPackBelow').focus();return}
   unitsPerCase=u;reorderBelow=b;
  }
  const now=isEdit?locateItem(cur.id):null;
  if(isEdit&&!now){err.textContent='That item is no longer in the database.';return}
  const toGi=+form.querySelector('#shCat').value; // catalog section only; location text never creates or moves a header
  if(!S.headers[toGi]){err.textContent='Choose a category.';return}
  const write=it=>{it.name=nm;it.par=par;it.allowDecimal=allow;if(cost===null)delete it.cost;else it.cost=cost;if(placeV)it.location=placeV;else delete it.location;if(vendorV)it.vendor=vendorV;else delete it.vendor;if(want2){it.count2Label=label;if(loc2v)it.count2Location=loc2v;else delete it.count2Location}else{delete it.count2Label;delete it.count2Location;if(S.draft&&S.draft.counts2)delete S.draft.counts2[it.id]}if(packBox.checked){it.unitsPerCase=unitsPerCase;it.unitName=unitName;it.reorderBelow=reorderBelow}else{delete it.unitsPerCase;delete it.unitName;delete it.reorderBelow}};
  if(isEdit){
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
   const c2lab=itemCount2(i),c2n=d.counts2[i.id],c2loc=c2lab?itemCount2Loc(i):'',place=itemLoc(i);
   let stat='';
   if(sk)stat='Skipped';
   else if(has){stat=String(c);if(c2lab&&c2n!=null)stat+=' · '+c2n+' '+c2lab+(c2loc?' · '+c2loc:'')}
   const aria=(sk?'Skipped '+i.name:has?i.name+', '+stat:'Count '+i.name)+(place?', '+place:'');
   const c2quiet=has&&c2lab&&c2n!=null?`<span class="muted invC2">${esc(c2n+' '+c2lab+(c2loc?' · '+c2loc:''))}</span>`:'';
   const placeUi=place?`<span class="muted invLoc">${esc(place)}</span>`:'';
   h+=`<button type="button" class="item invRow ${cls}" data-id="${esc(i.id)}" data-state="${cls}" aria-label="${esc(aria)}"><span class="name">${esc(i.name)}${placeUi}</span><span class="invNums"><span class="invStat">${esc(sk?stat:has?String(c):'')}</span>${c2quiet}</span></button>`}
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
 V.innerHTML=`<p class="muted">From count on <b>${s.date}</b> (saved ${fmt(s.savedAt)})</p>`+orderVendorHtml(s)}
// Order List groups by vendor. No prices on this screen. A saved week's order list stays in orderHtml (category, still no cost).
function orderVendorHtml(s){
 const L=shortList(s.groups);
 if(!L.length)return`<div class="card empty">Nothing to order — everything is at or above par. 🎉</div>`;
 const map=new Map();
 for(const g of L)for(const i of g.items){
  const raw=vendorForLine(g.name,i);
  const key=raw.toLowerCase();
  let bucket=map.get(key);
  if(!bucket){bucket={label:raw||'No vendor',items:[]};map.set(key,bucket)}
  bucket.items.push(i);
 }
 const keys=[...map.keys()].filter(Boolean).sort((a,b)=>map.get(a).label.localeCompare(map.get(b).label,undefined,{sensitivity:'base'}));
 if(map.has(''))keys.push('');
 return keys.map(k=>{
  const b=map.get(k),n=b.items.length;
  return `<section class="vGroup"><div class="vHead"><h3>${esc(b.label)}</h3><span class="vCount">${n} ${n===1?'item':'items'}</span></div><div class="card vCard">`+
   b.items.map(i=>{const pack=packOf(i),unit=pack?`<span class="vNeedUnit">${caseWord(i.need)}</span>`:'';return `<div class="item vItem"><div class="name">${esc(i.name)}<div class="muted vHave">${esc(orderHaveText(i))}${reorderHtml(pack)}</div></div><span class="vNeed"><span class="vNeedLbl">Order</span>${esc(i.need)}${unit}</span></div>`}).join('')+
   `</div></section>`;
 }).join('');
}
function orderHtml(s){const L=shortList(s.groups);if(!L.length)return`<div class="card empty">Nothing to order — everything is at or above par. 🎉</div>`;
 return L.map(g=>`<div class="card"><h3>${esc(g.name)}</h3>`+g.items.map(i=>`<div class="item"><div class="name">${esc(i.name)}<div class="muted">${esc(orderInfoText(i))}${reorderHtml(packOf(i))}</div></div><span class="short">Order ${esc(i.need)}${packOf(i)?' '+caseWord(i.need):''}</span></div>`).join('')+`</div>`).join('')}
function count2Note(i){const label=String(i&&i.count2Label||'').trim();if(!label||i.count2==null)return '';const loc=itemCount2Loc(i);return ` <span class="muted c2note">· ${esc(i.count2)} ${esc(label)}${loc?` · ${esc(loc)}`:''}</span>`}
function countHtml(s){return s.groups.filter(g=>g.items.length).map(g=>`<div class="card"><h3>${esc(g.name)}</h3>`+g.items.map(i=>{const c=costOf(g.name,i.name);const c2=count2Note(i);const place=itemLoc(i);return`<div class="item"><div class="name">${esc(i.name)}<div class="muted">PAR ${esc(i.par)}${reorderHtml(packOf(i))}</div>${place?`<div class="muted locNote">${esc(place)}</div>`:''}${c===null?'':`<div class="muted cCount">cost ${money(c)}</div>`}</div>${i.skipped?'<span class="muted skipTag">Skipped</span>':i.count==null?`<span class="muted">Not counted</span>${c2}`:`<b>${esc(i.count)}</b>${c2}`}</div>`}).join('')+`</div>`).join('')}
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
function snapOrderCost(s){ // one saved count's order total, same math as Overhead: need × current cost, primary count only
 const L=shortList(s&&s.groups).map(g=>({name:g.name,items:g.items.map(i=>({...i,qty:i.need}))}));
 return costGroups(L);
}
function vendorSpend(s){
 const map=new Map();
 for(const g of shortList(s&&s.groups))for(const i of g.items){
  const raw=vendorForLine(g.name,i);
  const key=raw.toLowerCase();
  let b=map.get(key);
  if(!b){b={label:raw||'No vendor',total:0,missing:0};map.set(key,b)}
  const c=costOf(g.name,i.name);
  if(c==null)b.missing++;
  else b.total=Math.round((b.total+i.need*c)*100)/100;
 }
 const rows=[...map.values()].sort((a,b)=>b.total-a.total||a.label.localeCompare(b.label,undefined,{sensitivity:'base'}));
 return rows;
}
function fyDayParts(iso){const d=dayOf(iso);return{m:d.toLocaleDateString(undefined,{month:'short'}),d:String(d.getDate())}}
function forYouHtml(){
 const snaps=S.snapshots.filter(s=>s&&Array.isArray(s.groups));
 if(!snaps.length)return'';
 const cur=snaps[snaps.length-1],prev=snaps.length>1?snaps[snaps.length-2]:null;
 const curCost=snapOrderCost(cur),prevCost=prev?snapOrderCost(prev):null;
 const diff=prevCost?Math.round((curCost.total-prevCost.total)*100)/100:null;
 const delta=diff==null?'':`<p class="fyDelta">${diff===0?'Same as the previous period':(diff>0?'Up ':'Down ')+money(Math.abs(diff))+' from the previous period'}</p>`;
 const rows=vendorSpend(cur);
 const maxV=rows.reduce((m,r)=>Math.max(m,r.total),0);
 const vend=rows.length?rows.map(r=>{
  const pct=maxV?Math.round(r.total/maxV*1000)/10:0;
  const amt=r.total>0?money(r.total):(r.missing?'—':money(0));
  return `<div class="fyVendRow"><div class="fyVendTop"><span>${esc(r.label)}</span><span>${amt}</span></div><div class="fyTrack" role="img" aria-label="${esc(r.label)} ${esc(amt)}"><div class="fyFill" style="width:${pct}%"></div></div></div>`;
 }).join(''):`<p class="fyEmpty">Nothing to order on this count.</p>`;
 const series=snaps.slice(-8);
 const costs=series.map(s=>snapOrderCost(s).total);
 const maxC=costs.reduce((m,n)=>Math.max(m,n),0);
 const chart=series.map((s,n)=>{
  const total=costs[n],now=s===cur,pct=maxC?Math.round(total/maxC*100):0,parts=fyDayParts(s.date);
  return `<div class="fyCol${now?' now':''}" role="img" aria-label="${esc(fmtDay(s.date,true))}, ${money(total)}${now?', current period':''}"><div class="fyBarWrap"><div class="fyBar${now?' now':''}" style="height:${pct}%"></div></div><span class="fyLab">${esc(parts.m)}<b>${esc(parts.d)}</b>${now?'<b class="fyNowLab">Now</b>':''}</span></div>`;
 }).join('');
 const miss=curCost.missing?`<p class="fyNote">${curCost.missing} item${curCost.missing===1?'':'s'} without a cost ${curCost.missing===1?"isn't":"aren't"} in these totals.</p>`:'';
 const more=snaps.length>8?`<p class="fyNote">Last 8 counts.</p>`:'';
 return `<section class="forYou" aria-label="For you only"><div class="forYouCard"><h2>For you only</h2><p class="fyNote">Order cost from the primary count. Quantity to reach par × the cost in Database.</p><div class="fyCompare"><div class="fyStat fyNow"><div class="fyK">Latest count</div><div class="fyD">${esc(fmtDay(cur.date,true))}</div><div class="fyN">${money(curCost.total)}</div></div><div class="fyStat"><div class="fyK">Previous period</div><div class="fyD">${prev?esc(fmtDay(prev.date,true)):'No earlier count'}</div><div class="fyN">${prevCost?money(prevCost.total):'—'}</div></div></div>${delta}<h3>By vendor</h3>${vend}${miss}<h3>Past periods</h3><div class="fyChart" role="img" aria-label="Order totals by saved count. The latest is highlighted.">${chart}</div>${more}</div></section>`;
}
function overheadHtml(){
 if(!S.snapshots.length)return'';
 const kind=ohKind();
 const you=forYouHtml();
 if(kind==='off')return`<section class="overhead ohOff" aria-label="Overhead (off)"><div class="bar ohBar"><b>Overhead</b><span class="hsw ohWin">${ohWinBtns(kind)}</span></div></section>${you}<h2 class="histHead">Saved counts</h2>`;
 const o=computeOverhead(kind);const msg=ohEmpty(o);
 const body=msg?`<div class="card empty">${esc(msg)}</div>`:o.groups.map(g=>`<div class="card"><h3 class="ghead">${esc(g.name)}</h3>`+g.items.map(i=>`<div class="item"><div class="name">${esc(i.name)}</div><span class="ohQty">${i.qty} @ ${i.c===null?'—':money(i.c)}</span><b class="ohLine">${i.line===null?'—':money(i.line)}</b></div>`).join('')
  +(g.subN?`<div class="item ohSubRow"><div class="name muted">Subtotal</div><b class="ohSub">${money(g.sub)}</b></div>`:'')+`</div>`).join('')
  +`<div class="card ohTotalCard"><div class="item"><div class="name"><b>Overhead total</b></div><b class="ohTotal">${money(o.total)}</b></div>${o.missing?`<p class="muted ohNote">${o.missing} item${o.missing===1?'':'s'} without a cost ${o.missing===1?"isn't":"aren't"} in the total. Add costs in the <b>Database</b> tab.</p>`:''}<p class="muted ohHow">Order cost of the ${o.counts} saved count${o.counts===1?'':'s'} in this window.</p></div>`;
 return`<section class="overhead" aria-label="Overhead"><div class="bar ohBar"><b>Overhead</b>${ohControlsHtml(kind)}<button type="button" class="light sm ohPrint" id="ohPrint" aria-label="Print overhead">Print overhead</button></div><p class="muted ohRange">${esc(windowText(kind,o)+' · '+rangeText(o))}</p>${body}</section>${you}<h2 class="histHead">Saved counts</h2>`}
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
   body+=M.groups.map(g=>`<div class="rOGroup"><div class="rHead">${esc(g.name)}</div>`+rLines(g,i=>`<div class="rOInfo">${esc(orderInfoText(i))}${reorderHtml(packOf(i))}</div>`)+rSub(g)+`</div>`).join('')
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
 let h=`<div class="bar dbBar"><button id="addH">+ Add header</button><button id="reorderBtn" class="light sm reorderBtn${reorderMode?' on':''}" aria-pressed="${reorderMode}">${reorderMode?'Done':'Reorder'}</button><span class="dbSpacer" style="flex:1"></span><span class="hsw muted"><span class="hsLbl">Header style:</span> <button class="sm ${hsOn('border')?'on':''}" data-hs="border" aria-pressed="${hsOn('border')}">Border</button><button class="sm ${hsOn('tint')?'on':''}" data-hs="tint" aria-pressed="${hsOn('tint')}">Tint</button></span></div>`;
 if(!S.headers.length)h+=`<div class="card empty">Database is empty. Tap <b>+ Add header</b> to create a category like “Coffee”.</div>`;
 S.headers.forEach((g,gi)=>{h+=`<div class="card"><div class="hrow ghead"><input type="text" class="nm hname" data-g="${gi}" value="${esc(g.name)}" aria-label="Rename ${esc(g.name)}"><button type="button" class="sm addI dbAct" data-g="${gi}" aria-label="Add item">Add item</button><button type="button" class="light sm mvH dbAct" data-g="${gi}" data-d="-1" aria-label="move up">↑</button><button type="button" class="light sm mvH dbAct" data-g="${gi}" data-d="1" aria-label="move down">↓</button><button type="button" class="danger sm delH dbAct" data-g="${gi}" aria-label="delete header">✕</button></div>`;
  g.items.forEach((i,ii)=>{const c2=itemCount2(i),c2loc=c2?itemCount2Loc(i):'',place=itemLoc(i),vend=itemVendor(i),pack=packOf(i);h+=`<div class="item dbItem"><div class="dbName"><input type="text" class="nm iname" data-g="${gi}" data-i="${ii}" value="${esc(i.name)}" aria-label="item name">${vend?`<div class="muted dbC2">Vendor: ${esc(vend)}</div>`:''}${place?`<div class="muted dbC2">${esc(place)}</div>`:''}${c2?`<div class="muted dbC2">Also count ${esc(c2)}${c2loc?` · ${esc(c2loc)}`:''}</div>`:''}${pack?`<div class="muted dbC2">${esc(fmtNum(pack.units)+' '+pack.unit+' per case · reorder below '+fmtCaseQty(pack.below))}</div>`:''}</div><label class="muted parLab">PAR <input type="number" min="0" class="ipar" data-g="${gi}" data-i="${ii}" value="${i.par}">${reorderHtml(pack)}</label><label class="muted icostL">${pack?'Cost per case $':'Cost $'}<input type="text" inputmode="decimal" class="icost" data-g="${gi}" data-i="${ii}" value="${hasCost(i)?i.cost.toFixed(2):''}" placeholder="cost" aria-label="${pack?'cost per case':'cost per unit'} ${esc(i.name)}"></label><button type="button" class="light sm dbEdit" data-g="${gi}" data-i="${ii}" aria-label="Edit ${esc(i.name)}">Edit</button><button class="light sm mvI" data-g="${gi}" data-i="${ii}" data-d="-1" aria-label="move item up">↑</button><button class="light sm mvI" data-g="${gi}" data-i="${ii}" data-d="1" aria-label="move item down">↓</button><button class="danger sm delI" data-g="${gi}" data-i="${ii}">✕</button></div>`});
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
