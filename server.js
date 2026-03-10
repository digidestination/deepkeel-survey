const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 9890;
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const adminEmail = process.env.DEEPKEEL_ADMIN_EMAIL || 'admin@example.com';
const adminPassword = process.env.DEEPKEEL_ADMIN_PASSWORD || 'change-me';

app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));
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

const checklistSeed = [
  ['Hull Exterior', [
    'Gelcoat condition','Osmosis blisters','Hull laminate cracks','Hull fairness','Previous fiberglass repairs',
    'Impact damage','Through hull fittings','Skin fitting corrosion','Hull deck joint','Hull moisture readings',
    'Bow impact zone','Stern corners','Boot stripe condition','Antifouling condition','Keel area fairing',
    'Waterline uniformity','Hull sound test','Seacock backing pads','Hull vents condition','Transom integrity'
  ]],
  ['Deck & Superstructure', [
    'Deck soft spots','Deck delamination','Non-slip condition','Chainplates deck entry','Deck cracks around fittings',
    'Hatches and seals','Windows leaks','Stanchion bases','Lifelines condition','Cockpit drainage',
    'Companionway integrity','Coachroof cracks','Winch base support','Cleat backing plates','Anchor locker condition',
    'Bow roller attachment','Pulpit attachment','Mast collar seal','Traveler track condition','Cockpit sole structure'
  ]],
  ['Keel & Rudder', [
    'Keel bolts corrosion','Keel stub cracks','Keel-hull joint gap','Rust streaks around keel bolts','Grounding evidence',
    'Rudder play','Rudder laminate cracks','Rudder moisture','Rudder stock straightness','Rudder bearings wear',
    'Quadrant condition','Emergency tiller fit','Steering cables','Autopilot ram mounts','Rudder stops integrity'
  ]],
  ['Rigging', [
    'Standing rigging age','Shroud wire corrosion','Turnbuckles condition','Chainplates interior','Mast corrosion',
    'Spreaders alignment','Boom condition','Running rigging wear','Halyard sheaves','Mast step corrosion',
    'Forestay terminal','Backstay adjuster','Gooseneck wear','Vang mounts','Winch operation',
    'Mast wiring integrity','Navigation lights masthead','Deck organizers','Blocks and clutches','Sail track condition'
  ]],
  ['Engine & Mechanical', [
    'Engine cold start','Oil leaks','Cooling flow','Exhaust smoke','Fuel lines condition',
    'Engine mounts','Shaft alignment','Propeller condition','Cutlass bearing play','Transmission shifting',
    'Alternator charging','Belts condition','Raw water pump','Heat exchanger condition','Engine hours plausibility',
    'Throttle response','Stop control','Seawater strainer','Fuel tank contamination','Vibration under load'
  ]],
  ['Electrical, Safety & Plumbing', [
    'Battery voltage and age','Shore power inlet','AC panel condition','DC panel labeling','Wiring quality',
    'Bilge pumps auto/manual','Freshwater pressure','Water leaks in plumbing','Marine toilet operation','Seacocks operation',
    'Gas system check','Fire extinguishers valid','Lifejackets count','Navigation electronics test','VHF radio test',
    'AIS/GPS test','Cabin leak signs','Mold and ventilation','Bulkhead bonding','Compression post',
    'Cabin sole soft spots','Emergency gear inventory','Anchor + chain condition','Windlass operation','Deck lights + interior lights'
  ]]
];

const buildChecklist = () => {
  const out = [];
  let id = 1;
  for (const [section, items] of checklistSeed) {
    for (const title of items) out.push({ id: id++, section, title, rating: 'OK', notes: '', photos: [] });
  }
  return out;
};

const shell = (title, body) => `<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>${title}</title><style>
body{font-family:Inter,system-ui,sans-serif;background:#f3f8f5;color:#10231b;margin:0}.wrap{max-width:1100px;margin:0 auto;padding:20px}
.card{background:#fff;border:1px solid #d8e6de;border-radius:14px;padding:16px;margin:12px 0}.btn{display:inline-block;background:#2ea36b;color:#fff;padding:10px 14px;border-radius:9px;text-decoration:none;border:0;cursor:pointer}
.btn.alt{background:#fff;color:#2ea36b;border:1px solid #9ecfb7}input,textarea,select{width:100%;padding:9px;border:1px solid #d8e6de;border-radius:8px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #edf3ef;text-align:left}
.badge{padding:2px 8px;border-radius:999px;background:#eaf6ef}.small{font-size:12px;color:#5a7168}
@media(max-width:900px){.grid{grid-template-columns:1fr}}
</style></head><body><div class='wrap'>${body}</div></body></html>`;

const auth = (req, res, next) => req.session.user ? next() : res.redirect('/login');
const ensureSurvey = (req) => {
  if (!req.session.survey) req.session.survey = {
    vessel: { name: '', model: '', year: '', location: '', seller: '', askPrice: '' },
    checklist: buildChecklist(),
    marketValue: '', repairs: '', contingencyPct: '20', discountPct: '7'
  };
};

