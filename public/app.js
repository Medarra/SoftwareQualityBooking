const state = {
  settings: { registrationRequired: false },
  user: null,
  services: [],
  providers: [],
  appointments: [],
  providerId: '',
  selectedTime: '',
  editingId: '',
  availabilityRequest: 0,
  toastTimer: null
};

const elements = Object.fromEntries([
  'booking-form', 'service-select', 'provider-options', 'booking-date', 'availability', 'visitor-name',
  'anonymous-booking', 'anonymous-control', 'contact-fields', 'patron-name', 'patron-email',
  'submit-booking', 'submit-label', 'cancel-edit', 'booking-summary', 'appointment-count',
  'appointments-list', 'filter-date', 'filter-provider', 'results-count', 'clear-filters',
  'registration-required', 'provider-settings', 'policy-form', 'toast', 'appointments-nav',
  'account-nav', 'settings-nav', 'auth-trigger', 'sign-out', 'signed-in-name', 'auth-dialog',
  'auth-form', 'auth-name', 'auth-role', 'auth-email', 'auth-password', 'auth-provider',
  'invite-code', 'register-fields', 'stylist-fields', 'auth-title', 'auth-eyebrow',
  'auth-submit', 'auth-note', 'login-mode', 'register-mode', 'close-auth',
  'preferences-form', 'favorite-provider', 'favorite-service', 'account-history', 'book-title', 'appointments-title',
  'provider-filter-field', 'new-appointment-button'
].map((id) => [id, document.getElementById(id)]));

let authMode = 'login';

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 3200);
}

function providerById(id) {
  return state.providers.find((provider) => provider.id === id);
}

function serviceById(id) {
  return state.services.find((service) => service.id === id);
}

function initials(name) {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

function formatDate(date, options = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat('en-US', options).format(new Date(`${date}T12:00:00`));
}

function formatTime(time) {
  const [hour, minute] = time.split(':').map(Number);
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, hour, minute));
}

function renderServices() {
  const selected = elements['service-select'].value || state.user?.favoriteServiceId || '';
  elements['service-select'].innerHTML = state.services.map((service) =>
    `<option value="${escapeHtml(service.id)}">${escapeHtml(service.name)} · $${service.price}</option>`
  ).join('');
  if (state.user?.role === 'stylist') {
    const provider = providerById(state.user.providerId);
    [...elements['service-select'].options].forEach((option) => {
      option.hidden = !provider?.serviceIds.includes(option.value);
    });
  }
  if (selected && serviceById(selected) && !elements['service-select'].selectedOptions[0]?.hidden) elements['service-select'].value = selected;
}

function renderProviders() {
  const service = serviceById(elements['service-select'].value);
  let availableProviders = state.providers.filter((provider) => provider.serviceIds.includes(service?.id));
  if (state.user?.role === 'stylist') availableProviders = availableProviders.filter((provider) => provider.id === state.user.providerId);
  if (state.user?.role === 'patron' && state.user.favoriteProviderId) {
    const favorite = availableProviders.find((provider) => provider.id === state.user.favoriteProviderId);
    if (favorite && !state.providerId) state.providerId = favorite.id;
  }
  if (!availableProviders.some((provider) => provider.id === state.providerId)) state.providerId = availableProviders[0]?.id || '';
  elements['provider-options'].innerHTML = availableProviders.map((provider) => `
    <button class="provider-card${provider.id === state.providerId ? ' selected' : ''}" type="button" data-provider-id="${escapeHtml(provider.id)}" aria-pressed="${provider.id === state.providerId}">
      <span class="provider-avatar" style="background:${escapeHtml(provider.color)}">${escapeHtml(initials(provider.name))}</span>
      <span class="provider-card-copy"><strong>${escapeHtml(provider.name)}</strong><small>${escapeHtml(provider.title)} · ${provider.slotDuration} min</small></span>
    </button>`).join('');
  renderSummary();
  loadAvailability();
}

