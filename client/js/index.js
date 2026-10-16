// ---- Redirect if already logged in ----
(function checkExistingSession() {
  const user = localStorage.getItem('user');
  if (user) window.location.href = 'dashboard.html';
})();

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

function clearMsg(id) {
  const el = document.getElementById(id);
  el.textContent = '';
  el.className = 'msg';
}

function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  btn.classList.toggle('is-loading', loading);
  btn.disabled = loading;
}

function shakeCard() {
  const card = document.querySelector('.card');
  card.classList.remove('shake');
  void card.offsetWidth; // restart animation
  card.classList.add('shake');
}

let loginInFlight = false;
async function loginUser() {
  if (loginInFlight) return;

  const email    = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) { showMsg('loginMsg', 'Please fill all fields!', 'error'); shakeCard(); return; }
  if (!isValidEmail(email)) { showMsg('loginMsg', 'Please enter a valid email address', 'error'); shakeCard(); return; }

  clearMsg('loginMsg');
  loginInFlight = true;
  setLoading('loginBtn', true);

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
      showMsg('loginMsg', data.message || 'Login failed', 'error');
      shakeCard();
    }
  } catch {
    showMsg('loginMsg', '❌ Cannot connect to server', 'error');
    shakeCard();
  } finally {
    if (!localStorage.getItem('user')) {
      setLoading('loginBtn', false);
      loginInFlight = false;
    }
  }
}

let signupInFlight = false;
async function createAccount() {
  if (signupInFlight) return;

  const name            = document.getElementById('signupName').value.trim();
  const email            = document.getElementById('signupEmail').value.trim().toLowerCase();
  const password          = document.getElementById('signupPassword').value;
  const confirmPassword  = document.getElementById('signupConfirmPassword').value;

  if (!name || !email || !password || !confirmPassword) {
    showMsg('signupMsg', 'Please fill all fields!', 'error'); shakeCard(); return;
  }
  if (!isValidEmail(email)) {
    showMsg('signupMsg', 'Please enter a valid email address', 'error'); shakeCard(); return;
  }
  if (password.length < 6) {
    showMsg('signupMsg', 'Password must be at least 6 characters', 'error'); shakeCard(); return;
  }
  if (password !== confirmPassword) {
    showMsg('signupMsg', 'Passwords do not match', 'error'); shakeCard(); return;
  }

  clearMsg('signupMsg');
  signupInFlight = true;
  setLoading('signupBtn', true);

  try {
    const res  = await fetch(window.location.origin + '/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();

    if (res.ok) {
      showMsg('signupMsg', '✅ Account created! Please login.', 'success');
      document.getElementById('signupPassword').value = '';
      document.getElementById('signupConfirmPassword').value = '';
      setTimeout(() => switchTab('login'), 1200);
    } else {
      showMsg('signupMsg', data.message || 'Signup failed', 'error');
      shakeCard();
    }
  } catch {
    showMsg('signupMsg', '❌ Cannot connect to server', 'error');
    shakeCard();
  } finally {
    setLoading('signupBtn', false);
    signupInFlight = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginEmail').addEventListener('keydown', e => { if (e.key === 'Enter') loginUser(); });
  document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') loginUser(); });

  document.getElementById('signupName').addEventListener('keydown', e => { if (e.key === 'Enter') createAccount(); });
  document.getElementById('signupEmail').addEventListener('keydown', e => { if (e.key === 'Enter') createAccount(); });
  document.getElementById('signupPassword').addEventListener('keydown', e => { if (e.key === 'Enter') createAccount(); });
  document.getElementById('signupConfirmPassword').addEventListener('keydown', e => { if (e.key === 'Enter') createAccount(); });
});