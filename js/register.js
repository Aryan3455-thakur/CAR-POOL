const form = document.getElementById('registerForm');

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const fullName = String(fd.get('fullName') ?? '').trim();
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const password = fd.get('password');
  const userType = fd.get('userType');
  const city = fd.get('city');

  if (!fullName || !email || password == null || String(password) === '') {
    showMessage('Please fill in all required fields.', 'error');
    return;
  }

  if (!email.includes('@')) {
    showMessage('Please enter a valid email address.', 'error');
    return;
  }

  const domain = email.split('@')[1];
  if (!allowedDomains.includes(domain)) {
    showMessage('Only @gmail.com or @nmims.in emails are allowed.', 'error');
    return;
  }

  if (!allowedCities.includes(city)) {
    showMessage('City must be Chandigarh, Panchkula, or Zirakpur.', 'error');
    return;
  }

  try {
    await api('/api/register', {
      method: 'POST',
      body: { fullName, email, password, userType, city }
    });
    showMessage('Registration successful. Redirecting to login...');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 900);
  } catch (err) {
    showMessage(err.message || 'Registration failed.', 'error');
  }
});