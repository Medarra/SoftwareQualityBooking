import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const publicDirectory = resolve(root, 'public');
const dataFile = resolve(root, 'data', 'booking.json');
const port = Number(process.env.PORT || 3000);

const initialStore = {
  settings: { registrationRequired: false },
  users: [],
  sessions: {},
  services: [
    { id: 'cut', name: 'Signature cut', category: 'Cut & style', price: 38 },
    { id: 'fade', name: 'Skin fade', category: 'Cut & style', price: 34 },
    { id: 'beard', name: 'Beard tidy', category: 'Grooming', price: 22 },
    { id: 'colour', name: 'Colour refresh', category: 'Colour', price: 65 }
  ],
  providers: [
    { id: 'jules', name: 'Jules Carter', title: 'Senior barber', color: '#c36a4f', start: '09:00', end: '17:00', slotDuration: 30, workingDays: [1, 2, 3, 4, 5, 6], serviceIds: ['cut', 'fade', 'beard'] },
    { id: 'imani', name: 'Imani Brooks', title: 'Stylist', color: '#3d766d', start: '10:00', end: '18:00', slotDuration: 45, workingDays: [1, 2, 3, 4, 5, 6], serviceIds: ['cut', 'colour'] },
    { id: 'leo', name: 'Leo Nguyen', title: 'Barber', color: '#bd9741', start: '09:00', end: '16:00', slotDuration: 30, workingDays: [1, 2, 3, 4, 5, 6], serviceIds: ['cut', 'fade', 'beard'] },
    { id: 'rowan', name: 'Rowan Ellis', title: 'Colourist', color: '#6972a1', start: '11:00', end: '19:00', slotDuration: 60, workingDays: [1, 2, 3, 4, 5, 6], serviceIds: ['cut', 'colour'] }
  ],
  appointments: []
};

let writeQueue = Promise.resolve();

async function readStore() {
  try {
    const store = JSON.parse(await readFile(dataFile, 'utf8'));
    store.users ||= [];
    store.sessions ||= {};
    return store;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await mkdir(dirname(dataFile), { recursive: true });
    await writeFile(dataFile, JSON.stringify(initialStore, null, 2), 'utf8');
    return structuredClone(initialStore);
  }
}

async function changeStore(change) {
  const operation = writeQueue.then(async () => {
    const store = await readStore();
    const result = change(store);
    const temporaryFile = `${dataFile}.tmp`;
    await writeFile(temporaryFile, JSON.stringify(store, null, 2), 'utf8');
    await rename(temporaryFile, dataFile);
    return result;
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(value));
}

function sessionTokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function userFromRequest(store, request) {
  const cookies = Object.fromEntries((request.headers.cookie || '').split(';').map((part) => {
    const separator = part.indexOf('=');
    return separator < 0 ? ['', ''] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
  }));
  const token = cookies.goodday_session;
  if (!token) return null;
  const session = store.sessions[sessionTokenHash(token)];
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return null;
  return store.users.find((user) => user.id === session.userId) || null;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    providerId: user.providerId || null,
    favoriteProviderId: user.favoriteProviderId || '',
    favoriteServiceId: user.favoriteServiceId || ''
  };
}

function requireUser(user) {
  if (!user) fail(401, 'Sign in to view or manage appointments.');
  return user;
}

function requireAppointmentAccess(user, appointment) {
  if (user.role === 'stylist' && appointment.providerId === user.providerId) return;
  if (user.role === 'patron' && appointment.patronUserId === user.id) return;
  fail(403, 'You do not have access to this appointment.');
}

