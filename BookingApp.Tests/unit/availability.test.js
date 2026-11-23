import { describe, expect, it } from 'vitest';
import { getAvailability } from '../../booking-rules.js';
import { booking, createStore, fixture } from './fixtures.js';

describe('getAvailability', () => {
  it('returns slots on a working day without bookings', () => {
    const { store, provider, now } = fixture();

    expect(getAvailability(store, provider, '2026-10-19', now))
      .toEqual(['09:00', '09:30']);
  });

  it('includes a slot that ends exactly at closing', () => {
    const { store, provider, now } = fixture();
    provider.end = '09:30';

    expect(getAvailability(store, provider, '2026-10-19', now))
      .toEqual(['09:00']);
  });

  it('excludes a slot that would end after closing', () => {
    const { store, provider, now } = fixture();
    provider.end = '09:29';

    expect(getAvailability(store, provider, '2026-10-19', now)).toEqual([]);
  });

  it('returns no slots on a non-working day', () => {
    const { store, provider, now } = fixture();

    expect(getAvailability(store, provider, '2026-10-20', now)).toEqual([]);
  });

  it.each([
    ['Saturday before the non-working Sunday', '2026-10-24', ['09:00', '09:30']],
    ['Sunday between working days', '2026-10-25', []],
    ['Monday after the non-working Sunday', '2026-10-26', ['09:00', '09:30']]
  ])('handles %s', (_description, date, expected) => {
    const { store, provider, now } = fixture();
    provider.workingDays = [1, 6];

    expect(getAvailability(store, provider, date, now)).toEqual(expected);
  });

  it('excludes past and current slots when checking today', () => {
    const { store, provider } = fixture();

    expect(getAvailability(store, provider, '2026-10-19', new Date(2026, 9, 19, 9, 30)))
      .toEqual([]);
  });

  it('includes a slot starting after the current time', () => {
    const { store, provider } = fixture();

    expect(getAvailability(store, provider, '2026-10-19', new Date(2026, 9, 19, 9, 29)))
      .toEqual(['09:30']);
  });

  it('excludes slots that have already started', () => {
    const { store, provider } = fixture();

    expect(getAvailability(store, provider, '2026-10-19', new Date(2026, 9, 19, 9, 31)))
      .toEqual([]);
  });

  it('excludes only the slot overlapping an existing booking', () => {
    const { store, provider, now } = fixture();
    store.appointments.push(booking());

    expect(getAvailability(store, provider, '2026-10-19', now)).toEqual(['09:30']);
  });

  it('can ignore the booking being edited', () => {
    const { store, provider, now } = fixture();
    const existing = booking();
    store.appointments.push(existing);

    expect(getAvailability(store, provider, '2026-10-19', now, existing.id))
      .toEqual(['09:00', '09:30']);
  });

  it('does not let one provider booking block another provider', () => {
    const store = createStore();
    const jules = store.providers[0];
    const leo = { ...jules, id: 'leo', name: 'Leo Nguyen' };
    store.providers.push(leo);
    store.appointments.push({
      id: 'appointment-1',
      providerId: jules.id,
      date: '2026-12-07',
      time: '09:00',
      durationMinutes: 30
    });

    expect(getAvailability(
      store,
      leo,
      '2026-12-07',
      new Date(2026, 11, 6, 8, 0)
    )).toContain('09:00');
  });
});
