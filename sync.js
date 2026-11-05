// Cloud sync with Supabase. The whole inventory (S) lives in one row of public.inventory_state per account.
// - save() in app.js still writes localStorage right away (works offline), then calls Sync.changed().
// - Changes are uploaded about 1 second later. On sign-in, when the tab comes back, when the device goes
//   back online, and when another device saves (realtime), the online copy is checked. Newest copy wins.
// - updated_at is always the server's clock (trigger in supabase/setup.sql).
const Sync=(()=>{
 const META='coffeeInventory.sync',TABLE='inventory_state',DEBOUNCE=1000,RETRY=15000;
 const LABEL={synced:'✓ Synced',syncing:'Syncing…',offline:'Offline, will sync',error:'Sync problem, will retry',local:'Offline, reload to sync'};
 let sb=null,user=null,timer=null,retry=null,chan=null,q=Promise.resolve(),pullQueued=false,lastPull=0;
 const meta=()=>{try{return JSON.parse(localStorage.getItem(META))||{}}catch{return{}}};
 const setMeta=m=>localStorage.setItem(META,JSON.stringify(m));
 const clean=d=>{const c=JSON.parse(JSON.stringify(d||{}));delete c.auth;delete c.session;delete c.password;delete c._edited;return c}; // never sync login data
 const pristine=d=>!(d.snapshots||[]).length&&!(d.headers||[]).some(h=>(h.items||[]).length); // untouched starter data
 const sameData=(a,b)=>JSON.stringify(clean(a))===JSON.stringify(clean(b));
 const netErr=e=>navigator.onLine===false||/fetch|network|timeout|load failed|offline/i.test((e&&(e.message||e.name))||'')||(e&&e.status===0);
 function setStatus(s,title){const el=document.getElementById('syncStatus');if(!el)return;el.textContent=LABEL[s]||'';el.dataset.s=s||'';el.title=title||LABEL[s]||''}
 const run=f=>(q=q.then(f).catch(e=>fail(e)));
 function fail(e){if(!user)return;setStatus(netErr(e)?'offline':'error',e&&e.message);clearTimeout(retry);retry=setTimeout(pull,RETRY)}
 function changed(){if(!user)return;const m=meta();m.dirty=true;m.localModified=new Date().toISOString();setMeta(m);
  setStatus(navigator.onLine===false?'offline':'syncing');clearTimeout(timer);timer=setTimeout(push,DEBOUNCE)}
 function push(){clearTimeout(timer);return run(doPush)}
 function pull(){if(!user||pullQueued)return q;pullQueued=true;return run(async()=>{pullQueued=false;lastPull=Date.now();await doPull()})}
 async function doPush(){if(!user||!sb)return;const m=meta();if(!m.dirty||m.user!==user.id)return;const stamp=m.localModified,uid=user.id;setStatus('syncing');
  const {data,error}=await sb.from(TABLE).upsert({user_id:uid,data:Object.assign(clean(S),{_edited:stamp})},{onConflict:'user_id'}).select('updated_at').single();
  if(error)return fail(error);if(!user||user.id!==uid)return;
  const m2=meta();m2.user=uid;m2.lastSynced=data.updated_at;if(m2.localModified===stamp)m2.dirty=false;setMeta(m2);clearTimeout(retry);
  if(m2.dirty){clearTimeout(timer);timer=setTimeout(push,DEBOUNCE)}else setStatus('synced')}
 async function doPull(){if(!user||!sb)return;const uid=user.id;setStatus('syncing');
  const {data:row,error}=await sb.from(TABLE).select('data,updated_at').eq('user_id',uid).maybeSingle();
  if(error)return fail(error);if(!user||user.id!==uid)return;clearTimeout(retry);
  const m=meta(),known=m.user===uid; // has this device synced with this account before?
  if(!row){setMeta({...m,user:uid,dirty:true,localModified:m.localModified||new Date().toISOString()});return doPush()} // first device: upload what is here
  if(known&&row.updated_at===m.lastSynced){if(m.dirty)return doPush();return setStatus('synced')}
  let useRemote;
  const remoteEdit=(row.data&&row.data._edited)||row.updated_at;
  if(known)useRemote=!m.dirty||!(m.localModified>remoteEdit); // both changed since last sync: newest edit wins
  else if(sameData(S,row.data)||pristine(S))useRemote=true;
  else if(pristine(row.data))useRemote=false;
  else useRemote=!confirm('Your online account already has inventory data, and this device has different data.\n\nOK = keep THIS DEVICE’s data (it replaces the online copy).\nCancel = use the ONLINE data on this device.');
  if(useRemote){if(!known&&!pristine(S)&&!sameData(S,row.data))localStorage.setItem('coffeeInventory.beforeSync',JSON.stringify(S)); // safety copy
   applyRemote(row)}
  else{setMeta({...m,user:uid,dirty:true,localModified:known&&m.localModified?m.localModified:new Date().toISOString()});return doPush()}}
 function applyRemote(row){const d=clean(row.data);if(!Array.isArray(d.headers)||!Array.isArray(d.snapshots))return fail(new Error('Online data is not valid'));
  const changedData=!sameData(S,d);S=d;localStorage.setItem(KEY,JSON.stringify(S));
  setMeta({user:user.id,lastSynced:row.updated_at,dirty:false,localModified:(row.data&&row.data._edited)||row.updated_at});setStatus('synced');if(changedData)rerender()}
 function rerender(){if(document.getElementById('app').hidden)return;const a=document.activeElement,sel=a&&a.dataset&&a.dataset.id?`[data-id="${a.dataset.id}"]`:null;
  if(histSel&&!S.snapshots.some(x=>x.id===histSel))histSel=null;render();if(sel){const e=V.querySelector('input'+sel);if(e)e.focus()}}
 function subscribe(){if(!sb.channel)return;try{chan=sb.channel('inventory-'+user.id).on('postgres_changes',{event:'*',schema:'public',table:TABLE,filter:'user_id=eq.'+user.id},
  p=>{if(!p.new||p.new.updated_at!==meta().lastSynced)pull()}).subscribe()}catch(e){chan=null}}
 function start(u,client){sb=client||null;user=u;if(!sb){setStatus('local');return}setStatus('syncing');subscribe();pull()}
 function stop(){clearTimeout(timer);clearTimeout(retry);if(chan&&sb)try{sb.removeChannel(chan)}catch{}chan=null;user=null;setStatus('')}
 async function flush(ms=4000){if(!user||!sb||!meta().dirty)return;await Promise.race([push(),new Promise(r=>setTimeout(r,ms))])}
 document.addEventListener('visibilitychange',()=>{if(!user||!sb)return;if(document.visibilityState==='visible')pull();else if(meta().dirty)push()});
 addEventListener('focus',()=>{if(user&&sb&&Date.now()-lastPull>3000)pull()});
 addEventListener('online',()=>{if(user&&sb)pull()});addEventListener('offline',()=>{if(user&&sb)setStatus('offline')});
 addEventListener('pagehide',()=>{if(user&&sb&&meta().dirty)push()});
 return{changed,start,stop,flush,pull,push,clean}})();