function renderSummary() {
  const service = serviceById(elements['service-select'].value);
  const provider = providerById(state.providerId);
  if (!service || !provider || !state.selectedTime) {
    elements['booking-summary'].innerHTML = '<p>Choose a service and a time to get started.</p>';
    return;
  }
  elements['booking-summary'].innerHTML = `
    <p class="summary-service">${escapeHtml(service.name)}</p>
    <p class="summary-detail">${escapeHtml(provider.name)}<br>${formatDate(elements['booking-date'].value)} at ${formatTime(state.selectedTime)}<br>${provider.slotDuration} minutes</p>
    <p class="summary-detail summary-price">$${service.price}</p>`;
}

async function loadAvailability() {
  const provider = providerById(state.providerId);
  const date = elements['booking-date'].value;
  state.selectedTime = '';
  elements['submit-booking'].disabled = true;
  renderSummary();
  if (!provider || !date) {
    elements.availability.innerHTML = '<p class="availability-message">Choose a provider and a date to see open times.</p>';
    return;
  }

  const requestId = ++state.availabilityRequest;
  elements.availability.innerHTML = '<p class="availability-message">Checking open times…</p>';
  const query = new URLSearchParams({ providerId: provider.id, date });
  if (state.editingId) query.set('ignoreId', state.editingId);
  try {
    const { slots } = await api(`/api/availability?${query}`);
    if (requestId !== state.availabilityRequest) return;
    elements.availability.innerHTML = slots.length
      ? slots.map((time) => `<button class="time-slot" type="button" data-time="${time}">${formatTime(time)}</button>`).join('')
      : '<p class="availability-message">No open times on this date. Try another day or service provider.</p>';
  } catch (error) {
    if (requestId !== state.availabilityRequest) return;
    elements.availability.innerHTML = `<p class="availability-message">${escapeHtml(error.message)}</p>`;
  }
}

function updateContactFields() {
  const accountBooking = state.user?.role === 'patron';
  const stylistEdit = state.user?.role === 'stylist';
  const anonymous = elements['anonymous-booking'].checked && !state.settings.registrationRequired && !accountBooking && !stylistEdit;
  elements['anonymous-control'].classList.toggle('hidden', Boolean(accountBooking) || stylistEdit || state.settings.registrationRequired);
  elements['contact-fields'].classList.toggle('hidden', accountBooking || anonymous || stylistEdit);
  elements['patron-name'].required = !accountBooking && !anonymous && !stylistEdit;
  elements['patron-email'].required = !accountBooking && !anonymous && !stylistEdit;
}

