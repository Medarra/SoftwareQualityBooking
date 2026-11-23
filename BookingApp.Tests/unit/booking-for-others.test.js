import { describe, expect, it } from 'vitest';
import { appointmentInput, cancelAppointment } from '../../booking-rules.js';
import { createInput, createStore } from './fixtures.js';

const patron = {
  id: 'patron-1',
  role: 'patron',
  name: 'Alex Morgan',
  email: 'alex@example.com'
};
const now = new Date(2026, 11, 6, 8, 0);

function makeBookingInput(overrides = {}) {
  return {
    ...createInput(),
    date: '2026-12-07',
    time: '10:00',
    visitorName: 'Sam Morgan',
    ...overrides
  };
}

function saveBooking(store, changes = {}) {
  const input = makeBookingInput(changes);
  const booking = {
    id: `appointment-${store.appointments.length + 1}`,
    ...appointmentInput(store, input, null, patron, now)
  };
  store.appointments.push(booking);
  return booking;
}

describe('booking for another person', () => {
  it('keeps the visitor and booking patron details distinct', () => {
    const store = createStore();

    expect(appointmentInput(
      store,
      makeBookingInput({ visitorName: 'Sam Morgan' }),
      null,
      patron,
      now
    )).toMatchObject({
      visitorName: 'Sam Morgan',
      patronName: patron.name,
      patronEmail: patron.email,
      patronUserId: patron.id
    });
  });

  it('allows patrons to book for themselves', () => {
    const store = createStore();

    expect(appointmentInput(
      store,
      makeBookingInput({ visitorName: patron.name }),
      null,
      patron,
      now
    ).visitorName).toBe(patron.name);
  });

  it.each(['', '   '])('rejects a visitor name containing only %j', (visitorName) => {
    const store = createStore();

    expect(() => appointmentInput(
      store,
      makeBookingInput({ visitorName }),
      null,
      patron,
      now
    )).toThrow('Enter the name of the person attending.');
  });

  it('forces a signed-in patron booking onto their account', () => {
    const store = createStore();

    expect(appointmentInput(
      store,
      makeBookingInput({ anonymous: true }),
      null,
      patron,
      now
    )).toMatchObject({ anonymous: false, patronUserId: patron.id });
  });
});

describe('multiple visitor bookings', () => {
  it('allows the same patron to book two providers at the same time', () => {
    const store = createStore();
    store.providers.push({
      ...store.providers[0],
      id: 'leo',
      name: 'Leo Nguyen'
    });
    saveBooking(store);
    const second = saveBooking(store, { providerId: 'leo', visitorName: 'Jamie Morgan' });

    expect(second.providerId).toBe('leo');
    expect(store.appointments).toHaveLength(2);
  });

  it('rejects two visitors booking the same provider and time', () => {
    const store = createStore();
    saveBooking(store);

    expect(() => appointmentInput(
      store,
      makeBookingInput({ visitorName: 'Jamie Morgan' }),
      null,
      patron,
      now
    )).toThrow();
  });

  it('allows back-to-back bookings with the same provider', () => {
    const store = createStore();
    saveBooking(store);

    expect(appointmentInput(
      store,
      makeBookingInput({ time: '10:30', visitorName: 'Jamie Morgan' }),
      null,
      patron,
      now
    ).time).toBe('10:30');
  });

  it('allows another booking for the same patron on a different date', () => {
    const store = createStore();
    saveBooking(store);

    expect(appointmentInput(
      store,
      makeBookingInput({ date: '2026-12-08', visitorName: 'Jamie Morgan' }),
      null,
      patron,
      now
    ).date).toBe('2026-12-08');
  });
});

describe('cancelling bookings made for another person', () => {
  it('allows the booking patron to cancel', () => {
    const store = createStore();
    const booking = saveBooking(store);

    expect(cancelAppointment(store, booking.id, patron, now)).toBe(booking);
    expect(store.appointments).toEqual([]);
  });
});
