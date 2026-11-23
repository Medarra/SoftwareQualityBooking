import { BookingRuleError } from '../../booking-rules.js';

export function createStore() {
  return {
    settings: { registrationRequired: false },
    users: [],
    services: [
      { id: 'cut', name: 'Signature cut', price: 38 },
      { id: 'fade', name: 'Skin fade', price: 34 },
      { id: 'beard', name: 'Beard tity', price: 22 },
      { id: 'colour', name: 'Hair colour', price: 65 }
    ],
    providers: [{
      id: 'jules',
      name: 'Jules Carter',
      start: '09:00',
      end: '17:00',
      slotDuration: 30,
      workingDays: [1, 2, 3, 4, 5, 6],
      serviceIds: ['cut', 'beard']
    }],
    appointments: []
  };
}

export function createInput() {
  return {
    providerId: 'jules',
    serviceId: 'cut',
    date: '2026-12-07',
    time: '09:00',
    visitorName: 'Nemo',
    anonymous: true
  };
}

export function fixture() {
  const provider = {
    id: 'provider-1',
    name: 'Stylist One',
    serviceIds: ['service-1'],
    start: '09:00',
    end: '10:00',
    slotDuration: 30,
    workingDays: [1]
  };
  const patron = {
    id: 'patron-1',
    role: 'patron',
    name: 'Tian',
    email: 'tian@example.test'
  };
  const store = {
    providers: [provider],
    services: [{ id: 'service-1', name: 'Haircut', price: 30 }],
    users: [patron],
    settings: { registrationRequired: false },
    appointments: []
  };
  const input = {
    providerId: provider.id,
    serviceId: 'service-1',
    date: '2026-10-19',
    time: '09:00',
    visitorName: 'Tian',
    anonymous: false
  };

  return {
    store,
    provider,
    patron,
    input,
    now: new Date(2026, 9, 16, 8, 0)
  };
}

export function booking(overrides = {}) {
  return {
    id: 'appointment-1',
    providerId: 'provider-1',
    patronUserId: 'patron-1',
    date: '2026-10-19',
    time: '09:00',
    durationMinutes: 30,
    ...overrides
  };
}

export function caughtRuleError(action) {
  try {
    action();
  } catch (error) {
    if (error instanceof BookingRuleError) {
      return error;
    }
    throw error;
  }
  return null;
}
