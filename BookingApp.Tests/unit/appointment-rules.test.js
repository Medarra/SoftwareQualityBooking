import { describe, expect, it } from 'vitest';
import {
  appointmentInput,
  cancelAppointment,
  parseBookingDate,
  timeToMinutes
} from '../../booking-rules.js';
import {
  booking,
  caughtRuleError,
  createInput,
  createStore,
  fixture
} from './fixtures.js';

describe('parseBookingDate', () => {
  it('accepts a leap-day date', () => {
    expect(parseBookingDate('2024-02-29')?.toISOString().slice(0, 10))
      .toBe('2024-02-29');
  });

  it('rejects a non-leap-year February 29', () => {
    expect(parseBookingDate('2025-02-29')).toBeNull();
  });

  it('rejects dates in the wrong format', () => {
    expect(parseBookingDate('2026/01/05')).toBeNull();
  });
});

describe('timeToMinutes', () => {
  it('converts valid times and clock boundaries to minutes after midnight', () => {
    expect(['09:30', '00:00', '23:59'].map(timeToMinutes))
      .toEqual([570, 0, 1439]);
  });

  it('rejects malformed or out-of-range times', () => {
    expect(['24:00', '12:60', '9:30', 'noon'].map(timeToMinutes))
      .toEqual([-1, -1, -1, -1]);
  });
});

describe('appointmentInput', () => {
  it('returns normalized booking details for a valid booking', () => {
    const { store, input, patron, now } = fixture();
    input.visitorName = '  Tian  ';

    expect(appointmentInput(store, input, null, patron, now)).toEqual({
      providerId: 'provider-1',
      providerName: 'Stylist One',
      serviceId: 'service-1',
      serviceName: 'Haircut',
      price: 30,
      date: '2026-10-19',
      time: '09:00',
      durationMinutes: 30,
      visitorName: 'Tian',
      anonymous: false,
      patronName: 'Tian',
      patronEmail: 'tian@example.test',
      patronUserId: 'patron-1',
      updatedAt: now.toISOString()
    });
  });

  it('accepts a booking today before its start time', () => {
    const { store, input, patron } = fixture();
    const now = new Date(2026, 9, 19, 8, 59);

    expect(appointmentInput(store, input, null, patron, now).time).toBe('09:00');
  });

  it('rejects a slot starting at the current time', () => {
    const { store, input, patron } = fixture();
    const now = new Date(2026, 9, 19, 9, 0);

    expect(caughtRuleError(() => appointmentInput(store, input, null, patron, now))
      ?.status).toBe(409);
  });

  it('rejects a booking in the past', () => {
    const { store, input, patron } = fixture();
    const now = new Date(2026, 9, 20, 8, 0);

    expect(caughtRuleError(() => appointmentInput(store, input, null, patron, now))
      ?.status).toBe(400);
  });

  it('accepts a booking for tomorrow', () => {
    const now = new Date(2026, 9, 19, 10, 0);
    const store = createStore();
    const input = createInput();
    input.date = '2026-10-20';
    input.time = '11:00';

    expect(appointmentInput(store, input, null, null, now).date).toBe('2026-10-20');
  });

  it('accepts a later appointment today', () => {
    const now = new Date(2026, 9, 19, 10, 0);
    const store = createStore();
    const input = createInput();
    input.date = '2026-10-19';
    input.time = '11:00';

    expect(appointmentInput(store, input, null, null, now).time).toBe('11:00');
  });

  it('rejects a booking yesterday', () => {
    const now = new Date(2026, 9, 19, 10, 0);
    const store = createStore();
    const input = createInput();
    input.date = '2026-10-18';

    expect(caughtRuleError(() => appointmentInput(store, input, null, null, now))
      ?.status).toBe(400);
  });

  it('allows editing a booking without conflicting with itself', () => {
    const { store, input, now } = fixture();
    const existing = booking({ anonymous: true, patronUserId: null });
    store.appointments.push(existing);
    input.time = existing.time;
    input.anonymous = true;

    expect(appointmentInput(store, input, existing, null, now).time)
      .toBe(existing.time);
  });

  it('rejects editing into another booking', () => {
    const { store, input, now } = fixture();
    const existing = booking({ anonymous: true, patronUserId: null });
    store.appointments.push(existing, booking({ id: 'appointment-2', time: '09:30' }));
    input.time = '09:30';
    input.anonymous = true;

    expect(caughtRuleError(() => appointmentInput(store, input, existing, null, now))
      ?.status).toBe(409);
  });

  it('allows editing a future appointment', () => {
    const now = new Date(2026, 9, 19, 10, 0);
    const store = createStore();
    const input = createInput();
    input.date = '2026-10-20';
    input.time = '12:00';
    const existing = {
      id: 'appointment-1',
      providerId: 'jules',
      date: '2026-10-20',
      time: '11:00',
      patronUserId: null,
      anonymous: true
    };

    expect(appointmentInput(store, input, existing, null, now).time).toBe('12:00');
  });

  it.each([
    ['current', '2026-10-19', '10:00'],
    ['past', '2026-10-18', '11:00']
  ])('rejects editing a %s appointment', (_label, date, time) => {
    const now = new Date(2026, 9, 19, 10, 0);
    const store = createStore();
    const input = createInput();
    input.date = '2026-10-20';
    input.time = '12:00';
    const existing = {
      id: 'appointment-1',
      providerId: 'jules',
      date,
      time,
      patronUserId: null,
      anonymous: true
    };

    expect(caughtRuleError(() => appointmentInput(store, input, existing, null, now))
      ?.status).toBe(400);
  });

  it('rejects a booking that overlaps an existing appointment', () => {
    const { store, input, now } = fixture();
    store.appointments.push(booking({ time: '09:30' }));
    input.time = '09:30';
    input.anonymous = true;

    expect(caughtRuleError(() => appointmentInput(store, input, null, null, now))
      ?.status).toBe(409);
  });

  it('requires a signed-in user when registration is required', () => {
    const { store, input } = fixture();
    store.settings.registrationRequired = true;
    input.anonymous = true;

    expect(() => appointmentInput(store, input, null, null, new Date(2026, 9, 16, 8, 0)))
      .toThrow(/sign in/i);
  });
});

