function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  document.getElementById(tab + 'Section').classList.add('active');
}

function showMsg(id, text, type) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = 'msg ' + type;
}

async function loginUser() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) return showMsg('loginMsg', 'Please fill all fields!', 'error');

  try {
    const res  = await fetch(window.location.origin + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (res.ok) {
      localStorage.setItem('user', JSON.stringify(data.user));
      showMsg('loginMsg', '✅ Welcome back! Redirecting...', 'success');
      setTimeout(() => window.location.href = 'dashboard.html', 800);
    } else {
      showMsg('loginMsg', data.message, 'error');
    }
  } catch { showMsg('loginMsg', '❌ Cannot connect to server', 'error'); }
}

async function createAccount() {
  const name     = document.getElementById('signupName').value.trim();
  const email    = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;

  if (!name || !email || !password) return showMsg('signupMsg', 'Please fill all fields!', 'error');
  if (password.length < 6)           return showMsg('signupMsg', 'Password must be at least 6 characters', 'error');

  try {
    const res  = await fetch(window.location.origin + '/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();

    if (res.ok) {
      showMsg('signupMsg', '✅ Account created! Please login.', 'success');
      setTimeout(() => switchTab('login'), 1200);
    } else {
      showMsg('signupMsg', data.message, 'error');
    }
  } catch { showMsg('signupMsg', '❌ Cannot connect to server', 'error'); }
}
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') loginUser();
  });
  document.getElementById('signupPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') createAccount();
  });
});
