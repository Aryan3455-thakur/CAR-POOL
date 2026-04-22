let sessionUser = null;

async function init() {
  try {
    const { user } = await api('/api/session');
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    sessionUser = user;
    const welcome = document.getElementById('welcomeName');
    if (welcome) {
      welcome.textContent = `Hi, ${sessionUser.fullName}`;
    }
    await loadDashboard();
  } catch {
    window.location.href = 'login.html';
  }
}

async function loadDashboard() {
  const data = await api('/api/dashboard');
  render(data.myRides || [], data.availableRides || [], data.myRequests || [], data.incomingRequests || []);
}

function render(myRides, availableRides, myRequests, incomingRequests) {
  document.getElementById('myRides').innerHTML = myRides.length
    ? myRides
        .map(
          (r) => `<div class="list-item">
            <div><strong>${r.pickup_city} - ${r.pickup_point} → NMIMS Chandigarh</strong><br><small>${fmtDate(r.ride_date)} • ${fmtTime(r.ride_time)}</small><br><small>Seats: ${r.available_seats}/${r.total_seats} | Status: ${r.status}</small></div>
            <button type="button" onclick="toggleRide(${r.id})">${r.status === 'off' ? 'Turn On' : 'Temporary Off'}</button>
          </div>`
        )
        .join('')
    : '<p>No rides created yet.</p>';

  document.getElementById('availableRides').innerHTML = availableRides.length
    ? availableRides
        .map(
          (r) => `<div class="list-item">
            <div><strong>${escapeHtml(r.rider_name)}</strong><br><small>${r.pickup_city} - ${r.pickup_point} → NMIMS Chandigarh</small><br><small>${fmtDate(r.ride_date)} • ${fmtTime(r.ride_time)} • Seats: ${r.available_seats}/${r.total_seats}</small></div>
            <button type="button" onclick="requestRide(${r.id})">Request Ride</button>
          </div>`
        )
        .join('')
    : '<p>No active rides.</p>';

  document.getElementById('myRequests').innerHTML = myRequests.length
    ? myRequests
        .map(
          (req) => `<div class="list-item"><div><strong>${req.pickup_city} - ${req.pickup_point}</strong><br><small>Rider: ${escapeHtml(req.rider_name || 'N/A')}</small><br><small>${fmtDate(req.ride_date)} • ${fmtTime(req.ride_time)} | Status: ${req.status}</small></div></div>`
        )
        .join('')
    : '<p>No ride requests yet.</p>';

  document.getElementById('incomingRequests').innerHTML = incomingRequests.length
    ? incomingRequests
        .map(
          (req) => `<div class="list-item">
            <div><strong>${escapeHtml(req.requester_name)}</strong><br><small>${req.pickup_city} - ${req.pickup_point} → NMIMS Chandigarh</small><br><small>${fmtDate(req.ride_date)} • ${fmtTime(req.ride_time)} • Seats left: ${req.available_seats}</small></div>
            <div style="display:flex; gap:8px;">
              <button type="button" onclick="respondToRequest(${req.id}, 'accepted')">Accept</button>
              <button type="button" onclick="respondToRequest(${req.id}, 'rejected')">Reject</button>
            </div>
          </div>`
        )
        .join('')
    : '<p>No incoming requests.</p>';
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML;
}

document.getElementById('rideForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const pickupCity = fd.get('pickupCity');
  const pickupPoint = String(fd.get('pickupPoint') ?? '').trim();
  const rideDate = fd.get('rideDate');
  const rideTime = fd.get('rideTime');
  const totalSeats = Number(fd.get('totalSeats'));

  if (!allowedCities.includes(pickupCity) || !pickupPoint || totalSeats < 1) {
    showMessage('Please enter valid ride details.', 'error');
    return;
  }

  try {
    await api('/api/rides', {
      method: 'POST',
      body: { pickupCity, pickupPoint, rideDate, rideTime, totalSeats }
    });
    e.target.reset();
    showMessage('Ride created successfully.');
    await loadDashboard();
  } catch (err) {
    showMessage(err.message || 'Could not create ride.', 'error');
  }
});

async function toggleRide(rideId) {
  try {
    await api(`/api/rides/${rideId}/toggle`, { method: 'PATCH' });
    showMessage('Ride status updated.');
    await loadDashboard();
  } catch (err) {
    showMessage(err.message || 'Could not update ride.', 'error');
  }
}

async function requestRide(rideId) {
  try {
    await api(`/api/rides/${rideId}/request`, { method: 'POST' });
    showMessage('Ride request submitted.');
    await loadDashboard();
  } catch (err) {
    showMessage(err.message || 'Could not request ride.', 'error');
  }
}

async function respondToRequest(requestId, decision) {
  try {
    await api(`/api/ride-requests/${requestId}/decision`, {
      method: 'PATCH',
      body: { decision }
    });
    showMessage(decision === 'accepted' ? 'Request accepted.' : 'Request rejected.');
    await loadDashboard();
  } catch (err) {
    showMessage(err.message || 'Could not update request.', 'error');
  }
}

window.toggleRide = toggleRide;
window.requestRide = requestRide;
window.respondToRequest = respondToRequest;

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch {
    /* still leave dashboard */
  }
  window.location.href = 'login.html';
});

init();