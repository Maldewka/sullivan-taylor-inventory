// Local-device login gate. Stores only a PBKDF2-SHA256 salted hash in localStorage.
const AUTH_KEY='coffeeInventory.auth', SESSION_KEY='coffeeInventory.session';
const USERNAME='STHouse', MIN_PW=6, ITER=200000;
const SESSION_STORE=sessionStorage; // signed in until the tab/browser closes
const A=document.getElementById('auth'),APP=document.getElementById('app');
let fails=0,lockUntil=0,authMode=null;
const b64=u=>btoa(String.fromCharCode(...new Uint8Array(u)));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const getAuth=()=>{try{return JSON.parse(localStorage.getItem(AUTH_KEY))}catch{return null}};
async function derive(pw,salt,iter){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveBits']);
 return b64(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:iter},k,256))}
const RC_ALPHA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars, no 0/O/1/I
const normCode=c=>String(c).toUpperCase().replace(/[\s-]/g,'');
function genCode(){const r=crypto.getRandomValues(new Uint8Array(12));const c=[...r].map(x=>RC_ALPHA[x&31]).join('');return c.slice(0,4)+'-'+c.slice(4,8)+'-'+c.slice(8)}
async function setPassword(pw){const old=getAuth()||{};const salt=crypto.getRandomValues(new Uint8Array(16));
 const rec={user:USERNAME,salt:b64(salt),hash:await derive(pw,salt,ITER),iter:ITER,alg:'PBKDF2-SHA256',rsalt:old.rsalt,rhash:old.rhash};localStorage.setItem(AUTH_KEY,JSON.stringify(rec));return rec}
async function newRecovery(){const a=getAuth();const code=genCode();const rs=crypto.getRandomValues(new Uint8Array(16));
 a.rsalt=b64(rs);a.rhash=await derive(normCode(code),rs,a.iter);localStorage.setItem(AUTH_KEY,JSON.stringify(a));return code}
const same=(x,y)=>{let d=x.length^y.length;for(let i=0;i<x.length;i++)d|=x.charCodeAt(i)^(y.charCodeAt(i)||0);return d===0};
async function verify(user,pw){const a=getAuth();if(!a||user.trim()!==a.user)return false;return same(await derive(pw,unb64(a.salt),a.iter),a.hash)}
async function verifyRecovery(user,code){const a=getAuth();if(!a||!a.rhash||user.trim()!==a.user)return false;return same(await derive(normCode(code),unb64(a.rsalt),a.iter),a.rhash)}
const signedIn=()=>{const a=getAuth();return !!a&&SESSION_STORE.getItem(SESSION_KEY)===a.hash};
function unlock(){SESSION_STORE.setItem(SESSION_KEY,getAuth().hash);A.hidden=true;A.innerHTML='';APP.hidden=false;S=load();tab='inventory';histSel=null;render()}
function lock(){SESSION_STORE.removeItem(SESSION_KEY);APP.hidden=true;V.innerHTML='';showAuth()}
const brand=`<div class="abrand"><div class="acup">☕</div><h1>Sullivan Taylor Uptown</h1><div class="muted">Inventory</div></div>`;
const pwField=(id,label,ac)=>`<label class="afield"><span>${label}</span><span class="pwwrap"><input type="password" id="${id}" autocomplete="${ac}" required><button type="button" class="light sm pwtog" data-for="${id}" aria-label="Show password">Show</button></span></label>`;
function bindToggles(root){root.querySelectorAll('.pwtog').forEach(b=>b.onclick=()=>{const i=document.getElementById(b.dataset.for);const show=i.type==='password';i.type=show?'text':'password';b.textContent=show?'Hide':'Show';b.setAttribute('aria-label',show?'Hide password':'Show password')})}
function showAuth(mode){APP.hidden=true;A.hidden=false;
 if(!window.crypto||!crypto.subtle){A.innerHTML=`<div class="acard">${brand}<h2>Can’t start securely</h2><p class="aerr">This browser isn’t allowing secure password features here (crypto.subtle is unavailable). Open the app over <b>https://</b> or from <b>localhost</b>, or in an up-to-date browser.</p></div>`;return}
 authMode=mode||(getAuth()?'signin':'setup');
 if(authMode==='setup'){A.innerHTML=`<form class="acard" id="af">${brand}<h2>Set your password</h2>
  <p class="muted">First time on this device. Choose a password (at least ${MIN_PW} characters).</p>
  <label class="afield"><span>Username</span><input type="text" id="au" value="${esc(USERNAME)}" readonly></label>
  ${pwField('ap','Password','new-password')}${pwField('ap2','Confirm password','new-password')}
  <div class="aerr" id="ae" role="alert"></div><button class="abtn" id="asub">Set password &amp; continue</button></form>`;
  bindToggles(A);af.onsubmit=async e=>{e.preventDefault();const p1=ap.value,p2=ap2.value;
   if(p1.length<MIN_PW)return ae.textContent=`Password must be at least ${MIN_PW} characters.`;if(p1!==p2)return ae.textContent='Passwords don’t match.';
   asub.disabled=true;await setPassword(p1);showCode(await newRecovery(),'',unlock)};ap.focus();return}
 if(authMode==='forgot'){A.innerHTML=`<form class="acard" id="af">${brand}<h2>Forgot password</h2>
  <p class="muted">Enter the recovery code you wrote down when the password was set. This lock is for this device only; your inventory stays as it is.</p>
  <label class="afield"><span>Username</span><input type="text" id="au" value="${esc(USERNAME)}" autocomplete="username"></label>
  <label class="afield"><span>Recovery code</span><input type="text" id="arc" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
  ${pwField('ap','New password','new-password')}${pwField('ap2','Confirm new password','new-password')}
  <div class="aerr" id="ae" role="alert"></div><button class="abtn" id="asub">Set new password</button><button type="button" class="light abtn" id="aback">Back to sign in</button></form>`;
  bindToggles(A);aback.onclick=()=>showAuth('signin');
  af.onsubmit=async e=>{e.preventDefault();if(backoffBlocked())return;
   if(ap.value.length<MIN_PW)return ae.textContent=`New password must be at least ${MIN_PW} characters.`;if(ap.value!==ap2.value)return ae.textContent='Passwords don’t match.';
   asub.disabled=true;if(!await verifyRecovery(au.value,arc.value))return failed('That username or recovery code isn’t right.');
   fails=0;await setPassword(ap.value);showCode(await newRecovery(),'Password reset. Your old recovery code no longer works. Here is your new one:',unlock)};return}
 A.innerHTML=`<form class="acard" id="af">${brand}<h2>Sign in</h2>
  <label class="afield"><span>Username</span><input type="text" id="au" value="${esc(USERNAME)}" autocomplete="username"></label>
  ${pwField('ap','Password','current-password')}
  <div class="aerr" id="ae" role="alert"></div><button class="abtn" id="asub">Sign in</button>
  <button type="button" class="linkbtn" id="aforgot">Forgot password?</button></form>`;
 bindToggles(A);aforgot.onclick=()=>showAuth('forgot');ap.focus();
 af.onsubmit=async e=>{e.preventDefault();if(backoffBlocked())return;
  asub.disabled=true;if(await verify(au.value,ap.value)){fails=0;unlock();return}
  ap.value='';failed('That username or password isn’t right.')}}
