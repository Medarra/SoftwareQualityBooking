import { describe, expect, it } from 'vitest';
import { getAvailability } from '../../booking-rules.js';
import { booking, fixture } from './fixtures.js';

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
});
