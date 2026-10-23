const $ = (s) => document.querySelector(s);
const wall = $('#wall'), countEl = $('#count'), nameEl = $('#name');
const clearBtn = $('#clearBtn'), lightBtn = $('#lightBtn'), toastEl = $('#toast'), modeEl = $('#mode');

const CFG = window.WALL_CONFIG || {};
(function applyConfig(){
  const set = (id, t) => { if (t != null) $(id).textContent = t; };
  set('#title', CFG.title); set('#tagline', CFG.tagline);
  set('#lead', CFG.lead); set('#blessing', CFG.blessing);
  if (CFG.title) document.title = CFG.title;
  if (CFG.placeholder) nameEl.placeholder = CFG.placeholder;
})();

let diyas = [], wallLit = false, prevLit = false, firstRender = true, offset = 0, cdTimer = null;
const known = new Set();
let hostCode = localStorage.getItem('hostCode') || '', hostName = '', lighters = 'the hosts';

/* ---------- fairy lights ---------- */
(function lights(){
  const box = $('#lights'), colors = ['#ffb52e','#ff5a8a','#ffe27a','#ff7a1a','#c77dff','#7dffb2'];
  const n = Math.max(14, Math.floor(innerWidth / 55));
  for (let k = 0; k < n; k++){
    const x = k / (n - 1), i = document.createElement('i');
    i.style.left = `calc(${x*100}% - 6px)`;
    i.style.top = `${18 + Math.sin(x * Math.PI * 4) * 12 + Math.sin(x*Math.PI)*6}px`;
    i.style.setProperty('--c', colors[k % colors.length]);
    i.style.setProperty('--d', `${(k % 6) * -.4}s`);
    box.appendChild(i);
  }
})();

/* ---------- diya markup ---------- */
function diyaEl(d, ghost = false){
  const el = document.createElement('div');
  el.className = 'diya' + (ghost ? ' ghosty' : '');
  el.dataset.id = d ? d.id : 'ghost';
  el.innerHTML = `
    <div class="glow"></div>
    <svg viewBox="0 0 120 100" aria-hidden="true">
      <g class="flame">
        <path d="M60 4C74 22 76 36 67 45C63 49 57 49 53 45C44 36 46 22 60 4Z" fill="url(#flameOuter)"/>
        <path d="M60 22C66 31 66 40 60 46C54 40 54 31 60 22Z" fill="#fff6c8"/>
      </g>
      <rect class="wick" x="57.5" y="42" width="5" height="12" rx="2" fill="#6a4a2a"/>
      <path d="M6 52Q-6 44 2 36Q12 42 18 53Z" fill="url(#rim)"/>
      <path d="M8 52Q8 92 60 92Q112 92 112 52Z" fill="url(#bowl)"/>
      <ellipse cx="60" cy="52" rx="52" ry="9" fill="url(#rim)"/>
      <ellipse cx="60" cy="53" rx="44" ry="6" fill="url(#oil)"/>
      <path d="M22 70Q60 84 98 70" stroke="#ffe9a0" stroke-width="2" fill="none" stroke-dasharray="1 6" stroke-linecap="round"/>
      <path d="M30 78Q60 90 90 78" stroke="#8a3d0c" stroke-width="1.5" fill="none" opacity=".5"/>
      <ellipse cx="60" cy="94" rx="24" ry="5" fill="#8a3d0c"/>
    </svg>
    <span class="tag"></span>`;
  el.querySelector('.tag').textContent = d ? d.name : 'Your diya';
  if (d) el.title = d.name;
  return el;
}