describe('cancelAppointment', () => {
  it('removes only the selected booking', () => {
    const { store, patron, now } = fixture();
    const selected = booking();
    const remaining = booking({ id: 'appointment-2', time: '09:30' });
    store.appointments.push(selected, remaining);

    expect(cancelAppointment(store, selected.id, patron, now)).toBe(selected);
    expect(store.appointments).toEqual([remaining]);
  });

  it('leaves an empty list after cancelling the last booking', () => {
    const { store, patron, now } = fixture();
    store.appointments.push(booking());

    cancelAppointment(store, 'appointment-1', patron, now);

    expect(store.appointments).toEqual([]);
  });

  it('rejects another patron cancelling a booking and leaves it unchanged', () => {
    const { store, patron, now } = fixture();
    const existing = booking({ patronUserId: 'patron-2' });
    store.appointments.push(existing);

    expect(caughtRuleError(() => cancelAppointment(store, existing.id, patron, now))
      ?.status).toBe(403);
    expect(store.appointments).toEqual([existing]);
  });

  it('returns not found when the booking does not exist', () => {
    const { store, patron, now } = fixture();

    expect(caughtRuleError(() => cancelAppointment(store, 'missing', patron, now))
      ?.status).toBe(404);
  });

  it('allows cancellation with exactly 24 hours notice', () => {
    const now = new Date(2026, 9, 19, 10, 0);
    const store = createStore();
    const appointment = {
      id: 'appointment-1',
      providerId: 'jules',
      date: '2026-10-20',
      time: '10:00',
      patronUserId: 'patron-1'
    };
    store.appointments.push(appointment);

    expect(cancelAppointment(store, appointment.id, { id: 'patron-1', role: 'patron' }, now))
      .toBe(appointment);
  });

  it('rejects cancellation with less than 24 hours notice without removing the booking', () => {
    const now = new Date(2026, 9, 19, 10, 0);
    const store = createStore();
    const appointment = {
      id: 'appointment-1',
      providerId: 'jules',
      date: '2026-10-20',
      time: '09:59',
      patronUserId: 'patron-1'
    };
    store.appointments.push(appointment);

    expect(caughtRuleError(() => cancelAppointment(
      store,
      appointment.id,
      { id: 'patron-1', role: 'patron' },
      now
    ))?.status).toBe(400);
    expect(store.appointments).toEqual([appointment]);
  });
});