function backoffBlocked(){const wait=lockUntil-Date.now();if(wait>0){ae.textContent=`Too many tries. Wait ${Math.ceil(wait/1000)}s and try again.`;return true}return false}
function failed(msg){fails++;const delay=fails>=3?Math.min(30,2**(fails-2))*1000:0;lockUntil=Date.now()+delay;
 ae.textContent=msg+(delay?` Please wait ${delay/1000}s before trying again.`:'');setTimeout(()=>{if(document.body.contains(asub))asub.disabled=false},delay)}
function showCode(code,intro,next){APP.hidden=true;V.innerHTML='';A.hidden=false;
 A.innerHTML=`<div class="acard">${brand}<h2>Write this down</h2><p class="muted">${intro||'This is your recovery code. If you forget the password, it is the only way back in.'} It is shown <b>only once</b> and can’t be viewed again.</p>
 <label class="afield"><span>Recovery code <span class="muted" style="font-weight:400">(tap to select)</span></span><input class="rcode" id="rcode" type="text" value="${code}" readonly aria-label="Recovery code" autocomplete="off" spellcheck="false" inputmode="none"></label><button type="button" class="light abtn" id="rcopy">Copy code</button>
 <label class="acheck"><input type="checkbox" id="rsaved"> I’ve saved my recovery code somewhere safe</label>
 <button class="abtn" id="rcont" disabled>Continue</button></div>`;
 const selAll=()=>{rcode.focus();rcode.select();rcode.setSelectionRange(0,rcode.value.length)};rcode.onfocus=rcode.onclick=selAll;
 rcopy.onclick=async()=>{try{if(!navigator.clipboard)throw 0;await navigator.clipboard.writeText(rcode.value);rcopy.textContent='Copied ✓'}catch{selAll();rcopy.textContent='Selected, press copy'}};
 rsaved.onchange=()=>rcont.disabled=!rsaved.checked;rcont.onclick=()=>{if(!rsaved.checked)return;code=null;next()}}
// Account footer on the Database tab: change password + log out
const _database=database;
database=function(){_database();V.insertAdjacentHTML('beforeend',`<details class="card acct"><summary>Account &amp; password</summary>
 <p class="muted">Signed in as <b>${esc(USERNAME)}</b>. This password locks the app on this device only.</p>
 <form id="cpf" class="cpf">${pwField('cpo','Current password','current-password')}${pwField('cpn','New password','new-password')}${pwField('cpn2','Confirm new password','new-password')}
 <div class="aerr" id="cpe" role="alert"></div><button id="cps">Change password</button></form>
 <form id="rcf" class="cpf"><h4 style="margin:10px 0 0">Recovery code</h4><p class="muted" style="margin:0">Changing your password keeps your current recovery code. Making a new one makes the old code stop working.</p>
 ${pwField('rco','Current password','current-password')}<div class="aerr" id="rce" role="alert"></div><button id="rcs" class="light">Make a new recovery code</button></form></details>`);
 bindToggles(V);cpf.onsubmit=async e=>{e.preventDefault();cpe.className='aerr';
  if(!await verify(USERNAME,cpo.value))return cpe.textContent='Current password is incorrect.';
  if(cpn.value.length<MIN_PW)return cpe.textContent=`New password must be at least ${MIN_PW} characters.`;
  if(cpn.value!==cpn2.value)return cpe.textContent='New passwords don’t match.';
  const rec=await setPassword(cpn.value);SESSION_STORE.setItem(SESSION_KEY,rec.hash);cpf.reset();cpe.className='aok';cpe.textContent='Password changed. Your recovery code is unchanged.'};
 rcf.onsubmit=async e=>{e.preventDefault();if(!await verify(USERNAME,rco.value))return rce.textContent='Current password is incorrect.';
  showCode(await newRecovery(),'New recovery code created. Your old code no longer works.',()=>{unlock();tab='database';render()})}};
logoutBtn.onclick=lock;
if(signedIn())unlock();else showAuth();