/* ---------- render ---------- */
function render(){
  const ids = new Set(diyas.map(d => d.id));
  [...wall.querySelectorAll('.diya:not(.ghosty)')].forEach(el => { if (!ids.has(el.dataset.id)) el.remove(); });
  known.forEach(id => { if (!ids.has(id)) known.delete(id); });

  const ghost = wall.querySelector('.ghosty');
  if (!diyas.length){ if (!ghost) wall.appendChild(diyaEl(null, true)); } else if (ghost) ghost.remove();

  const n = diyas.length;
  wall.classList.toggle('dense', n > 10);
  wall.classList.toggle('tiny', n > 36);

  // new diyas
  diyas.forEach(d => {
    if (known.has(d.id)) return;
    known.add(d.id);
    const el = diyaEl(d); wall.appendChild(el);
    if (firstRender){ if (wallLit) el.classList.add('lit'); return; }
    el.classList.add('enter');
    setTimeout(() => { const q = el.querySelector('svg').getBoundingClientRect(); if (q.bottom > 0 && q.top < innerHeight) launchRocket(q.left + q.width/2, q.top + q.height*.4, rnd(innerHeight*.1, innerHeight*.4)); }, 250);
    if (wallLit) setTimeout(() => { el.classList.add('lit'); burst(el, 24); }, 450);   // wall already lit: ignite right away
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // the big moment: every diya ignites at the same instant
  const all = [...wall.querySelectorAll('.diya:not(.ghosty)')];
  if (wallLit && !prevLit){ all.forEach(el => el.classList.add('lit')); if (!firstRender) celebrate(all); }
  if (!wallLit) all.forEach(el => el.classList.remove('lit'));
  prevLit = wallLit;
  firstRender = false;

  countEl.textContent = n === 0 ? 'No diyas yet. Be the first to add yours!'
    : wallLit ? (n === 1 ? '✨ 1 diya glowing' : `✨ ${n} diyas glowing together`)
    : `🪔 ${n} ${n === 1 ? 'diya is' : 'diyas are'} ready. Waiting for ${lighters} to light them all…`;
  $('#lightLbl').textContent = wallLit ? (CFG.lightButton || 'Light my diya') : (CFG.addButton || 'Add my diya');
  document.body.style.setProperty('--warmth', wallLit ? Math.min(n / 40, 1) : 0);
  $('#igniteBtn').disabled = wallLit || !n || !!cdTimer;
  $('#hostActions').hidden = !hostName;
  $('#hostLink').textContent = hostName ? `Hosting as ${hostName} · Log out` : 'Host login';
}

/* ---------- countdown overlay ---------- */
function runCountdown(at){
  if (cdTimer || wallLit) return;
  const box = $('#countdown'), num = $('#cdNum'); box.classList.add('on');
  const tick = () => {
    const left = Math.ceil((at - (Date.now() + offset)) / 1000);
    if (left <= 0){ clearInterval(cdTimer); cdTimer = null; box.classList.remove('on'); api('/api/state').then(apply).catch(() => {}); return; }
    if (num.textContent !== String(left)){ num.textContent = left; fxCount(left); num.style.animation = 'none'; void num.offsetWidth; num.style.animation = ''; }
  };
  cdTimer = setInterval(tick, 100); tick(); render();
}

function apply(s){
  diyas = s.diyas; offset = s.now - Date.now();
  if (s.lighters && s.lighters.length) lighters = s.lighters.join(' or ');
  const becameLit = s.lit && !wallLit; wallLit = s.lit;
  if (becameLit && cdTimer){ clearInterval(cdTimer); cdTimer = null; $('#countdown').classList.remove('on'); }
  render();
  if (s.countdownAt && !wallLit) runCountdown(s.countdownAt);
}

/* ---------- data ---------- */
function banner(msg){ modeEl.textContent = msg || ''; modeEl.classList.toggle('warn', !!msg); }
async function api(path, method = 'GET', body){
  const r = await fetch(path, { method, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(hostCode ? { 'x-host-code': hostCode } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401 && path !== '/api/login' && hostName){ hostName = ''; hostCode = ''; localStorage.removeItem('hostCode'); render(); }
  if (!r.ok){ let m = ''; try { m = (await r.json()).error; } catch {} throw new Error(`HTTP ${r.status}${m ? ': ' + m : ''}`); }
  return r.json();
}
function load(){
  const es = new EventSource('/api/events');                 // live: the server pushes every change
  es.onmessage = (e) => {
    const s = JSON.parse(e.data); apply(s);
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    banner(local && s.lan && s.lan.length ? 'Share this link with everyone on your Wi-Fi / office network:  ' + s.lan.join('   or   ') : '');
  };
  es.onerror = () => banner('Reconnecting to the wall…');
}

/* ---------- actions ---------- */
$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = nameEl.value.replace(/\s+/g, ' ').trim();
  if (!name) return nameEl.focus();
  lightBtn.disabled = true;
  try {
    apply(await api('/api/diyas', 'POST', { name }));
    toast(wallLit ? `Happy Diwali, ${name}! 🪔` : `${name}, your diya is ready! 🪔`);
    nameEl.value = ''; nameEl.focus();          // ready for the next person
  } catch (err) { toast('Could not add your name. ' + err.message, 8000); }
  lightBtn.disabled = false;
});

$('#igniteBtn').addEventListener('click', async () => {
  try { apply(await api('/api/light-all', 'POST')); } catch (err) { toast('Could not start. ' + err.message); }
});

$('#hostLink').addEventListener('click', async () => {
  if (hostName){ hostName = ''; hostCode = ''; localStorage.removeItem('hostCode'); render(); return; }
  const code = prompt('Host passcode (only for ' + lighters + '):');
  if (!code) return;
  try {
    const r = await api('/api/login', 'POST', { code });
    hostCode = code.trim(); hostName = r.who; localStorage.setItem('hostCode', hostCode); render(); toast(`Welcome, ${r.who}! 🔥`);
  } catch (err) { toast(err.message.replace('HTTP 401: ', ''), 4000); }
});
if (hostCode) api('/api/login', 'POST', { code: hostCode }).then(r => { hostName = r.who; render(); }).catch(() => { hostCode = ''; localStorage.removeItem('hostCode'); });

let confirmTimer;
clearBtn.addEventListener('click', async () => {
  if (!clearBtn.classList.contains('confirm')){
    clearBtn.classList.add('confirm'); clearBtn.textContent = 'Click again to clear all';
    confirmTimer = setTimeout(resetClear, 3000); return;
  }
  clearTimeout(confirmTimer); resetClear();
  try { apply(await api('/api/clear', 'POST')); toast('Wall cleared. Next group, add your names! 🪔'); nameEl.focus(); }
  catch (err) { toast('Could not clear. ' + err.message); }
});
function resetClear(){ clearBtn.classList.remove('confirm'); clearBtn.textContent = 'Clear all'; }

function toast(msg, ms = 2800){
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.classList.remove('show'), ms);
}

/* ---------- fireworks engine: rockets, shells, anaar, chakri, ladi ---------- */
const cv = $('#fx'), cx = cv.getContext('2d'); let W, H, P = [], rockets = [], wheels = [], fountainUntil = 0, nextRocket = 3000;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function size(){ W = cv.width = innerWidth; H = cv.height = innerHeight; }
addEventListener('resize', size); size();

const PAL = [['#ffd76a','#ffb52e'],['#ff7a1a','#ff3d6e'],['#7df9ff','#4d9bff'],['#c77dff','#ff6ad5'],['#9dff7a','#fff3b0'],['#ffffff','#ffd76a'],['#ff5a5a','#ffd0a0']];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const add = (p) => { if (P.length < 1300) P.push(p); };
function spark(x, y, vx, vy, c, o = {}){
  add({ x, y, vx, vy, c, life: 1, decay: o.decay || rnd(.012, .024), r: o.r || rnd(1.2, 2.3), g: o.g ?? .06, drag: o.drag || .985, trail: o.trail ?? true, t: [] });
}
function flash(x, y, r = 28, decay = .12){ add({ x, y, vx: 0, vy: 0, c: '#fff6d0', life: 1, decay, r, g: 0, drag: 1, trail: false, flash: true, t: [] }); }

function explode(x, y, kind = pick(['peony','ring','willow','heart','double','palm','peony']), pal = pick(PAL)){
  const [c1, c2] = pal; flash(x, y);
  if (kind === 'peony') for (let i = 0; i < 80; i++){ const a = Math.random()*6.283, s = rnd(1.5, 5.2); spark(x, y, Math.cos(a)*s, Math.sin(a)*s, i % 2 ? c1 : c2); }
  else if (kind === 'ring') for (let i = 0; i < 64; i++){ const a = i/64*6.283; spark(x, y, Math.cos(a)*4.4, Math.sin(a)*4.4, c1, { decay: .015 }); }
  else if (kind === 'willow') for (let i = 0; i < 70; i++){ const a = Math.random()*6.283, s = rnd(1, 4.2); spark(x, y, Math.cos(a)*s, Math.sin(a)*s, i % 3 ? '#ffd76a' : '#ffb52e', { decay: rnd(.006, .011), g: .05, drag: .975 }); }
  else if (kind === 'heart') for (let i = 0; i < 72; i++){ const t = i/72*6.283, hx = 16*Math.pow(Math.sin(t),3), hy = -(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t)); spark(x, y, hx*.27, hy*.27, c1, { g: .03, decay: .013 }); }
  else if (kind === 'double'){ for (let i = 0; i < 56; i++){ const a = i/56*6.283; spark(x, y, Math.cos(a)*4.8, Math.sin(a)*4.8, c1); } for (let i = 0; i < 36; i++){ const a = i/36*6.283; spark(x, y, Math.cos(a)*2.6, Math.sin(a)*2.6, c2); } }
  else if (kind === 'palm') for (let k = 0; k < 8; k++){ const a = k*Math.PI/4 + rnd(-.1,.1); for (let j = 0; j < 9; j++){ const s = 1.6 + j*.5; spark(x, y, Math.cos(a)*s, Math.sin(a)*s, j % 2 ? c1 : c2, { g: .08, decay: .014 }); } }
  for (let i = 0; i < 18; i++) spark(x, y, rnd(-3,3), rnd(-3,3), '#ffffff', { r: 1, decay: .035, trail: false });   // crackle
}

