const params  = new URLSearchParams(window.location.search);
let   players = [];
try { players = JSON.parse(decodeURIComponent(params.get('scores') || '[]')); } catch {}

const COLORS  = ['#7c6af7','#f7776a','#4ade80','#fbbf24','#38bdf8','#e879f9','#fb923c'];
const EMOJIS  = ['🦊','🐯','🦋','🐬','🦄','🐉','🦅','🐺','🦁','🎭'];
const MEDALS  = ['🥇','🥈','🥉'];

if (players[0]) {
  document.getElementById('trophySub').textContent =
    `🎉 ${players[0].name} wins with ${players[0].score} points!`;
}

const podium      = document.getElementById('podium');
const dataOrder   = [1, 0, 2];
const colClasses  = ['col-2nd','col-1st','col-3rd'];
const placeLabels = ['2nd','1st','3rd'];

dataOrder.forEach((di, vi) => {
  const p = players[di];
  if (!p) return;
  const col  = document.createElement('div');
  col.className = `podium-col ${colClasses[vi]}`;
  col.innerHTML = `
    <div class="p-avatar-lg">${EMOJIS[di % EMOJIS.length]}</div>
    <div class="p-name-lg">${p.name}</div>
    <div class="p-pts-lg">${p.score} pts</div>
    <div class="podium-block">${placeLabels[vi]}</div>
  `;
  podium.appendChild(col);
});
if (players.length === 0) podium.style.display = 'none';

const list = document.getElementById('lbList');
players.forEach((p, i) => {
  const row   = document.createElement('div');
  row.className = `lb-row ${i < 3 ? 'rank-'+(i+1) : ''}`;
  row.style.animationDelay = (i * 0.07) + 's';

  const color = COLORS[i % COLORS.length];
  const rankColors = ['#fbbf24','#94a3b8','#f97316'];

  row.innerHTML = `
    <div class="lb-rank" style="color:${rankColors[i] || 'var(--muted)'}">${MEDALS[i] || (i+1)}</div>
    <div class="lb-ava"  style="background:${color}22;color:${color}">${EMOJIS[i % EMOJIS.length]}</div>
    <div class="lb-info">
      <div class="lb-name">${p.name}</div>
      <div class="lb-sub">Rank #${i+1}</div>
    </div>
    <div class="lb-score" style="color:${i===0?'#fbbf24':'var(--accent)'}">${p.score}</div>
  `;
  list.appendChild(row);
});

const canvas = document.getElementById('confettiCanvas');
const ctx    = canvas.getContext('2d');
canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener('resize', () => {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
});

const confColors = ['#7c6af7','#f7776a','#4ade80','#fbbf24','#38bdf8','#e879f9'];
const pieces     = Array.from({ length: 130 }, () => ({
  x:    Math.random() * canvas.width,
  y:    Math.random() * -canvas.height,
  r:    3 + Math.random() * 7,
  c:    confColors[Math.floor(Math.random() * confColors.length)],
  vx:   -2 + Math.random() * 4,
  vy:   2.5 + Math.random() * 5,
  spin: Math.random() * Math.PI * 2,
  sv:   -0.1 + Math.random() * 0.2
}));

let animating = true;
function drawConfetti() {
  if (!animating) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  pieces.forEach(p => {
    p.y += p.vy; p.x += p.vx; p.spin += p.sv;
    if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width; }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.spin);
    ctx.fillStyle = p.c;
    ctx.fillRect(-p.r/2, -p.r*0.3, p.r, p.r * 0.55);
    ctx.restore();
  });
  requestAnimationFrame(drawConfetti);
}

function playWin() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = 'sine'; o.frequency.value = f;
      const t = ac.currentTime + i * 0.13;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.28, t + 0.07);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.start(t); o.stop(t + 0.45);
    });
  } catch {}
}

setTimeout(() => { playWin(); drawConfetti(); }, 300);
setTimeout(() => { animating = false; ctx.clearRect(0,0,canvas.width,canvas.height); }, 7000);

function goHome()    { window.location.href = 'dashboard.html'; }
function playAgain() { window.location.href = 'create.html'; }
