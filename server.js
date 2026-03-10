const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 9890;
const uploadDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const adminEmail = process.env.DEEPKEEL_ADMIN_EMAIL || 'admin@example.com';
const adminPassword = process.env.DEEPKEEL_ADMIN_PASSWORD || 'change-me';

app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'deepkeel-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 12 }
}));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadDir),
    filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`)
  })
});

const surveySections = [
  ['Hull Exterior', 20],
  ['Deck & Superstructure', 20],
  ['Keel & Rudder', 15],
  ['Rigging', 20],
  ['Engine & Mechanical', 20],
  ['Electrical, Safety & Plumbing', 25]
];

const buildChecklist = () => {
  const arr = [];
  let n = 1;
  for (const [section, count] of surveySections) {
    for (let i = 0; i < count; i++) {
      arr.push({ id: n, section, title: `${section} check #${i + 1}`, rating: 'OK', notes: '', photos: [] });
      n++;
    }
  }
  return arr;
};

const shell = (title, body) => `<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>${title}</title><style>
body{font-family:Inter,system-ui,sans-serif;background:#f3f8f5;color:#10231b;margin:0}
.wrap{max-width:1100px;margin:0 auto;padding:20px}
.card{background:#fff;border:1px solid #d8e6de;border-radius:14px;padding:16px;margin:12px 0}
.btn{display:inline-block;background:#2ea36b;color:#fff;padding:10px 14px;border-radius:9px;text-decoration:none;border:0;cursor:pointer}
.btn.alt{background:#fff;color:#2ea36b;border:1px solid #9ecfb7}
input,textarea,select{width:100%;padding:9px;border:1px solid #d8e6de;border-radius:8px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px} table{width:100%;border-collapse:collapse} th,td{padding:8px;border-bottom:1px solid #edf3ef;text-align:left}
@media(max-width:900px){.grid{grid-template-columns:1fr}}
</style></head><body><div class='wrap'>${body}</div></body></html>`;

const auth = (req, res, next) => req.session.user ? next() : res.redirect('/login');

app.get('/', (req, res) => {
  res.send(shell('DeepKeel Survey', `
    <div class='card'>
      <h1>DeepKeel Survey</h1>
      <p>Professional sailboat self-survey + negotiation workflow for buyers.</p>
      <p><a class='btn' href='${req.session.user ? '/app' : '/login'}'>${req.session.user ? 'Open App' : 'Login'}</a></p>
    </div>
  `));
});

app.get('/login', (req, res) => {
  res.send(shell('Login', `
    <div class='card'>
      <h2>Login</h2>
      <form method='post' action='/login'>
        <p><label>Email</label><input type='email' name='email' required></p>
        <p><label>Password</label><input type='password' name='password' required></p>
        <p><button class='btn' type='submit'>Login</button></p>
      </form>
    </div>
  `));
});