function launchRocket(x = rnd(W*.1, W*.9), y = H + 10, ty = rnd(H*.12, H*.5), kind){
  if (reduce) return;
  rockets.push({ x, y, vx: rnd(-.5, .5), vy: -Math.sqrt(2*.12*Math.max(y - ty, 80)), kind, pal: pick(PAL) });
}

function burst(el, count = 46){            // little golden burst over a diya
  if (reduce) return;
  const r = el.querySelector('svg').getBoundingClientRect();
  sparks(r.left + r.width/2, r.top + r.height*.2, count);
}
function sparks(x, y, count, speed = 1){
  for (let i = 0; i < count; i++){ const a = Math.random()*6.283, s = rnd(1.5, 5.5)*speed;
    spark(x, y, Math.cos(a)*s, Math.sin(a)*s - 1.2, ['#ffd76a','#ffb52e','#ff7a1a','#fff3b0','#ff5a8a'][i % 5]); }
}
function pop(x, y){                         // one firecracker bang
  flash(x, y, 34, .22);
  for (let i = 0; i < 12; i++){ const a = Math.random()*6.283, s = rnd(2, 6.5); spark(x, y, Math.cos(a)*s, Math.sin(a)*s, pick(['#ff3d6e','#ffd76a','#ffffff','#ff8a3d']), { decay: .045, g: .1 }); }
}
function ladi(){                            // string of firecrackers going off along the ground
  const n = Math.max(18, Math.floor(W / 46));
  document.body.classList.add('shake');
  for (let i = 0; i < n; i++) setTimeout(() => pop(W * i/(n-1), H - rnd(16, 64)), i * 55);
  setTimeout(() => document.body.classList.remove('shake'), 900);
}
function fxCount(left){ launchRocket(); if (left <= 2) launchRocket(); }   // one rocket per countdown second