function showView(name) {
  if (name === 'appointments' && !state.user) return openAuthDialog();
  if (name === 'account' && state.user?.role !== 'patron') return;
  if (name === 'book' && state.user?.role === 'stylist' && !state.editingId) return;
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${name}`));
  document.querySelectorAll('.nav-link').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
  if (name === 'appointments') loadAppointments();
  if (name === 'account') renderAccount();
  if (name === 'settings') renderSettings();
}

function renderFilterProviders() {
  const selected = elements['filter-provider'].value;
  elements['filter-provider'].innerHTML = '<option value="">Everyone</option>' + state.providers.map((provider) =>
    `<option value="${escapeHtml(provider.id)}">${escapeHtml(provider.name)}</option>`
  ).join('');
  elements['filter-provider'].value = selected;
}

async function loadAppointments() {
  const query = new URLSearchParams();
  if (elements['filter-date'].value) query.set('date', elements['filter-date'].value);
  if (elements['filter-provider'].value) query.set('providerId', elements['filter-provider'].value);
  try {
    const { appointments } = await api(`/api/appointments?${query}`);
    state.appointments = appointments;
    renderAppointments();
  } catch (error) {
    showToast(error.message);
  }
}

function renderAppointments() {
  const total = state.appointments.length;
  elements['appointment-count'].textContent = String(total);
  elements['results-count'].textContent = `${total} ${total === 1 ? 'appointment' : 'appointments'}`;
  elements['appointments-list'].innerHTML = total ? state.appointments.map((appointment) => `
    <article class="appointment-row">
      <div class="appointment-time"><strong>${formatTime(appointment.time)}</strong><span>${formatDate(appointment.date)}</span></div>
      <div class="appointment-person"><strong>${escapeHtml(appointment.visitorName)}</strong><span>${escapeHtml(appointment.serviceName)}${appointment.anonymous ? ' · Guest booking' : ''}${state.user?.role === 'stylist' && appointment.patronName ? `<br>Booked by ${escapeHtml(appointment.patronName)} · ${escapeHtml(appointment.patronEmail)}` : ''}</span></div>
      <div class="appointment-provider"><strong>${escapeHtml(appointment.providerName)}</strong><span>${appointment.durationMinutes} minutes</span></div>
      <div class="appointment-price">$${appointment.price}</div>
      <div class="appointment-actions"><button type="button" data-edit-id="${escapeHtml(appointment.id)}">Change</button><button class="cancel-action" type="button" data-cancel-id="${escapeHtml(appointment.id)}">Cancel</button></div>
    </article>`).join('') : '<div class="empty-state">No appointments match those filters.</div>';
}

function renderSettings() {
  elements['registration-required'].checked = state.settings.registrationRequired;
  elements['provider-settings'].innerHTML = state.providers.map((provider) => `
    <form class="provider-setting-row" data-settings-provider="${escapeHtml(provider.id)}">
      <div class="setting-provider"><span class="provider-avatar" style="background:${escapeHtml(provider.color)}">${escapeHtml(initials(provider.name))}</span><span><strong>${escapeHtml(provider.name)}</strong><small>${escapeHtml(provider.title)}</small></span></div>
      <label class="setting-field"><span>STARTS</span><input name="start" type="time" value="${escapeHtml(provider.start)}" required></label>
      <label class="setting-field"><span>ENDS</span><input name="end" type="time" value="${escapeHtml(provider.end)}" required></label>
      <label class="setting-field"><span>APPOINTMENT LENGTH</span><select name="slotDuration">${[15, 30, 45, 60, 90, 120].map((duration) => `<option value="${duration}"${duration === provider.slotDuration ? ' selected' : ''}>${duration} minutes</option>`).join('')}</select></label>
      <button class="save-provider" type="submit">Save hours</button>
    </form>`).join('');
}

function syncRoleUI() {
  const user = state.user;
  const isStylist = user?.role === 'stylist';
  const isPatron = user?.role === 'patron';
  elements['appointments-nav'].classList.toggle('hidden', !user);
  elements['account-nav'].classList.toggle('hidden', !isPatron);
  elements['provider-filter-field'].classList.toggle('hidden', isStylist);
  elements['new-appointment-button'].classList.toggle('hidden', isStylist);
  elements['auth-trigger'].classList.toggle('hidden', Boolean(user));
  elements['sign-out'].classList.toggle('hidden', !user);
  elements['signed-in-name'].classList.toggle('hidden', !user);
  elements['signed-in-name'].textContent = user?.name || '';
  elements['appointments-nav'].firstChild.textContent = isStylist ? 'My schedule ' : 'My appointments ';
  elements['book-title'].innerHTML = isStylist && !state.editingId
    ? 'Your schedule<span class="heading-period">.</span>'
    : 'Book a visit<span class="heading-period">.</span>';
  document.querySelector('[data-view="book"]').classList.toggle('hidden', isStylist && !state.editingId);
  document.getElementById('view-book').classList.toggle('hidden', isStylist && !state.editingId);
  if (isPatron && !elements['visitor-name'].value) elements['visitor-name'].value = user.name;
  if (isStylist) elements['appointments-title'].textContent = 'Your schedule.';
  else elements['appointments-title'].textContent = 'Appointments.';
  updateContactFields();
}

async function renderAccount() {
  if (state.user?.role !== 'patron') return;
  try {
    const { user, history } = await api('/api/account');
    state.user = user;
    elements['favorite-provider'].innerHTML = '<option value="">No preference</option>' + state.providers.map((provider) =>
      `<option value="${escapeHtml(provider.id)}">${escapeHtml(provider.name)}</option>`
    ).join('');
    elements['favorite-service'].innerHTML = '<option value="">No preference</option>' + state.services.map((service) =>
      `<option value="${escapeHtml(service.id)}">${escapeHtml(service.name)}</option>`
    ).join('');
    elements['favorite-provider'].value = user.favoriteProviderId;
    elements['favorite-service'].value = user.favoriteServiceId;
    elements['account-history'].innerHTML = history.length ? history.map((appointment) => `
      <article class="history-row">
        <div><strong>${formatDate(appointment.date)}</strong><span>${formatTime(appointment.time)}</span></div>
        <div><strong>${escapeHtml(appointment.serviceName)}</strong><span>${escapeHtml(appointment.visitorName)}${appointment.anonymous ? ' · Guest booking' : ''}</span></div>
        <div><strong>${escapeHtml(appointment.providerName)}</strong><span>${appointment.durationMinutes} minutes</span></div>
        <div class="history-price">$${appointment.price}</div>
      </article>`).join('') : '<div class="history-empty">Your visits will appear here after you book.</div>';
  } catch (error) {
    showToast(error.message);
  }
}

function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === 'register';
  elements['register-fields'].classList.toggle('hidden', !registering);
  elements['auth-name'].required = registering;
  elements['auth-role'].required = registering;
  elements['auth-title'].textContent = registering ? 'Create an account' : 'Sign in';
  elements['auth-eyebrow'].textContent = registering ? 'A GOOD PLACE TO START' : 'WELCOME BACK';
  elements['auth-submit'].firstElementChild.textContent = registering ? 'Create account' : 'Sign in';
  elements['auth-note'].textContent = registering
    ? 'Customer accounts remember your favourite stylist, service, and visits. Stylist accounts need a studio invitation code.'
    : 'Your account keeps your preferences and appointment history together.';
  elements['login-mode'].classList.toggle('active', !registering);
  elements['register-mode'].classList.toggle('active', registering);
  elements['auth-password'].autocomplete = registering ? 'new-password' : 'current-password';
  const stylist = registering && elements['auth-role'].value === 'stylist';
  elements['stylist-fields'].classList.toggle('hidden', !stylist);
  elements['auth-provider'].required = stylist;
  elements['invite-code'].required = stylist;
  elements['auth-provider'].innerHTML = state.providers.map((provider) =>
    `<option value="${escapeHtml(provider.id)}"${provider.accountAvailable ? '' : ' disabled'}>${escapeHtml(provider.name)}${provider.accountAvailable ? '' : ' · account exists'}</option>`
  ).join('');
}

function openAuthDialog() {
  elements['auth-form'].reset();
  setAuthMode('login');
  elements['auth-dialog'].showModal();
}

function setEditing(appointment) {
  state.editingId = appointment.id;
  state.providerId = appointment.providerId;
  elements['service-select'].value = appointment.serviceId;
  renderProviders();
  state.providerId = appointment.providerId;
  renderProviders();
  elements['booking-date'].value = appointment.date;
  elements['visitor-name'].value = appointment.visitorName;
  elements['anonymous-booking'].checked = appointment.anonymous;
  elements['patron-name'].value = appointment.patronName;
  elements['patron-email'].value = appointment.patronEmail;
  elements['submit-label'].textContent = 'Save appointment changes';
  elements['cancel-edit'].classList.remove('hidden');
  document.getElementById('view-book').classList.remove('hidden');
  document.querySelector('[data-view="book"]').classList.remove('hidden');
  updateContactFields();
  showView('book');
  loadAvailability().then(() => {
    const button = [...elements.availability.querySelectorAll('[data-time]')].find((item) => item.dataset.time === appointment.time);
    if (button) button.click();
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearEditing() {
  state.editingId = '';
  state.selectedTime = '';
  elements['booking-form'].reset();
  elements['booking-date'].value = localDate();
  elements['submit-label'].textContent = 'Confirm appointment';
  elements['cancel-edit'].classList.add('hidden');
  syncRoleUI();
  updateContactFields();
  renderProviders();
}

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));

elements['service-select'].addEventListener('change', () => {
  state.selectedTime = '';
  renderProviders();
});

elements['provider-options'].addEventListener('click', (event) => {
  const button = event.target.closest('[data-provider-id]');
  if (!button) return;
  state.providerId = button.dataset.providerId;
  state.selectedTime = '';
  renderProviders();
});

elements.availability.addEventListener('click', (event) => {
  const button = event.target.closest('[data-time]');
  if (!button) return;
  state.selectedTime = button.dataset.time;
  elements.availability.querySelectorAll('.time-slot').forEach((slot) => slot.classList.toggle('selected', slot === button));
  elements['submit-booking'].disabled = false;
  renderSummary();
});

elements['booking-date'].addEventListener('change', loadAvailability);
elements['anonymous-booking'].addEventListener('change', updateContactFields);

elements['booking-form'].addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.selectedTime) return showToast('Choose an available appointment time first.');
  const form = new FormData(elements['booking-form']);
  const payload = {
    serviceId: form.get('serviceId'),
    providerId: state.providerId,
    date: form.get('date'),
    time: state.selectedTime,
    visitorName: form.get('visitorName'),
    anonymous: elements['anonymous-booking'].checked,
    patronName: form.get('patronName'),
    patronEmail: form.get('patronEmail')
  };
  try {
    const route = state.editingId ? `/api/appointments/${state.editingId}` : '/api/appointments';
    const method = state.editingId ? 'PATCH' : 'POST';
    await api(route, { method, body: JSON.stringify(payload) });
    showToast(state.editingId ? 'Appointment updated.' : 'Appointment confirmed.');
    clearEditing();
    if (state.user) {
      await loadAppointments();
      showView('appointments');
    } else {
      await loadAvailability();
    }
  } catch (error) {
    showToast(error.message);
    if (error.message.includes('no longer available')) loadAvailability();
  }
});

elements['cancel-edit'].addEventListener('click', () => {
  clearEditing();
  showView('appointments');
});

elements['auth-trigger'].addEventListener('click', openAuthDialog);
elements['close-auth'].addEventListener('click', () => elements['auth-dialog'].close());
elements['login-mode'].addEventListener('click', () => setAuthMode('login'));
elements['register-mode'].addEventListener('click', () => setAuthMode('register'));
elements['auth-role'].addEventListener('change', () => setAuthMode(authMode));

elements['auth-form'].addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = new FormData(elements['auth-form']);
  const registering = authMode === 'register';
  const payload = { email: values.get('email'), password: values.get('password') };
  if (registering) {
    Object.assign(payload, {
      name: values.get('name'),
      role: values.get('role'),
      providerId: values.get('providerId'),
      inviteCode: values.get('inviteCode')
    });
  }
  try {
    const { user } = await api(`/api/auth/${registering ? 'register' : 'login'}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.user = user;
    state.appointments = [];
    elements['auth-dialog'].close();
    elements['auth-password'].value = '';
    syncRoleUI();
    renderServices();
    renderProviders();
    renderFilterProviders();
    showView(user.role === 'stylist' ? 'appointments' : 'book');
    showToast(`Welcome, ${user.name}.`);
  } catch (error) {
    elements['auth-note'].textContent = error.message;
    elements['auth-note'].classList.add('auth-error');
  }
});

