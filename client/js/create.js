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

function startQuiz() {
  const title = document.getElementById('title').value.trim();
  const numQ  = parseInt(document.getElementById('numQ').value);
  const time  = document.getElementById('time').value;

  if (!title)             return alert('Please enter a quiz topic!');
  if (!numQ || numQ < 1)  return alert('Please enter a valid number of questions!');
  if (numQ > 50)          return alert('Maximum 50 questions allowed per quiz.');

  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  localStorage.setItem('playerName', 'Host');
  localStorage.setItem('currentPin', pin);
  startBtn.disabled = true;
  document.getElementById('loadingRow').classList.add('show');

  socket.emit('createQuiz', { pin, title, numQ, time });

  socket.once('roomReady', ({ pin: sp }) => {
    if (sp.toString() === pin) {
      document.getElementById('loadingRow').classList.remove('show');
      document.getElementById('pinNum').textContent = pin;
      document.getElementById('pinResult').classList.add('show');
      setTimeout(() => window.location.href = `lobby.html?pin=${pin}`, 2200);
    }
  });
}

document.getElementById('numQ')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') startQuiz();
});
document.getElementById('title')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('numQ').focus();
});
