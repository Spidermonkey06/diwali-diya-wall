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
    if (num.textContent !== String(left)){ num.textContent = left; num.style.animation = 'none'; void num.offsetWidth; num.style.animation = ''; }
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

/* ---------- sparks + floating embers ---------- */
const cv = $('#fx'), cx = cv.getContext('2d'); let W, H, parts = [];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function size(){ W = cv.width = innerWidth; H = cv.height = innerHeight; }
addEventListener('resize', size); size();

function burst(el, count = 46){
  if (reduce) return;
  const r = el.querySelector('svg').getBoundingClientRect();
  sparks(r.left + r.width/2, r.top + r.height*.2, count);
}
function sparks(x, y, count, speed = 1){
  for (let i = 0; i < count; i++){
    const a = Math.random() * Math.PI * 2, s = (1.5 + Math.random() * 4.5) * speed;
    parts.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 1.5, life: 1, decay: .012 + Math.random()*.014,
      r: 1.5 + Math.random()*2.5, c: ['#ffd76a','#ffb52e','#ff7a1a','#fff3b0','#e0457b'][i % 5], g: .06, spark: true });
  }
}
function ember(){
  parts.push({ x: Math.random()*W, y: H + 10, vx: (Math.random()-.5)*.4, vy: -(.4 + Math.random()*.9), life: 1,
    decay: .0018 + Math.random()*.002, r: .8 + Math.random()*1.8, c: Math.random() < .7 ? '#ffb52e' : '#ff7a1a', g: 0 });
}
function loop(){
  cx.clearRect(0, 0, W, H);
  if (!reduce && Math.random() < .25 + Math.min(diyas.length, 20) * .02) ember();
  parts = parts.filter(p => p.life > 0);
  for (const p of parts){
    p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life -= p.decay;
    cx.globalAlpha = Math.max(p.life, 0) * (p.spark ? 1 : .6);
    cx.fillStyle = p.c; cx.shadowColor = p.c; cx.shadowBlur = 8;
    cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill();
  }
  requestAnimationFrame(loop);
}

/* the whole wall catches fire together + sky fireworks */
function celebrate(all){
  wall.classList.remove('flash'); void wall.offsetWidth; wall.classList.add('flash');
  toast('Happy Diwali from all of us! 🎆');
  if (reduce) return;
  all.forEach(el => burst(el, 8));
  let k = 0;
  const t = setInterval(() => {
    sparks(W * (.12 + Math.random() * .76), H * (.12 + Math.random() * .45), 70, 1.7);
    if (++k > 14) clearInterval(t);
  }, 260);
}

loop(); load();
