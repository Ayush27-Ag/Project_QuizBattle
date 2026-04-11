let audioCtx;
function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
document.addEventListener('click', initAudio, { once: true });

function playJoin() {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.connect(g); g.connect(audioCtx.destination);
  o.type = 'sine';
  o.frequency.setValueAtTime(440, audioCtx.currentTime);
  o.frequency.exponentialRampToValueAtTime(660, audioCtx.currentTime + 0.12);
  g.gain.setValueAtTime(0.25, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
  o.start(); o.stop(audioCtx.currentTime + 0.35);
}

function playStart() {
  if (!audioCtx) return;
  [261,329,392,523,659].forEach((f,i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = 'sine'; o.frequency.value = f;
    const t = audioCtx.currentTime + i*0.1;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.28,t+0.05);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.35);
    o.start(t); o.stop(t+0.35);
  });
}
const socket = io(window.location.origin);
const params  = new URLSearchParams(window.location.search);
const pin     = params.get('pin');
const name    = localStorage.getItem('playerName');
const isHost  = name === 'Host';

document.getElementById('pinVal').textContent = pin;

if (isHost) {
  document.getElementById('startWrap').style.display   = 'block';
  document.getElementById('waitingHint').style.display = 'none';
  socket.emit('joinQuiz', { pin, name, isHost: true });
} else {
  document.getElementById('startWrap').style.display   = 'none';
  document.getElementById('waitingHint').style.display = 'block';
  socket.emit('joinQuiz', { pin, name, isHost: false });
}

socket.emit('getPlayers', pin);

const COLORS = ['#7c6af7','#f7776a','#4ade80','#fbbf24','#38bdf8','#e879f9','#fb923c','#a78bfa'];
const EMOJIS = ['🦊','🐯','🦋','🐬','🦄','🐉','🦅','🐺','🦁','🎭','🐸','🦔','🐙','🦩','🦜'];
let prevCount = 0;

socket.on('joinSuccess', ({ title }) => {
  if (title) document.getElementById('quizName').textContent = title;
});

socket.on('playersUpdate', players => {
  const list  = document.getElementById('playersList');
  const count = document.getElementById('playerCount');
  count.textContent = players.length;
  if (players.length > prevCount) playJoin();
  prevCount = players.length;
  if (players.length === 0) {
    list.innerHTML = '<div class="empty-hint">No players yet — share the PIN!</div>';
    return;
  }
  list.innerHTML = '';
  players.forEach((p, i) => {
    const chip = document.createElement('div');
    chip.className = 'player-chip';
    const color = COLORS[i % COLORS.length];
    chip.innerHTML = `
      <div class="p-avatar" style="background:${color}22;color:${color}">${EMOJIS[i%EMOJIS.length]}</div>
      <div class="p-name">${p.name}</div>`;
    list.appendChild(chip);
  });
});

socket.on('gameStarted', ({ pin: p }) => {
  playStart();
  setTimeout(() => window.location.href = `game.html?pin=${p}`, 400);
});

function startGame() {
  const count = parseInt(document.getElementById('playerCount').textContent);
  if (count === 0) { alert('Wait for at least 1 player to join!'); return; }
  initAudio();
  socket.emit('startGame', { pin });
}
const container = document.getElementById('particles');
for (let i = 0; i < 18; i++) {
  const p = document.createElement('div');
  p.className = 'particle';
  p.style.cssText = `left:${Math.random()*100}%;width:${2+Math.random()*5}px;height:${2+Math.random()*5}px;background:${Math.random()>.5?'#7c6af7':'#f7776a'};animation-duration:${9+Math.random()*12}s;animation-delay:${Math.random()*10}s;`;
  container.appendChild(p);
}
