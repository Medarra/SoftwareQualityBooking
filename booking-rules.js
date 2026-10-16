export class BookingRuleError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function fail(status, message) {
  throw new BookingRuleError(status, message);
}

export function parseBookingDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function timeToMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) return -1;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : -1;
}

function localDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function slotIsFree(store, provider, date, time, ignoreId) {
  const startsAt = timeToMinutes(time);
  const endsAt = startsAt + provider.slotDuration;
  return !store.appointments.some((appointment) => {
    if (appointment.id === ignoreId || appointment.providerId !== provider.id || appointment.date !== date) return false;
    const bookedStart = timeToMinutes(appointment.time);
    const bookedEnd = bookedStart + appointment.durationMinutes;
    return startsAt < bookedEnd && bookedStart < endsAt;
  });
}

export function getAvailability(store, provider, date, now, ignoreId) {
  const parsedDate = parseBookingDate(date);
  if (!parsedDate || !provider.workingDays.includes(parsedDate.getDay())) return [];

  const start = timeToMinutes(provider.start);
  const end = timeToMinutes(provider.end);
  const isToday = date === localDateString(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const slots = [];

  for (let time = start; time + provider.slotDuration <= end; time += provider.slotDuration) {
    const label = `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
    if ((!isToday || time > currentMinutes) && slotIsFree(store, provider, date, label, ignoreId)) slots.push(label);
  }
  return slots;
}

export function appointmentInput(store, input, existing, user, now) {
  const provider = store.providers.find((item) => item.id === input.providerId);
  const service = store.services.find((item) => item.id === input.serviceId);
  const date = input.date;
  const time = input.time;
  const visitorName = String(input.visitorName || '').trim();
  const patron = existing?.patronUserId
    ? store.users.find((item) => item.id === existing.patronUserId)
    : user?.role === 'patron' ? user : null;
  const anonymous = user?.role === 'patron' ? false : existing && user?.role === 'stylist'
    ? existing.anonymous
    : Boolean(input.anonymous);
  const patronName = patron?.name || (existing && user?.role === 'stylist' ? existing.patronName : String(input.patronName || '').trim());
  const patronEmail = patron?.email || (existing && user?.role === 'stylist' ? existing.patronEmail : String(input.patronEmail || '').trim());

  if (!provider || !service || !provider.serviceIds.includes(service.id)) fail(400, 'Choose a service offered by this provider.');
  if (!parseBookingDate(date) || date < localDateString(now)) fail(400, 'Choose a valid date that is not in the past.');
  if (!visitorName) fail(400, 'Enter the name of the person attending.');
  if (store.settings.registrationRequired && !user && !existing) fail(401, 'Create an account or sign in to book at this studio.');
  if (store.settings.registrationRequired && anonymous) fail(400, 'This studio requires an account to book.');
  if (!anonymous && (!patronName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patronEmail))) {
    fail(400, 'Enter the booking contact name and a valid email address.');
  }

  const available = getAvailability(store, provider, date, now, existing?.id);
  if (!available.includes(time)) fail(409, 'That appointment time is no longer available. Choose another slot.');

  return {
    providerId: provider.id,
    providerName: provider.name,
    serviceId: service.id,
    serviceName: service.name,
    price: service.price,
    date,
    time,
    durationMinutes: provider.slotDuration,
    visitorName,
    anonymous,
    patronName: anonymous ? '' : patronName,
    patronEmail: anonymous ? '' : patronEmail,
    patronUserId: patron?.id || existing?.patronUserId || null,
    updatedAt: now.toISOString()
  };
}

export function updateProviderAvailability(store, providerId, input, user) {
  const provider = store.providers.find((item) => item.id === providerId);
  if (!provider) fail(404, 'Service provider not found.');
  if (user.role !== 'admin' && (user.role !== 'stylist' || user.providerId !== provider.id)) {
    fail(403, 'You can only change availability for your own stylist profile.');
  }

  const start = timeToMinutes(input.start);
  const end = timeToMinutes(input.end);
  const duration = Number(input.slotDuration);
  const workingDays = input.workingDays === undefined ? provider.workingDays : input.workingDays;
  if (start < 0 || end <= start || ![15, 30, 45, 60, 90, 120].includes(duration) || end - start < duration
    || !Array.isArray(workingDays) || workingDays.length < 1 || workingDays.length > 7
    || workingDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
    || new Set(workingDays).size !== workingDays.length) {
    fail(400, 'Enter valid working hours and an appointment length that fits within them.');
  }
  provider.start = input.start;
  provider.end = input.end;
  provider.slotDuration = duration;
  provider.workingDays = workingDays;
  return provider;
}

function requireAppointmentAccess(user, appointment) {
  if (user.role === 'stylist' && appointment.providerId === user.providerId) return;
  if (user.role === 'patron' && appointment.patronUserId === user.id) return;
  fail(403, 'You do not have access to this appointment.');
}

export function cancelAppointment(store, appointmentId, user) {
  const index = store.appointments.findIndex((item) => item.id === appointmentId);
  if (index < 0) fail(404, 'Appointment not found.');
  requireAppointmentAccess(user, store.appointments[index]);
  return store.appointments.splice(index, 1)[0];
}
