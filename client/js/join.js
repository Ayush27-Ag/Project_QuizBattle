const socket = io(window.location.origin);
let joinInFlight = false;

function joinGame() {
  if (joinInFlight) return;

  const pin  = document.getElementById('pinInput').value.trim();
  const name = document.getElementById('nameInput').value.trim();

  if (!pin || !name)    return showError('Please fill in both fields!');
  if (pin.length !== 6) return showError('PIN must be exactly 6 digits');
  if (name.length < 2)  return showError('Name must be at least 2 characters');
  if (name.toLowerCase() === 'host')  return showError('"Host" is a reserved name. Please use another.');
  if (!socket.connected) return showError('Not connected to server. Refresh and try again.');

  joinInFlight = true;
  localStorage.setItem('playerName', name);
  localStorage.setItem('currentPin', pin);
  if (!localStorage.getItem('playerId')) {
    localStorage.setItem('playerId', (crypto.randomUUID && crypto.randomUUID()) || ('p' + Date.now() + Math.random()));
  }

  socket.off('joinSuccess');
  socket.off('errorMsg');
  socket.emit('joinQuiz', { pin, name, isHost: false, playerId: localStorage.getItem('playerId') });
  socket.once('joinSuccess', ({ pin: p }) => { window.location.href = `lobby.html?pin=${p}`; });
  socket.once('errorMsg', msg => {
    joinInFlight = false;
    showError(msg);
  });
}

function showError(msg) {
  const el = document.getElementById('errorToast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

document.getElementById('pinInput')?.addEventListener('input', function () {
  this.value = this.value.replace(/\D/g, '').slice(0, 6);
});
document.getElementById('pinInput')?.addEventListener('keydown',  e => { if (e.key==='Enter') document.getElementById('nameInput').focus(); });
document.getElementById('nameInput')?.addEventListener('keydown', e => { if (e.key==='Enter') joinGame(); });