function setSession(response, store, user) {
  const token = randomBytes(32).toString('hex');
  store.sessions[sessionTokenHash(token)] = {
    userId: user.id,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  };
  response.setHeader('set-cookie', `goodday_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
}

function passwordRecord(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') };
}

function passwordMatches(password, user) {
  const actual = Buffer.from(passwordRecord(password, user.passwordSalt).hash, 'hex');
  const expected = Buffer.from(user.passwordHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) fail(413, 'Request body is too large.');
  }
  try {
    return JSON.parse(body || '{}');
  } catch {
    fail(400, 'Request body must be valid JSON.');
  }
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function minutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) return -1;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : -1;
}

function slotIsFree(store, provider, date, time, ignoreId) {
  const startsAt = minutes(time);
  const endsAt = startsAt + provider.slotDuration;
  return !store.appointments.some((appointment) => {
    if (appointment.id === ignoreId || appointment.providerId !== provider.id || appointment.date !== date) return false;
    const bookedStart = minutes(appointment.time);
    const bookedEnd = bookedStart + appointment.durationMinutes;
    return startsAt < bookedEnd && bookedStart < endsAt;
  });
}

function getAvailability(store, provider, date, ignoreId) {
  const parsedDate = parseDate(date);
  if (!parsedDate || !provider.workingDays.includes(parsedDate.getDay())) return [];

  const start = minutes(provider.start);
  const end = minutes(provider.end);
  const now = new Date();
  const isToday = date === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const slots = [];

  for (let time = start; time + provider.slotDuration <= end; time += provider.slotDuration) {
    const label = `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
    if ((!isToday || time > currentMinutes) && slotIsFree(store, provider, date, label, ignoreId)) slots.push(label);
  }
  return slots;
}

function appointmentInput(store, input, existing, user) {
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
  if (!parseDate(date) || date < new Date().toLocaleDateString('en-CA')) fail(400, 'Choose a valid date that is not in the past.');
  if (!visitorName) fail(400, 'Enter the name of the person attending.');
  if (store.settings.registrationRequired && !user && !existing) fail(401, 'Create an account or sign in to book at this studio.');
  if (store.settings.registrationRequired && anonymous) fail(400, 'This studio requires an account to book.');
  if (!anonymous && (!patronName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patronEmail))) {
    fail(400, 'Enter the booking contact name and a valid email address.');
  }

  const available = getAvailability(store, provider, date, existing?.id);
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
    updatedAt: new Date().toISOString()
  };
}

