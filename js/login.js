const loginForm = document.getElementById('loginForm');

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(loginForm);
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const password = fd.get('password');

  if (!email || password == null || String(password) === '') {
    showMessage('Email and password are required.', 'error');
    return;
  }

  try {
    await api('/api/login', { method: 'POST', body: { email, password } });
    window.location.href = 'dashboard.html';
  } catch (err) {
    showMessage(err.message || 'Login failed.', 'error');
  }
});