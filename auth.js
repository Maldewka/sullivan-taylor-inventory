// Sign-in with Supabase Auth (email + password). One shared shop account is the expected use.
// The session is kept by supabase-js in this browser's localStorage, so the app stays signed in
// (and can open offline) until someone taps Log out. Passwords are never stored by this app.
const MIN_PW=6; // Supabase's default minimum; keep in step with Authentication -> Providers -> Email.
const A=document.getElementById('auth'),APP=document.getElementById('app');
const LAST_EMAIL='coffeeInventory.lastEmail';
const SB_URL=String(window.SUPABASE_URL||''),SB_KEY=String(window.SUPABASE_ANON_KEY||'');
const CONFIGURED=/^https:\/\/[^\s]+$/.test(SB_URL)&&!/PASTE|YOUR/i.test(SB_URL+SB_KEY)&&SB_KEY.length>20;
const APP_URL=window.APP_URL||location.href.split('#')[0].split('?')[0];
// Look at the link before supabase-js reads (and clears) it: password reset links say type=recovery.
const LINK=new URLSearchParams(location.hash.slice(1)),QS=new URLSearchParams(location.search);
let recovering=LINK.get('type')==='recovery';
let linkError=LINK.get('error_description')||QS.get('error_description')||'';
if(linkError&&history.replaceState)history.replaceState(null,'',location.pathname);
localStorage.removeItem('coffeeInventory.auth');sessionStorage.removeItem('coffeeInventory.session'); // old device-only login, no longer used
let sb=null,unlocked=false,curUser=null,fails=0,lockUntil=0,notice=null;
const brand=`<div class="abrand"><div class="acup">☕</div><h1>Sullivan Taylor Uptown</h1><div class="muted">Inventory</div></div>`;
const pwField=(id,label,ac)=>`<label class="afield"><span>${label}</span><span class="pwwrap"><input type="password" id="${id}" autocomplete="${ac}" required><button type="button" class="light sm pwtog" data-for="${id}" aria-label="Show password">Show</button></span></label>`;
const emailField=(ac='username')=>`<label class="afield"><span>Email</span><input type="email" id="aem" autocomplete="${ac}" inputmode="email" autocapitalize="off" spellcheck="false" required value="${esc(carryEmail||localStorage.getItem(LAST_EMAIL)||'')}"></label>`;
let carryEmail=''; // keep what was typed when switching between sign-in / create / forgot
function bindToggles(root){root.querySelectorAll('.pwtog').forEach(b=>b.onclick=()=>{const i=document.getElementById(b.dataset.for);const show=i.type==='password';i.type=show?'text':'password';b.textContent=show?'Hide':'Show';b.setAttribute('aria-label',show?'Hide password':'Show password')})}
const noteHtml=()=>{const n=notice;notice=null;return n?`<div class="${n.ok?'aok':'aerr'}" id="anote" role="status">${esc(n.text)}</div>`:''};
function errText(e){const m=(e&&(e.message||e.error_description))||String(e||'');
 if(/invalid login credentials/i.test(m))return 'That email or password isn’t right.';
 if(/email not confirmed/i.test(m))return 'Please confirm your email first. Open the link we emailed you, then sign in.';
 if(/already registered|already exists/i.test(m))return 'That email already has an account. Sign in instead, or use Forgot password.';
 if(/rate limit|too many|security purposes/i.test(m))return 'Too many tries for now. Wait a minute and try again.';
 if(/same.*password|different from the old/i.test(m))return 'Choose a password different from the old one.';
 if(/weak|at least|characters/i.test(m))return 'That password is too weak. '+m;
 if(navigator.onLine===false||/fetch|network|load failed|timeout/i.test(m)||(e&&e.status===0))return 'Can’t reach the server. Check your internet connection and try again.';
 return m||'Something went wrong. Please try again.'}
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
function storedSession(){try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^sb-.*-auth-token$/.test(k)){const s=JSON.parse(localStorage.getItem(k));const u=s&&(s.user||(s.currentSession&&s.currentSession.user));if(u&&u.id)return{key:k,user:u}}}}catch{}return null}
function unlock(user,client){unlocked=true;curUser=user;if(user.email)localStorage.setItem(LAST_EMAIL,user.email);
 A.hidden=true;A.innerHTML='';APP.hidden=false;S=load();tab='inventory';histSel=null;render();Sync.start(user,client)}
