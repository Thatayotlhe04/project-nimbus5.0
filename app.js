// app.js (ESM)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "XXXX",
  appId: "1:XXXX:web:YYYY"
};
initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

const $ = (s, el=document)=>el.querySelector(s);
const authCard = $('#authCard'), dashCard = $('#dashCard');
const loginForm = $('#loginForm'), email=$('#email'), password=$('#password');
const demoLogin = $('#demoLogin'), forgotBtn=$('#forgotBtn'), signUpBtn=$('#goToSignUp');
const logoutBtn = $('#logoutBtn'); const activityList = $('#activityList'); const balanceNum = $('#balanceNum');
const toast = $('#toast'), dialog = $('#flowDialog'), flowTitle=$('#flowTitle'), flowBody=$('#flowBody'), flowSubmit=$('#flowSubmit');

function show(view){ view==='dashboard'? (authCard.classList.add('hidden'), dashCard.classList.remove('hidden')) : (dashCard.classList.add('hidden'), authCard.classList.remove('hidden')); }
function notify(m){ toast.textContent=m; toast.hidden=false; setTimeout(()=>toast.hidden=true,2000); }
function setDate(){ const d=new Date(); $('#dow').textContent=d.toLocaleDateString(undefined,{weekday:"short"}); const n=d.getDate(); $('#dom').innerHTML=`${n}<span class="th">${['th','st','nd','rd'][((n%100-20)%10)]||(['th','st','nd','rd'][n%10])||'th'}</span>`;}
setDate();

// ---- Auth ----
loginForm.addEventListener('submit', async (e)=>{e.preventDefault(); await signInWithEmailAndPassword(auth, email.value, password.value).catch(e=>notify(e.message));});
demoLogin.addEventListener('click', async ()=>{ await createUserWithEmailAndPassword(auth, "demo@pulapay.dev", "pulapay").catch(()=>{}); await signInWithEmailAndPassword(auth, "demo@pulapay.dev", "pulapay"); });
forgotBtn.addEventListener('click', ()=> email.value? sendPasswordResetEmail(auth, email.value).then(()=>notify('Reset email sent')).catch(e=>notify(e.message)) : notify('Enter email first'));
logoutBtn.addEventListener('click', ()=>signOut(auth));

onAuthStateChanged(auth, async (user)=>{
  if(!user){ show('auth'); return; }
  show('dashboard');
  // live wallet updates
  const walletRef = doc(db, 'wallets', user.uid);
  onSnapshot(walletRef, snap=>{
    const data=snap.data()||{balance:0};
    balanceNum.textContent = Number(data.balance||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  });
  fetchActivity();
});

// ---- Activity ----
async function fetchActivity(){
  const token = await auth.currentUser.getIdToken();
  const r = await fetch('/api/activity', { headers:{ Authorization: `Bearer ${token}` }});
  const list = await r.json();
  activityList.innerHTML = list.map(a => `<li><div><div class="who">${a.who}</div><div class="caption">${a.when}</div></div><div class="amt">${a.amt<0?'-':''}P${Math.abs(a.amt).toFixed(2)}</div></li>`).join('');
}

// ---- Actions ----
document.querySelectorAll('.chip, .tile.action').forEach(el=>el.addEventListener('click',()=>openFlow(el.dataset.action)));
function openFlow(type){
  flowBody.innerHTML=''; dialog.showModal();
  const set=(t,html,submit)=>{flowTitle.textContent=t; flowBody.innerHTML=html; flowSubmit.onclick=submit;}
  if(type==='send') set('Send money', `
    <label>Recipient<input id="to" placeholder="Phone / email / student ID" required></label>
    <label>Amount (P)<input id="amt" type="number" step="0.01" min="1" required></label>`, doSend);
  if(type==='request') set('Request money', `
    <label>From<input id="from" placeholder="Phone / email / student ID" required></label>
    <label>Amount (P)<input id="amt" type="number" step="0.01" min="1" required></label>`, ()=>{notify('Request sent (demo)'); dialog.close();});
  if(type==='tuition') set('Pay tuition', `
    <label>Institution<select id="uni"><option>University of Botswana</option><option>BIUST</option></select></label>
    <label>Student ID<input id="sid" placeholder="2025-12345" required></label>
    <label>Amount (P)<input id="amt" type="number" min="100" value="2500" required></label>`, doTuition);
  if(type==='rent') set('Pay rent', `
    <label>Landlord / Agent<input id="landlord" placeholder="Block 10 Apartments" required></label>
    <label>Unit / Ref<input id="ref" placeholder="A-12" required></label>
    <label>Amount (P)<input id="amt" type="number" min="100" value="1800" required></label>`, doRent);
}

async function authedFetch(path, body){
  const token = await auth.currentUser.getIdToken();
  const r = await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});
  const j = await r.json(); if(!r.ok) throw new Error(j.error||'Request failed'); return j;
}
async function doSend(){ try{ const j=await authedFetch('/api/send',{to:$('#to').value,amt:Number($('#amt').value)}); notify('Sent ✔'); dialog.close(); fetchActivity(); }catch(e){ notify(e.message); } }
async function doTuition(){ try{ const j=await authedFetch('/api/tuition',{uni:$('#uni').value,sid:$('#sid').value,amt:Number($('#amt').value)}); notify('Tuition paid ✔'); dialog.close(); fetchActivity(); }catch(e){ notify(e.message); } }
async function doRent(){ try{ const j=await authedFetch('/api/rent',{landlord:$('#landlord').value,ref:$('#ref').value,amt:Number($('#amt').value)}); notify('Rent paid ✔'); dialog.close(); fetchActivity(); }catch(e){ notify(e.message); } }