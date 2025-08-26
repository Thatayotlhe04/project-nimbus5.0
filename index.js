import functions from 'firebase-functions';
import admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(async (req, res, next) => {
  // Verify Firebase ID token
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.split('Bearer ')[1] : null;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
});

async function getWallet(uid){
  const ref = db.collection('wallets').doc(uid);
  const snap = await ref.get();
  if(!snap.exists){ await ref.set({ balance: 5000 }); return { balance: 5000 }; }
  return snap.data();
}
async function addActivity(uid, item){
  const ref = db.collection('wallets').doc(uid).collection('activity');
  await ref.add({ ...item, ts: admin.firestore.FieldValue.serverTimestamp() });
}
async function setBalance(uid, balance){
  await db.collection('wallets').doc(uid).set({ balance }, { merge: true });
}

app.get('/activity', async (req,res)=>{
  const uid = req.user.uid;
  const ref = db.collection('wallets').doc(uid).collection('activity').orderBy('ts','desc').limit(20);
  const out = [];
  (await ref.get()).forEach(d => out.push(d.data()));
  res.json(out);
});

app.post('/send', async (req,res)=>{
  const uid = req.user.uid;
  const { to, amt } = req.body;
  if(!to || !amt || amt<=0) return res.status(400).json({ error: 'Invalid input' });
  const w = await getWallet(uid);
  if(amt > w.balance) return res.status(400).json({ error: 'Insufficient funds' });
  await setBalance(uid, w.balance - amt);
  await addActivity(uid, { who:`To ${to}`, amt:-amt, when:'Now' });
  // TODO: integrate payout via Flutterwave transfer API (test mode)
  res.json({ ok: true });
});

app.post('/tuition', async (req,res)=>{
  const uid = req.user.uid;
  const { uni, sid, amt } = req.body;
  if(!uni || !sid || !amt || amt<=0) return res.status(400).json({ error: 'Invalid input' });
  const w = await getWallet(uid);
  if(amt > w.balance) return res.status(400).json({ error: 'Insufficient funds' });
  await setBalance(uid, w.balance - amt);
  await addActivity(uid, { who:`Tuition • ${uni}`, amt:-amt, when:'Now' });

  // Example Flutterwave (pseudo) — use TEST keys!
  // const r = await fetch('https://api.flutterwave.com/v3/transfers', {
  //   method:'POST',
  //   headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${process.env.FLW_SECRET}` },
  //   body: JSON.stringify({ amount: amt, currency:'BWP', destination_branch_code:'', reference:`tuition-${uid}-${Date.now()}` })
  // });
  // const j = await r.json();

  res.json({ ok: true });
});

app.post('/rent', async (req,res)=>{
  const uid = req.user.uid;
  const { landlord, ref, amt } = req.body;
  if(!landlord || !ref || !amt || amt<=0) return res.status(400).json({ error: 'Invalid input' });
  const w = await getWallet(uid);
  if(amt > w.balance) return res.status(400).json({ error: 'Insufficient funds' });
  await setBalance(uid, w.balance - amt);
  await addActivity(uid, { who:`Rent • ${ref}`, amt:-amt, when:'Now' });
  res.json({ ok: true });
});

export const api = functions.region('europe-west1').https.onRequest(app);
