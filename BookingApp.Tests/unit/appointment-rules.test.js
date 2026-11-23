import { describe, expect, it } from 'vitest';
import {
  appointmentInput,
  cancelAppointment,
  parseBookingDate,
  timeToMinutes
} from '../../booking-rules.js';
import { booking, caughtRuleError, fixture } from './fixtures.js';

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
    const { store, patron } = fixture();
    const selected = booking();
    const remaining = booking({ id: 'appointment-2', time: '09:30' });
    store.appointments.push(selected, remaining);

    expect(cancelAppointment(store, selected.id, patron)).toBe(selected);
    expect(store.appointments).toEqual([remaining]);
  });

  it('leaves an empty list after cancelling the last booking', () => {
    const { store, patron } = fixture();
    store.appointments.push(booking());

    cancelAppointment(store, 'appointment-1', patron);

    expect(store.appointments).toEqual([]);
  });

  it('rejects another patron cancelling a booking and leaves it unchanged', () => {
    const { store, patron } = fixture();
    const existing = booking({ patronUserId: 'patron-2' });
    store.appointments.push(existing);

    expect(caughtRuleError(() => cancelAppointment(store, existing.id, patron))
      ?.status).toBe(403);
    expect(store.appointments).toEqual([existing]);
  });

  it('returns not found when the booking does not exist', () => {
    const { store, patron } = fixture();

    expect(caughtRuleError(() => cancelAppointment(store, 'missing', patron))
      ?.status).toBe(404);
  });
});