app.post('/login', (req, res) => {
  if ((req.body.email || '').trim().toLowerCase() === adminEmail.toLowerCase() && (req.body.password || '') === adminPassword) {
    req.session.user = { email: adminEmail };
    req.session.survey = req.session.survey || {
      vessel: { name: '', model: '', year: '', location: '', seller: '', askPrice: '' },
      checklist: buildChecklist(),
      marketValue: '', repairs: '', contingencyPct: '20', discountPct: '7'
    };
    return res.redirect('/app');
  }
  res.status(401).send(shell('Login failed', `<div class='card'><p>Invalid credentials.</p><p><a class='btn alt' href='/login'>Try again</a></p></div>`));
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

app.get('/app', auth, (req, res) => {
  const s = req.session.survey;
  const critical = s.checklist.filter(i => i.rating === 'Critical').length;
  const moderate = s.checklist.filter(i => i.rating === 'Moderate').length;
  const score = Math.max(0, 100 - (critical * 5 + moderate * 2));
  res.send(shell('DeepKeel Dashboard', `
    <div class='card'>
      <h1>DeepKeel Survey Dashboard</h1>
      <p>Boat Condition Index (BCI): <strong>${score}/100</strong></p>
      <p>Critical: ${critical} • Moderate: ${moderate}</p>
      <p><a class='btn' href='/survey/vessel'>Vessel Info</a> <a class='btn alt' href='/survey/checklist'>Checklist (120)</a> <a class='btn alt' href='/survey/negotiation'>Negotiation</a> <a class='btn alt' href='/survey/report'>Report</a> <a class='btn alt' href='/logout'>Logout</a></p>
    </div>
  `));
});

app.get('/survey/vessel', auth, (req, res) => {
  const v = req.session.survey.vessel;
  res.send(shell('Vessel Info', `
    <div class='card'><h2>Vessel Information</h2>
      <form method='post' action='/survey/vessel' class='grid'>
        <p><label>Boat Name</label><input name='name' value='${v.name || ''}'></p>
        <p><label>Model</label><input name='model' value='${v.model || ''}'></p>
        <p><label>Year</label><input name='year' value='${v.year || ''}'></p>
        <p><label>Location</label><input name='location' value='${v.location || ''}'></p>
        <p><label>Seller</label><input name='seller' value='${v.seller || ''}'></p>
        <p><label>Asking Price (€)</label><input name='askPrice' value='${v.askPrice || ''}'></p>
        <p style='grid-column:1/-1'><button class='btn'>Save</button> <a class='btn alt' href='/app'>Back</a></p>
      </form>
    </div>
  `));
});

app.post('/survey/vessel', auth, (req, res) => {
  Object.assign(req.session.survey.vessel, req.body);
  res.redirect('/survey/vessel');
});

app.get('/survey/checklist', auth, (req, res) => {
  const rows = req.session.survey.checklist.map(i => `<tr><td>${i.id}</td><td>${i.section}</td><td>${i.title}</td><td>${i.rating}</td><td>${i.notes || ''}</td></tr>`).join('');
  res.send(shell('Checklist', `
    <div class='card'>
      <h2>120-Point Checklist</h2>
      <form method='post' action='/survey/checklist/rate' class='grid'>
        <p><label>Item ID</label><input name='id' type='number' min='1' max='120' required></p>
        <p><label>Rating</label><select name='rating'><option>OK</option><option>Minor</option><option>Moderate</option><option>Critical</option></select></p>
        <p style='grid-column:1/-1'><label>Notes</label><textarea name='notes'></textarea></p>
        <p><button class='btn'>Update Item</button> <a class='btn alt' href='/app'>Back</a></p>
      </form>
    </div>
    <div class='card'><table><thead><tr><th>ID</th><th>Section</th><th>Item</th><th>Rating</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table></div>
  `));
});

app.post('/survey/checklist/rate', auth, (req, res) => {
  const id = Number(req.body.id || 0);
  const row = req.session.survey.checklist.find(x => x.id === id);
  if (row) {
    row.rating = req.body.rating || 'OK';
    row.notes = req.body.notes || '';
  }
  res.redirect('/survey/checklist');
});

app.get('/survey/negotiation', auth, (req, res) => {
  const s = req.session.survey;
  const crit = s.checklist.filter(i => i.rating === 'Critical').length;
  const mod = s.checklist.filter(i => i.rating === 'Moderate').length;
  const bci = Math.max(0, 100 - (crit * 5 + mod * 2));
  const mv = Number(s.marketValue || 0);
  const condAdj = mv * (1 - (100 - bci) / 100);
  const repairs = Number(s.repairs || 0);
  const cont = repairs * (Number(s.contingencyPct || 0) / 100);
  const afterRepairs = Math.max(0, condAdj - repairs - cont);
  const final = Math.max(0, afterRepairs * (1 - Number(s.discountPct || 0) / 100));
  res.send(shell('Negotiation Calculator', `
    <div class='card'><h2>Negotiation Calculator</h2>
      <form method='post' action='/survey/negotiation' class='grid'>
        <p><label>Market Value (€)</label><input name='marketValue' value='${s.marketValue || ''}'></p>
        <p><label>Estimated Repairs (€)</label><input name='repairs' value='${s.repairs || ''}'></p>
        <p><label>Contingency %</label><input name='contingencyPct' value='${s.contingencyPct || '20'}'></p>
        <p><label>Opportunity Discount %</label><input name='discountPct' value='${s.discountPct || '7'}'></p>
        <p><button class='btn'>Calculate</button> <a class='btn alt' href='/app'>Back</a></p>
      </form>
      <hr>
      <p>BCI: <strong>${bci}</strong></p>
      <p>Adjusted value: <strong>€${condAdj.toFixed(0)}</strong></p>
      <p>After repairs + contingency: <strong>€${afterRepairs.toFixed(0)}</strong></p>
      <p>Final offer suggestion: <strong>€${final.toFixed(0)}</strong></p>
    </div>
  `));
});

app.post('/survey/negotiation', auth, (req, res) => {
  Object.assign(req.session.survey, req.body);
  res.redirect('/survey/negotiation');
});

app.get('/survey/report', auth, (req, res) => {
  const s = req.session.survey;
  const crit = s.checklist.filter(i => i.rating === 'Critical');
  const mod = s.checklist.filter(i => i.rating === 'Moderate');
  const bci = Math.max(0, 100 - (crit.length * 5 + mod.length * 2));
  const html = `
    <h1>DeepKeel Survey Report</h1>
    <p><strong>Boat:</strong> ${s.vessel.name || '-'} | ${s.vessel.model || '-'} (${s.vessel.year || '-'})</p>
    <p><strong>Location:</strong> ${s.vessel.location || '-'} | <strong>Seller:</strong> ${s.vessel.seller || '-'}</p>
    <p><strong>BCI:</strong> ${bci}/100</p>
    <h3>Critical Findings (${crit.length})</h3>
    <ul>${crit.map(i => `<li>#${i.id} ${i.title} — ${i.notes || 'No notes'}</li>`).join('')}</ul>
    <h3>Moderate Findings (${mod.length})</h3>
    <ul>${mod.map(i => `<li>#${i.id} ${i.title} — ${i.notes || 'No notes'}</li>`).join('')}</ul>
    <p><strong>Recommendation:</strong> Proceed only after resolving critical safety/structural issues.</p>
  `;
  res.send(shell('Survey Report', `<div class='card'>${html}<p><a class='btn alt' href='/app'>Back</a></p></div>`));
});

app.get('/health', (_, res) => res.json({ ok: true, app: 'deepkeel' }));

app.listen(port, () => console.log(`DeepKeel listening on ${port}`));