function loop(t){
  cx.clearRect(0, 0, W, H);
  cx.globalCompositeOperation = 'lighter';
  if (!reduce){
    if (t > nextRocket){ launchRocket(); nextRocket = t + (wallLit ? rnd(1100, 2600) : rnd(5500, 9500)); }
    if (Math.random() < .12) add({ x: Math.random()*W, y: H + 8, vx: rnd(-.2,.2), vy: -rnd(.4, 1.1), c: '#ffb52e', life: 1, decay: rnd(.002,.004), r: rnd(.8, 1.8), g: 0, drag: 1, trail: false, t: [] });
    const burstOn = performance.now() < fountainUntil;                     // anaar (fountains) in both corners
    if (burstOn || (wallLit && Math.random() < .5)) for (const side of [0, 1]) for (let k = 0; k < (burstOn ? 4 : 1); k++)
      spark(W*(side ? .95 : .05), H - 8, rnd(-1.4, 1.4) + (side ? -.9 : .9), -rnd(6, 11), pick(['#ffd76a','#fff3b0','#ffb52e']), { g: .18, decay: .02, r: 1.7, drag: .99 });
    wheels = wheels.filter(w => performance.now() < w.until);              // chakri (spinning wheels)
    for (const w of wheels){ w.a += .55;
      for (let k = 0; k < 2; k++){ const an = w.a + k*Math.PI;
        spark(w.x + Math.cos(an)*16, w.y + Math.sin(an)*16, Math.cos(an+1.57)*3.4, Math.sin(an+1.57)*3.4, pick(['#ff7a1a','#ffd76a','#fff3b0']), { g: .04, decay: .03 }); } }
  }
  rockets = rockets.filter(r => {
    r.x += r.vx; r.y += r.vy; r.vy += .12;
    spark(r.x, r.y, rnd(-.3,.3), rnd(.6,1.6), '#ffb52e', { decay: .06, r: 1.3, g: .02, trail: false });
    cx.globalAlpha = 1; cx.fillStyle = '#fff3b0'; cx.beginPath(); cx.arc(r.x, r.y, 2.4, 0, 6.283); cx.fill();
    if (r.vy > -.8){ explode(r.x, r.y, r.kind, r.pal); return false; }
    return true;
  });
  for (const p of P){
    p.x += p.vx; p.y += p.vy; p.vx *= p.drag; p.vy = p.vy*p.drag + p.g; p.life -= p.decay;
    const a = Math.max(p.life, 0);
    if (p.flash){ cx.globalAlpha = a*.55; cx.fillStyle = p.c; cx.beginPath(); cx.arc(p.x, p.y, p.r*(1.4 - a*.4), 0, 6.283); cx.fill(); continue; }
    cx.globalAlpha = a;
    if (p.trail){
      p.t.push(p.x, p.y); if (p.t.length > 12) p.t.splice(0, 2);
      cx.strokeStyle = p.c; cx.lineWidth = p.r; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(p.t[0], p.t[1]);
      for (let k = 2; k < p.t.length; k += 2) cx.lineTo(p.t[k], p.t[k+1]);
      cx.stroke();
    } else { cx.fillStyle = p.c; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill(); }
  }
  P = P.filter(p => p.life > 0 && p.y < H + 60);
  cx.globalCompositeOperation = 'source-over'; cx.globalAlpha = 1;
  requestAnimationFrame(loop);
}

