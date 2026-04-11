const socket = io(window.location.origin);

function joinGame() {
  const pin  = document.getElementById('pinInput').value.trim();
  const name = document.getElementById('nameInput').value.trim();

  if (!pin || !name)    return showError('Please fill in both fields!');
  if (pin.length !== 6) return showError('PIN must be exactly 6 digits');
  if (name.length < 2)  return showError('Name must be at least 2 characters');
  if (name === 'Host')  return showError('"Host" is a reserved name. Please use another.');

  localStorage.setItem('playerName', name);
  localStorage.setItem('currentPin', pin);

  socket.emit('joinQuiz', { pin, name, isHost: false });
  socket.once('joinSuccess', ({ pin: p }) => { window.location.href = `lobby.html?pin=${p}`; });
  socket.once('errorMsg',    msg          => showError(msg));
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