app.get('/', (req, res) => res.send(shell('DeepKeel Survey', `<div class='card'><h1>DeepKeel Survey</h1><p>Professional sailboat self-survey and negotiation system.</p><p><a class='btn' href='${req.session.user ? '/app' : '/login'}'>${req.session.user ? 'Open App' : 'Login'}</a></p></div>`)));

app.get('/login', (_, res) => res.send(shell('Login', `<div class='card'><h2>Login</h2><form method='post' action='/login'><p><label>Email</label><input type='email' name='email' required></p><p><label>Password</label><input type='password' name='password' required></p><p><button class='btn' type='submit'>Login</button></p></form></div>`)));

app.post('/login', (req, res) => {
  if ((req.body.email || '').trim().toLowerCase() === adminEmail.toLowerCase() && (req.body.password || '') === adminPassword) {
    req.session.user = { email: adminEmail };
    ensureSurvey(req);
    return res.redirect('/app');
  }
  res.status(401).send(shell('Login failed', `<div class='card'><p>Invalid credentials.</p><p><a class='btn alt' href='/login'>Try again</a></p></div>`));
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

app.get('/app', auth, (req, res) => {
  ensureSurvey(req);
  const s = req.session.survey;
  const critical = s.checklist.filter(i => i.rating === 'Critical').length;
  const moderate = s.checklist.filter(i => i.rating === 'Moderate').length;
  const bci = Math.max(0, 100 - (critical * 5 + moderate * 2));
  res.send(shell('Dashboard', `<div class='card'><h1>DeepKeel Dashboard</h1><p>BCI: <strong>${bci}/100</strong> • Critical: ${critical} • Moderate: ${moderate}</p><p><a class='btn' href='/survey/vessel'>Vessel Info</a> <a class='btn alt' href='/survey/checklist'>Checklist</a> <a class='btn alt' href='/survey/negotiation'>Negotiation</a> <a class='btn alt' href='/survey/report?print=1'>Printable report</a> <a class='btn alt' href='/logout'>Logout</a></p></div>`));
});

app.get('/survey/vessel', auth, (req, res) => {
  ensureSurvey(req);
  const v = req.session.survey.vessel;
  res.send(shell('Vessel', `<div class='card'><h2>Vessel Information</h2><form method='post' action='/survey/vessel' class='grid'><p><label>Boat Name</label><input name='name' value='${v.name || ''}'></p><p><label>Model</label><input name='model' value='${v.model || ''}'></p><p><label>Year</label><input name='year' value='${v.year || ''}'></p><p><label>Location</label><input name='location' value='${v.location || ''}'></p><p><label>Seller</label><input name='seller' value='${v.seller || ''}'></p><p><label>Asking Price (€)</label><input name='askPrice' value='${v.askPrice || ''}'></p><p style='grid-column:1/-1'><button class='btn'>Save</button> <a class='btn alt' href='/app'>Back</a></p></form></div>`));
});
app.post('/survey/vessel', auth, (req, res) => { ensureSurvey(req); Object.assign(req.session.survey.vessel, req.body); res.redirect('/survey/vessel'); });

app.get('/survey/checklist', auth, (req, res) => {
  ensureSurvey(req);
  const rows = req.session.survey.checklist.map(i => `<tr><td>${i.id}</td><td>${i.section}</td><td>${i.title}<div class='small'>${(i.photos||[]).length} photo(s)</div></td><td><span class='badge'>${i.rating}</span></td><td>${i.notes || ''}</td></tr>`).join('');
  res.send(shell('Checklist', `
    <div class='card'>
      <h2>120-Point Checklist</h2>
      <form method='post' action='/survey/checklist/rate' class='grid'>
        <p><label>Item ID</label><input name='id' type='number' min='1' max='120' required></p>
        <p><label>Rating</label><select name='rating'><option>OK</option><option>Minor</option><option>Moderate</option><option>Critical</option></select></p>
        <p style='grid-column:1/-1'><label>Notes</label><textarea name='notes'></textarea></p>
        <p><button class='btn'>Update</button></p>
      </form>
      <hr>
      <form method='post' action='/survey/checklist/photo' enctype='multipart/form-data' class='grid'>
        <p><label>Item ID for Photo</label><input name='id' type='number' min='1' max='120' required></p>
        <p><label>Photo</label><input type='file' name='photo' accept='image/*' required></p>
        <p><button class='btn alt'>Upload Photo to Item</button></p>
      </form>
      <p class='small'>Offline-first: checklist rating/notes forms auto-draft in browser localStorage.</p>
      <p><a class='btn alt' href='/app'>Back</a></p>
    </div>
    <div class='card'><table><thead><tr><th>ID</th><th>Section</th><th>Item</th><th>Rating</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table></div>
    <script>
      const form = document.querySelector("form[action='/survey/checklist/rate']");
      const key = 'deepkeel-checklist-draft';
      const saved = localStorage.getItem(key);
      if (saved) {
        try { const d = JSON.parse(saved); ['id','rating','notes'].forEach(k => { if (d[k]) form.elements[k].value = d[k]; }); } catch(e) {}
      }
      form.addEventListener('input', () => {
        const d = { id: form.elements.id.value, rating: form.elements.rating.value, notes: form.elements.notes.value };
        localStorage.setItem(key, JSON.stringify(d));
      });
      form.addEventListener('submit', () => localStorage.removeItem(key));
    </script>
  `));
});

app.post('/survey/checklist/rate', auth, (req, res) => {
  ensureSurvey(req);
  const id = Number(req.body.id || 0);
  const row = req.session.survey.checklist.find(x => x.id === id);
  if (row) { row.rating = req.body.rating || 'OK'; row.notes = req.body.notes || ''; }
  res.redirect('/survey/checklist');
});

app.post('/survey/checklist/photo', auth, upload.single('photo'), (req, res) => {
  ensureSurvey(req);
  const id = Number(req.body.id || 0);
  const row = req.session.survey.checklist.find(x => x.id === id);
  if (row && req.file) row.photos.push(`/uploads/${req.file.filename}`);
  res.redirect('/survey/checklist');
});

app.get('/survey/negotiation', auth, (req, res) => {
  ensureSurvey(req);
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
  res.send(shell('Negotiation', `<div class='card'><h2>Negotiation Calculator</h2><form method='post' action='/survey/negotiation' class='grid'><p><label>Market Value (€)</label><input name='marketValue' value='${s.marketValue || ''}'></p><p><label>Estimated Repairs (€)</label><input name='repairs' value='${s.repairs || ''}'></p><p><label>Contingency %</label><input name='contingencyPct' value='${s.contingencyPct || '20'}'></p><p><label>Opportunity Discount %</label><input name='discountPct' value='${s.discountPct || '7'}'></p><p><button class='btn'>Calculate</button> <a class='btn alt' href='/app'>Back</a></p></form><hr><p>BCI: <strong>${bci}</strong></p><p>Adjusted value: <strong>€${condAdj.toFixed(0)}</strong></p><p>After repairs + contingency: <strong>€${afterRepairs.toFixed(0)}</strong></p><p>Final offer suggestion: <strong>€${final.toFixed(0)}</strong></p></div>`));
});
app.post('/survey/negotiation', auth, (req, res) => { ensureSurvey(req); Object.assign(req.session.survey, req.body); res.redirect('/survey/negotiation'); });

app.get('/survey/report', auth, (req, res) => {
  ensureSurvey(req);
  const s = req.session.survey;
  const crit = s.checklist.filter(i => i.rating === 'Critical');
  const mod = s.checklist.filter(i => i.rating === 'Moderate');
  const bci = Math.max(0, 100 - (crit.length * 5 + mod.length * 2));
  const printMode = req.query.print === '1';
  const photos = s.checklist.filter(i => (i.photos || []).length).slice(0, 12);
  const content = `
    <h1>DeepKeel Survey Report</h1>
    <p><strong>Boat:</strong> ${s.vessel.name || '-'} | ${s.vessel.model || '-'} (${s.vessel.year || '-'})</p>
    <p><strong>Location:</strong> ${s.vessel.location || '-'} | <strong>Seller:</strong> ${s.vessel.seller || '-'}</p>
    <p><strong>BCI:</strong> ${bci}/100</p>
    <h3>Critical Findings (${crit.length})</h3><ul>${crit.map(i => `<li>#${i.id} ${i.title} — ${i.notes || 'No notes'}</li>`).join('')}</ul>
    <h3>Moderate Findings (${mod.length})</h3><ul>${mod.map(i => `<li>#${i.id} ${i.title} — ${i.notes || 'No notes'}</li>`).join('')}</ul>
    <h3>Photo Evidence</h3>${photos.map(i => `<p><strong>#${i.id} ${i.title}</strong></p>${i.photos.map(ph => `<img src='${ph}' style='max-width:220px;margin:6px;border:1px solid #dbe8e1'>`).join('')}`).join('')}
    <p><strong>Recommendation:</strong> Proceed after resolving critical structural/safety items.</p>
    ${printMode ? `<script>window.print()</script>` : `<p><a class='btn' href='/survey/report?print=1'>Print / Save as PDF</a> <a class='btn alt' href='/app'>Back</a></p>`}
  `;
  res.send(shell('Report', `<div class='card'>${content}</div>`));
});

app.get('/health', (_, res) => res.json({ ok: true, app: 'deepkeel' }));
app.listen(port, () => console.log(`DeepKeel listening on ${port}`));
