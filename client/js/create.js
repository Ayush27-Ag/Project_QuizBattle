const socket = io(window.location.origin);
const user   = JSON.parse(localStorage.getItem('user') || '{}');
if (!user.name) window.location.href = 'index.html';
const startBtn = document.getElementById('startQuizBtn');
if (startBtn) {
  startBtn.addEventListener('mousemove', e => {
    const r = startBtn.getBoundingClientRect();
    startBtn.style.setProperty('--mx', ((e.clientX - r.left) / r.width  * 100) + '%');
    startBtn.style.setProperty('--my', ((e.clientY - r.top)  / r.height * 100) + '%');
  });
}

function resetCreateUi() {
  if (startBtn) startBtn.disabled = false;
  document.getElementById('loadingRow').classList.remove('show');
}

socket.on('errorMsg', msg => {
  resetCreateUi();
  alert(msg);
});

function startQuiz() {
  const title = document.getElementById('title').value.trim();
  const numQ  = parseInt(document.getElementById('numQ').value, 10);
  const time  = document.getElementById('time').value;

  if (!title)             return alert('Please enter a quiz topic!');
  if (!numQ || numQ < 1)  return alert('Please enter a valid number of questions!');
  if (numQ > 50)          return alert('Maximum 50 questions allowed per quiz.');
  if (!socket.connected)  return alert('Not connected to server. Refresh and try again.');

  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  localStorage.setItem('playerName', 'Host');
  if (!localStorage.getItem('playerId')) {
    localStorage.setItem('playerId', (crypto.randomUUID && crypto.randomUUID()) || ('p' + Date.now() + Math.random()));
  }
  startBtn.disabled = true;
  document.getElementById('loadingRow').classList.add('show');
  document.getElementById('pinResult').classList.remove('show');

  socket.off('roomReady');
  socket.emit('createQuiz', { pin, title, numQ, time });

  socket.once('roomReady', ({ pin: sp }) => {
    const readyPin = String(sp);
    localStorage.setItem('currentPin', readyPin);
    document.getElementById('loadingRow').classList.remove('show');
    document.getElementById('pinNum').textContent = readyPin;
    document.getElementById('pinResult').classList.add('show');
    setTimeout(() => window.location.href = `lobby.html?pin=${readyPin}`, 2200);
  });
}

document.getElementById('numQ')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') startQuiz();
});
document.getElementById('title')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('numQ').focus();
});