function lock(){unlocked=false;curUser=null;Sync.stop();APP.hidden=true;V.innerHTML='';if(!sb)return showMsg('Can’t reach the sign-in service','Check your internet connection, then try again.',true);showAuth('signin')}
function showMsg(title,text,reload){APP.hidden=true;A.hidden=false;A.innerHTML=`<div class="acard">${brand}<h2>${esc(title)}</h2><p class="muted">${text}</p>${reload?'<button class="abtn" id="areload">Try again</button>':''}</div>`;
 if(reload)areload.onclick=()=>location.reload()}
function busy(on){asub.disabled=on}
function showAuth(mode){const t=document.getElementById('aem');carryEmail=t?t.value.trim():'';APP.hidden=true;A.hidden=false;
 if(mode==='create'){A.innerHTML=`<form class="acard" id="af" novalidate>${brand}<h2>Create account</h2>
  <p class="muted">Set up the shop’s account once, then sign in with the same email and password on every phone and computer. Use an email you can open: password reset links go there.</p>
  ${emailField('email')}${pwField('ap','Password','new-password')}${pwField('ap2','Confirm password','new-password')}
  <div class="aerr" id="ae" role="alert"></div><button class="abtn" id="asub">Create account</button><button type="button" class="light abtn" id="aback">Back to sign in</button></form>`;
  bindToggles(A);aback.onclick=()=>showAuth('signin');(aem.value?ap:aem).focus();
  af.onsubmit=async e=>{e.preventDefault();ae.textContent='';const em=aem.value.trim();
   if(!validEmail(em))return ae.textContent='Enter a valid email address.';
   if(ap.value.length<MIN_PW)return ae.textContent=`Password must be at least ${MIN_PW} characters.`;if(ap.value!==ap2.value)return ae.textContent='Passwords don’t match.';
   busy(true);const {data,error}=await sb.auth.signUp({email:em,password:ap.value,options:{emailRedirectTo:APP_URL}});
   if(error){busy(false);return ae.textContent=errText(error)}
   localStorage.setItem(LAST_EMAIL,em);
   if(!data.session){notice={ok:1,text:`Almost done. We emailed a confirmation link to ${em}. Open it, then sign in here.`};showAuth('signin')}}; // with a session, SIGNED_IN opens the app
  return}
 if(mode==='forgot'){A.innerHTML=`<form class="acard" id="af" novalidate>${brand}<h2>Forgot password</h2>
  <p class="muted">Enter the account email. We’ll email you a link. Open it on any device to choose a new password. Your inventory stays as it is.</p>
  ${emailField('email')}<div class="aerr" id="ae" role="alert"></div><button class="abtn" id="asub">Email me a reset link</button><button type="button" class="light abtn" id="aback">Back to sign in</button></form>`;
  aback.onclick=()=>showAuth('signin');aem.focus();
  af.onsubmit=async e=>{e.preventDefault();ae.className='aerr';ae.textContent='';const em=aem.value.trim();if(!validEmail(em))return ae.textContent='Enter a valid email address.';
   busy(true);const {error}=await sb.auth.resetPasswordForEmail(em,{redirectTo:APP_URL});busy(false);
   if(error)return ae.textContent=errText(error);localStorage.setItem(LAST_EMAIL,em);
   ae.className='aok';ae.textContent=`If ${em} has an account, a reset link is on its way. Check your inbox (and spam).`};return}
 if(mode==='recover'){A.innerHTML=`<form class="acard" id="af" novalidate>${brand}<h2>Set a new password</h2>
  <p class="muted">You opened a password reset link${curUserEmail()?` for <b>${esc(curUserEmail())}</b>`:''}. Choose a new password.</p>
  ${pwField('ap','New password','new-password')}${pwField('ap2','Confirm new password','new-password')}
  <div class="aerr" id="ae" role="alert"></div><button class="abtn" id="asub">Save new password</button></form>`;
  bindToggles(A);ap.focus();
  af.onsubmit=async e=>{e.preventDefault();ae.textContent='';
   if(ap.value.length<MIN_PW)return ae.textContent=`New password must be at least ${MIN_PW} characters.`;if(ap.value!==ap2.value)return ae.textContent='Passwords don’t match.';
   busy(true);const {data,error}=await sb.auth.updateUser({password:ap.value});
   if(error){busy(false);return ae.textContent=errText(error)}
   recovering=false;const {data:sd}=await sb.auth.getSession();const u=(sd.session&&sd.session.user)||data.user;unlock(u,sb);toast('Password updated.')};return}
 A.innerHTML=`<form class="acard" id="af" novalidate>${brand}<h2>Sign in</h2>${noteHtml()}
  ${emailField('username')}${pwField('ap','Password','current-password')}
  <div class="aerr" id="ae" role="alert"></div><button class="abtn" id="asub">Sign in</button>
  <button type="button" class="linkbtn" id="aforgot">Forgot password?</button>
  <button type="button" class="linkbtn" id="acreate">First time? Create account</button></form>`;
 bindToggles(A);aforgot.onclick=()=>showAuth('forgot');acreate.onclick=()=>showAuth('create');(aem.value?ap:aem).focus();
 af.onsubmit=async e=>{e.preventDefault();ae.textContent='';const em=aem.value.trim();if(backoffBlocked())return;
  if(!validEmail(em))return ae.textContent='Enter a valid email address.';if(!ap.value)return ae.textContent='Enter your password.';
  busy(true);const {error}=await sb.auth.signInWithPassword({email:em,password:ap.value});
  if(error){ap.value='';if(/invalid login/i.test(error.message||''))return failed(errText(error));busy(false);return ae.textContent=errText(error)}
  fails=0;localStorage.setItem(LAST_EMAIL,em)}} // SIGNED_IN opens the app
