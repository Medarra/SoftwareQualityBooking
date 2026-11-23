import { BookingRuleError } from '../../booking-rules.js';

// Shared test data for Tian's unit tests. Each call returns fresh objects so tests stay independent.
// Monday 2026-10-19 is the booking date; "now" is the preceding Friday at 08:00 local time.
export function fixture() {
  const provider = {
    id: 'provider-1', name: 'Stylist One', serviceIds: ['service-1'],
    start: '09:00', end: '10:00', slotDuration: 30, workingDays: [1]
  };
  const patron = { id: 'patron-1', role: 'patron', name: 'Tian', email: 'tian@example.test' };
  const store = {
    providers: [provider], services: [{ id: 'service-1', name: 'Haircut', price: 30 }],
    users: [patron], settings: { registrationRequired: false }, appointments: []
  };
  const input = {
    providerId: 'provider-1', serviceId: 'service-1', date: '2026-10-19',
    time: '09:00', visitorName: 'Tian', anonymous: false
  };
  return { store, provider, patron, input, now: new Date(2026, 9, 16, 8, 0) };
}

export function booking(overrides = {}) {
  return {
    id: 'appointment-1', providerId: 'provider-1', patronUserId: 'patron-1',
    date: '2026-10-19', time: '09:00', durationMinutes: 30, ...overrides
  };
}

// Runs act and returns the BookingRuleError it throws, or null if it did not throw one.
export function caughtRuleError(act) {
  try {
    act();
  } catch (error) {
    if (error instanceof BookingRuleError) return error;
    throw error;
  }
  return null;
}
