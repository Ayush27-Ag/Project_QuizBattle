const user = JSON.parse(localStorage.getItem('user') || '{}');
if (!user.name) window.location.href = 'index.html';

document.getElementById('userName').textContent = user.name || 'Player';

function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}
document.querySelectorAll('.action-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1);
    const y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1);
    card.style.setProperty('--mx', x + '%');
    card.style.setProperty('--my', y + '%');
  });
});