const curUserEmail=()=>curUser&&curUser.email||'';
function backoffBlocked(){const wait=lockUntil-Date.now();if(wait>0){ae.textContent=`Too many tries. Wait ${Math.ceil(wait/1000)}s and try again.`;return true}return false}
function failed(msg){fails++;const delay=fails>=3?Math.min(30,2**(fails-2))*1000:0;lockUntil=Date.now()+delay;
 ae.textContent=msg+(delay?` Please wait ${delay/1000}s before trying again.`:'');setTimeout(()=>{if(document.body.contains(asub))asub.disabled=false},delay)}
function onAuth(ev,session){
 if(ev==='PASSWORD_RECOVERY'){recovering=true;if(unlocked){unlocked=false;Sync.stop()}curUser=session&&session.user;return showAuth('recover')}
 if(!session){if(ev==='INITIAL_SESSION'){const st=storedSession();if(st&&navigator.onLine===false)return unlock(st.user,sb)} // offline: open with this device's data
  if(unlocked||ev==='INITIAL_SESSION'){if(linkError&&ev==='INITIAL_SESSION'){notice={text:/expired|invalid/i.test(linkError)?'That email link has expired or was already used. Request a new one with Forgot password.':linkError};linkError=''}lock()}return}
 if(recovering){curUser=session.user;return showAuth('recover')}
 if(!unlocked)unlock(session.user,sb);else if(curUser&&curUser.id!==session.user.id){Sync.stop();unlock(session.user,sb)}
 else curUser=session.user}
// Account section on the Database tab: who is signed in + change password
const _database=database;
database=function(){_database();V.insertAdjacentHTML('beforeend',`<details class="card acct"><summary>Account &amp; password</summary>
 <p class="muted">Signed in as <b>${esc(curUserEmail()||'the shop account')}</b>. Your inventory syncs to this account on every device that signs in with it.</p>
 ${sb?`<form id="cpf" class="cpf" novalidate>${pwField('cpn','New password','new-password')}${pwField('cpn2','Confirm new password','new-password')}
 <div class="aerr" id="cpe" role="alert"></div><button id="cps">Change password</button></form>`:'<p class="muted">Connect to the internet and reload to change the password.</p>'}</details>`);
 if(!sb)return;bindToggles(V);cpf.onsubmit=async e=>{e.preventDefault();cpe.className='aerr';cpe.textContent='';
  if(cpn.value.length<MIN_PW)return cpe.textContent=`New password must be at least ${MIN_PW} characters.`;
  if(cpn.value!==cpn2.value)return cpe.textContent='New passwords don’t match.';
  cps.disabled=true;const {error}=await sb.auth.updateUser({password:cpn.value});cps.disabled=false;
  if(error)return cpe.textContent=errText(error);cpf.reset();cpe.className='aok';cpe.textContent='Password changed. Use the new password on your other devices too.'}};
logoutBtn.onclick=async()=>{logoutBtn.disabled=true;try{await Sync.flush();if(sb)await sb.auth.signOut({scope:'local'});else{const st=storedSession();if(st)localStorage.removeItem(st.key)}}catch{}
 logoutBtn.disabled=false;if(unlocked)lock()};
// start
if(!CONFIGURED)showMsg('Online sign-in isn’t set up yet','The Supabase project URL and key still need to be added to <b>config.js</b>. Your inventory on this device is safe and will sync once it’s set up.');
else if(!(window.supabase&&window.supabase.createClient)){const st=storedSession();if(st)unlock(st.user,null);else showMsg('Can’t reach the sign-in service','Check your internet connection, then try again.',true)}
else{sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{flowType:'implicit',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 sb.auth.onAuthStateChange((ev,session)=>setTimeout(()=>onAuth(ev,session),0))} // setTimeout: don't call Supabase from inside its own callback