elements['auth-form'].addEventListener('input', () => elements['auth-note'].classList.remove('auth-error'));

elements['sign-out'].addEventListener('click', async () => {
  try {
    await api('/api/auth/session', { method: 'DELETE' });
    state.user = null;
    state.appointments = [];
    clearEditing();
    syncRoleUI();
    showView('book');
    showToast('You are signed out.');
  } catch (error) {
    showToast(error.message);
  }
});

elements['preferences-form'].addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = new FormData(elements['preferences-form']);
  try {
    const { user } = await api('/api/account', {
      method: 'PATCH',
      body: JSON.stringify({ favoriteProviderId: values.get('favoriteProviderId'), favoriteServiceId: values.get('favoriteServiceId') })
    });
    state.user = user;
    elements['service-select'].value = user.favoriteServiceId || elements['service-select'].value;
    state.providerId = user.favoriteProviderId || '';
    renderServices();
    renderProviders();
    showToast('Your preferences are saved.');
  } catch (error) {
    showToast(error.message);
  }
});

elements['appointments-list'].addEventListener('click', async (event) => {
  const editButton = event.target.closest('[data-edit-id]');
  const cancelButton = event.target.closest('[data-cancel-id]');
  if (editButton) {
    const appointment = state.appointments.find((item) => item.id === editButton.dataset.editId);
    if (appointment) setEditing(appointment);
  }
  if (cancelButton) {
    try {
      await api(`/api/appointments/${cancelButton.dataset.cancelId}`, { method: 'DELETE' });
      showToast('Appointment canceled. That time is open again.');
      await Promise.all([loadAppointments(), loadAvailability()]);
    } catch (error) {
      showToast(error.message);
    }
  }
});