/* the whole wall catches fire together */
function celebrate(all){
  wall.classList.remove('flash'); void wall.offsetWidth; wall.classList.add('flash');
  toast('Happy Diwali from all of us! 🎆');
  if (reduce) return;
  all.forEach(el => burst(el, 4));
  ladi();
  fountainUntil = performance.now() + 9000;
  for (let k = 0; k < 3; k++) wheels.push({ x: W*(.2 + k*.3) + rnd(-30,30), y: H*rnd(.25,.45), a: 0, until: performance.now() + 3800 });
  let k = 0;
  const t = setInterval(() => {
    launchRocket(); if (k % 3 === 0) launchRocket();
    if (++k > 34) clearInterval(t);
  }, 300);
  setTimeout(() => explode(W/2, H*.28, 'double', ['#ffd76a','#ff3d6e']), 11000);   // grand finale
}

/* ---------- night skyline with festive rooftops + floating lanterns ---------- */
(function skyline(){
  const svg = $('#skyline'); let seed = 11;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647, R = (a, b) => a + r()*(b - a);
  let x = -10, out = '<defs><linearGradient id="bld" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1250"/><stop offset="1" stop-color="#090218"/></linearGradient></defs>';
  while (x < 1450){
    const w = R(46, 98), h = R(60, 150), top = 240 - h, mid = x + w/2, kind = ['flat','dome','spire','temple','flat','dome'][Math.floor(r()*6)];
    out += `<rect x="${x}" y="${top}" width="${w}" height="${h+2}" fill="url(#bld)"/>`;
    if (kind === 'dome') out += `<path d="M${x+6} ${top} Q${mid} ${top-w*.75} ${x+w-6} ${top}Z" fill="url(#bld)"/><rect x="${mid-1}" y="${top-w*.37-14}" width="2" height="14" fill="#2a1250"/><circle cx="${mid}" cy="${top-w*.37-16}" r="3" fill="#ffcf6b" class="win"/>`;
    else if (kind === 'spire') out += `<path d="M${mid-9} ${top} L${mid} ${top-46} L${mid+9} ${top}Z" fill="url(#bld)"/>`;
    else if (kind === 'temple'){ for (let i = 0; i < 3; i++) out += `<rect x="${x+(i+1)*w*.12}" y="${top-(i+1)*10}" width="${w*(1-.24*(i+1))}" height="11" fill="url(#bld)"/>`;
      out += `<rect x="${mid-1}" y="${top-52}" width="2" height="20" fill="#2a1250"/><path d="M${mid+1} ${top-52} l13 4 l-13 4z" fill="#ff7a1a" class="win"/>`; }
    const cols = Math.floor(w/18), rows = Math.floor((h-16)/22);
    for (let c = 0; c < cols; c++) for (let q = 0; q < rows; q++) if (r() < .5)
      out += `<rect x="${x+9+c*16}" y="${top+12+q*22}" width="6" height="9" rx="1" fill="#ffcf6b" class="win" style="animation-delay:-${(r()*4).toFixed(2)}s" opacity="${R(.55,1).toFixed(2)}"/>`;
    for (let d = 0; d < 3; d++) out += `<circle cx="${x+8+d*((w-16)/2)}" cy="${top-2}" r="1.8" fill="#ffb52e" class="win" style="animation-delay:-${(r()*4).toFixed(2)}s"/>`;   // rooftop diyas
    x += w + R(0, 5);
  }
  svg.innerHTML = out;
})();
(function lanterns(){
  for (let i = 0; i < 8; i++){
    const d = document.createElement('div'); d.className = 'lantern';
    d.style.cssText = `--x:${4 + i*12 + Math.random()*6}%;--s:${(.7 + Math.random()*.9).toFixed(2)};--dur:${(40 + Math.random()*35).toFixed(0)}s;--delay:-${(Math.random()*60).toFixed(0)}s`;
    document.body.appendChild(d);
  }
})();

requestAnimationFrame(loop); load();