async function handleApi(request, response, url) {
  const { pathname, searchParams } = url;

  if (pathname === '/api/auth/register' && request.method === 'POST') {
    const input = await readBody(request);
    const name = String(input.name || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');
    const role = input.role;
    const providerId = role === 'stylist' ? String(input.providerId || '') : '';

    if (!name || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter your name and a valid email address.');
    if (password.length < 10) fail(400, 'Use a password with at least 10 characters.');
    if (!['patron', 'stylist'].includes(role)) fail(400, 'Choose a customer or stylist account.');
    if (role === 'stylist' && (!process.env.STYLIST_INVITE_CODE || input.inviteCode !== process.env.STYLIST_INVITE_CODE)) {
      fail(403, 'A valid studio invitation code is required to create a stylist account.');
    }

    const result = await changeStore((store) => {
      if (store.users.some((user) => user.email === email)) fail(409, 'An account with that email already exists.');
      if (role === 'stylist') {
        const provider = store.providers.find((item) => item.id === providerId);
        if (!provider || provider.accountUserId) fail(400, 'Choose an available stylist profile.');
      }
      const credentials = passwordRecord(password);
      const user = {
        id: randomUUID(), name, email, role, providerId: providerId || null,
        favoriteProviderId: '', favoriteServiceId: '',
        passwordSalt: credentials.salt, passwordHash: credentials.hash,
        createdAt: new Date().toISOString()
      };
      store.users.push(user);
      if (providerId) store.providers.find((item) => item.id === providerId).accountUserId = user.id;
      setSession(response, store, user);
      return user;
    });
    return sendJson(response, 201, { user: publicUser(result) });
  }

  if (pathname === '/api/auth/login' && request.method === 'POST') {
    const input = await readBody(request);
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');
    const result = await changeStore((store) => {
      const user = store.users.find((item) => item.email === email);
      if (!user || !passwordMatches(password, user)) fail(401, 'Email or password is incorrect.');
      setSession(response, store, user);
      return user;
    });
    return sendJson(response, 200, { user: publicUser(result) });
  }

  if (pathname === '/api/auth/session' && request.method === 'DELETE') {
    const token = Object.fromEntries((request.headers.cookie || '').split(';').map((part) => {
      const separator = part.indexOf('=');
      return separator < 0 ? ['', ''] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    })).goodday_session;
    if (token) await changeStore((store) => { delete store.sessions[sessionTokenHash(token)]; });
    response.setHeader('set-cookie', 'goodday_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    return sendJson(response, 200, { user: null });
  }

  if (pathname === '/api/auth/me' && request.method === 'GET') {
    const store = await readStore();
    return sendJson(response, 200, { user: publicUser(userFromRequest(store, request)) });
  }

  if (pathname === '/api/account' && request.method === 'GET') {
    const store = await readStore();
    const user = requireUser(userFromRequest(store, request));
    if (user.role !== 'patron') fail(403, 'Customer preferences are only available on a customer account.');
    const history = store.appointments
      .filter((appointment) => appointment.patronUserId === user.id)
      .sort((left, right) => right.date.localeCompare(left.date) || right.time.localeCompare(left.time));
    return sendJson(response, 200, { user: publicUser(user), history });
  }

  if (pathname === '/api/account' && request.method === 'PATCH') {
    const input = await readBody(request);
    const requestUser = userFromRequest(await readStore(), request);
    requireUser(requestUser);
    const result = await changeStore((store) => {
      const user = store.users.find((item) => item.id === requestUser.id);
      if (user.role !== 'patron') fail(403, 'Only customers can update booking preferences.');
      const favoriteProviderId = String(input.favoriteProviderId || '');
      const favoriteServiceId = String(input.favoriteServiceId || '');
      if (favoriteProviderId && !store.providers.some((item) => item.id === favoriteProviderId)) fail(400, 'Choose a valid favorite stylist.');
      if (favoriteServiceId && !store.services.some((item) => item.id === favoriteServiceId)) fail(400, 'Choose a valid favorite service.');
      user.favoriteProviderId = favoriteProviderId;
      user.favoriteServiceId = favoriteServiceId;
      return user;
    });
    return sendJson(response, 200, { user: publicUser(result) });
  }

  if (request.method === 'GET' && pathname === '/api/bootstrap') {
    const store = await readStore();
    const providers = store.providers.map(({ accountUserId, ...provider }) => ({ ...provider, accountAvailable: !accountUserId }));
    return sendJson(response, 200, { settings: store.settings, services: store.services, providers, user: publicUser(userFromRequest(store, request)) });
  }

  if (request.method === 'GET' && pathname === '/api/availability') {
    const store = await readStore();
    const provider = store.providers.find((item) => item.id === searchParams.get('providerId'));
    if (!provider) return sendJson(response, 404, { error: 'Service provider not found.' });
    return sendJson(response, 200, { slots: getAvailability(store, provider, searchParams.get('date'), searchParams.get('ignoreId')) });
  }

  if (request.method === 'GET' && pathname === '/api/appointments') {
    const store = await readStore();
    const user = requireUser(userFromRequest(store, request));
    const date = searchParams.get('date');
    const requestedProviderId = searchParams.get('providerId');
    if (user.role === 'stylist' && requestedProviderId && requestedProviderId !== user.providerId) fail(403, 'You can only view your own schedule.');
    const appointments = store.appointments
      .filter((item) => (!date || item.date === date) && (user.role === 'stylist'
        ? item.providerId === user.providerId
        : item.patronUserId === user.id && (!requestedProviderId || item.providerId === requestedProviderId)))
      .sort((left, right) => left.date.localeCompare(right.date) || left.time.localeCompare(right.time));
    return sendJson(response, 200, { appointments });
  }

  if (request.method === 'PATCH' && pathname === '/api/settings') {
    const input = await readBody(request);
    const result = await changeStore((store) => {
      if (typeof input.registrationRequired !== 'boolean') fail(400, 'Choose whether registration is required.');
      store.settings.registrationRequired = input.registrationRequired;
      return store.settings;
    });
    return sendJson(response, 200, { settings: result });
  }

  const providerMatch = /^\/api\/providers\/([^/]+)$/.exec(pathname);
  if (request.method === 'PATCH' && providerMatch) {
    const input = await readBody(request);
    const result = await changeStore((store) => {
      const provider = store.providers.find((item) => item.id === providerMatch[1]);
      if (!provider) fail(404, 'Service provider not found.');
      const start = minutes(input.start);
      const end = minutes(input.end);
      const duration = Number(input.slotDuration);
      if (start < 0 || end <= start || ![15, 30, 45, 60, 90, 120].includes(duration) || end - start < duration) {
        fail(400, 'Enter valid working hours and an appointment length that fits within them.');
      }
      provider.start = input.start;
      provider.end = input.end;
      provider.slotDuration = duration;
      return provider;
    });
    return sendJson(response, 200, { provider: result });
  }

  if (request.method === 'POST' && pathname === '/api/appointments') {
    const input = await readBody(request);
    const user = userFromRequest(await readStore(), request);
    if (user?.role === 'stylist') fail(403, 'Stylist accounts cannot create customer bookings.');
    const appointment = await changeStore((store) => {
      const record = { id: randomUUID(), ...appointmentInput(store, input, null, user) };
      record.createdAt = record.updatedAt;
      store.appointments.push(record);
      return record;
    });
    return sendJson(response, 201, { appointment });
  }

  const appointmentMatch = /^\/api\/appointments\/([^/]+)$/.exec(pathname);
  if (appointmentMatch && request.method === 'PATCH') {
    const input = await readBody(request);
    const user = requireUser(userFromRequest(await readStore(), request));
    const appointment = await changeStore((store) => {
      const index = store.appointments.findIndex((item) => item.id === appointmentMatch[1]);
      if (index < 0) fail(404, 'Appointment not found.');
      requireAppointmentAccess(user, store.appointments[index]);
      if (user.role === 'stylist' && input.providerId !== user.providerId) fail(403, 'You can only keep this appointment on your own calendar.');
      const updated = { ...store.appointments[index], ...appointmentInput(store, input, store.appointments[index], user) };
      store.appointments[index] = updated;
      return updated;
    });
    return sendJson(response, 200, { appointment });
  }

  if (appointmentMatch && request.method === 'DELETE') {
    const user = requireUser(userFromRequest(await readStore(), request));
    const result = await changeStore((store) => {
      const index = store.appointments.findIndex((item) => item.id === appointmentMatch[1]);
      if (index < 0) fail(404, 'Appointment not found.');
      requireAppointmentAccess(user, store.appointments[index]);
      return store.appointments.splice(index, 1)[0];
    });
    return sendJson(response, 200, { appointment: result });
  }

  return sendJson(response, 404, { error: 'API route not found.' });
}

const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

async function handleStatic(response, pathname) {
  const requestedPath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const filePath = resolve(publicDirectory, `.${requestedPath}`);
  if (!filePath.startsWith(`${publicDirectory}${sep}`)) return sendJson(response, 403, { error: 'Forbidden.' });
  try {
    const content = await readFile(filePath);
    response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    response.end(content);
  } catch (error) {
    sendJson(response, error.code === 'ENOENT' ? 404 : 500, { error: error.code === 'ENOENT' ? 'File not found.' : 'Unable to read file.' });
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) await handleApi(request, response, url);
    else if (request.method === 'GET') await handleStatic(response, url.pathname);
    else sendJson(response, 405, { error: 'Method not allowed.' });
  } catch (error) {
    sendJson(response, error.status || 500, { error: error.status ? error.message : 'Something went wrong. Please try again.' });
  }
});

server.listen(port, () => console.log(`Goodday Booking running at http://localhost:${port}`));