elements['filter-date'].addEventListener('change', loadAppointments);
elements['filter-provider'].addEventListener('change', loadAppointments);
elements['clear-filters'].addEventListener('click', () => {
  elements['filter-date'].value = '';
  elements['filter-provider'].value = '';
  loadAppointments();
});

elements['policy-form'].addEventListener('change', async (event) => {
  if (event.target.id !== 'registration-required') return;
  try {
    const { settings } = await api('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({ registrationRequired: elements['registration-required'].checked })
    });
    state.settings = settings;
    elements['anonymous-control'].classList.toggle('hidden', settings.registrationRequired);
    if (settings.registrationRequired) elements['anonymous-booking'].checked = false;
    updateContactFields();
    showToast('Booking policy updated.');
  } catch (error) {
    elements['registration-required'].checked = state.settings.registrationRequired;
    showToast(error.message);
  }
});

elements['provider-settings'].addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-settings-provider]');
  if (!form) return;
  event.preventDefault();
  const values = new FormData(form);
  try {
    const { provider } = await api(`/api/providers/${form.dataset.settingsProvider}`, {
      method: 'PATCH',
      body: JSON.stringify({ start: values.get('start'), end: values.get('end'), slotDuration: Number(values.get('slotDuration')) })
    });
    state.providers = state.providers.map((item) => item.id === provider.id ? provider : item);
    renderSettings();
    renderProviders();
    renderFilterProviders();
    showToast(`${provider.name}'s availability updated.`);
  } catch (error) {
    showToast(error.message);
  }
});

async function start() {
  try {
    const data = await api('/api/bootstrap');
    state.settings = data.settings;
    state.services = data.services;
    state.providers = data.providers;
    state.user = data.user;
    state.appointments = [];
    elements['booking-date'].value = localDate();
    syncRoleUI();
    renderServices();
    renderProviders();
    renderFilterProviders();
    renderAppointments();
    updateContactFields();
    showView(state.user?.role === 'stylist' ? 'appointments' : 'book');
  } catch (error) {
    showToast(`Could not connect to the booking service: ${error.message}`);
  }
}

start();