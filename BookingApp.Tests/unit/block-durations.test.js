import { describe, expect, it } from 'vitest';
import {
  appointmentInput,
  getAvailability,
  updateProviderAvailability
} from '../../booking-rules.js';
import { caughtRuleError, createInput, createStore } from './fixtures.js';

const now = new Date(2026, 11, 7, 8, 0);

describe('availability block durations', () => {
  it('returns two slots when 30-minute slots fit in one hour', () => {
    const store = { appointments: [] };
    const provider = {
      id: 'jules',
      start: '09:00',
      end: '10:00',
      slotDuration: 30,
      workingDays: [1]
    };

    expect(getAvailability(store, provider, '2026-12-07', now))
      .toEqual(['09:00', '09:30']);
  });

  it('returns one slot when a 60-minute slot exactly fits', () => {
    const store = { appointments: [] };
    const provider = {
      id: 'jules',
      start: '16:00',
      end: '17:00',
      slotDuration: 60,
      workingDays: [1]
    };

    expect(getAvailability(store, provider, '2026-12-07', now)).toEqual(['16:00']);
  });

  it('returns no slots when the duration exceeds working hours', () => {
    const store = { appointments: [] };
    const provider = {
      id: 'jules',
      start: '12:00',
      end: '12:30',
      slotDuration: 45,
      workingDays: [1]
    };

    expect(getAvailability(store, provider, '2026-12-07', now)).toEqual([]);
  });
});

describe('updateProviderAvailability', () => {
  it('allows a stylist to set a valid block duration', () => {
    const store = createStore();
    const input = {
      start: '09:00',
      end: '16:00',
      slotDuration: 45,
      workingDays: [1, 2, 3, 4, 5, 6]
    };
    const stylist = { role: 'stylist', providerId: 'jules' };

    expect(updateProviderAvailability(store, 'jules', input, stylist).slotDuration)
      .toBe(45);
  });

  it('accepts a schedule exactly one slot long', () => {
    const store = createStore();
    const input = {
      start: '09:00',
      end: '09:30',
      slotDuration: 30,
      workingDays: [1]
    };

    expect(updateProviderAvailability(store, 'jules', input, { role: 'admin' }).end)
      .toBe('09:30');
  });

  it('accepts a schedule with one minute left after a slot', () => {
    const store = createStore();
    const input = {
      start: '09:00',
      end: '09:31',
      slotDuration: 30,
      workingDays: [1]
    };

    expect(updateProviderAvailability(store, 'jules', input, { role: 'admin' }).end)
      .toBe('09:31');
  });

  it('accepts schedules at the minimum and maximum supported durations', () => {
    for (const [end, slotDuration] of [['09:15', 15], ['10:00', 60]]) {
      const store = createStore();
      const input = { start: '09:00', end, slotDuration, workingDays: [1] };

      expect(updateProviderAvailability(store, 'jules', input, { role: 'admin' }).slotDuration)
        .toBe(slotDuration);
    }
  });

  it('rejects hours shorter than the selected duration', () => {
    const store = createStore();
    const input = {
      start: '09:00',
      end: '09:29',
      slotDuration: 30,
      workingDays: [1]
    };

    expect(() => updateProviderAvailability(store, 'jules', input, { role: 'admin' }))
      .toThrow(/valid working hours/i);
  });

  it('prevents a stylist from changing another provider schedule', () => {
    const store = createStore();
    const input = {
      start: '10:00',
      end: '12:00',
      slotDuration: 30,
      workingDays: [1]
    };

    expect(caughtRuleError(() => updateProviderAvailability(
      store,
      'jules',
      input,
      { role: 'stylist', providerId: 'other-provider' }
    ))?.status).toBe(403);
  });

  it('rejects unsupported durations without changing the existing schedule', () => {
    const store = createStore();
    const input = {
      start: '09:00',
      end: '16:00',
      slotDuration: 20,
      workingDays: [1, 2, 3, 4, 5, 6]
    };

    expect(caughtRuleError(() => updateProviderAvailability(
      store,
      'jules',
      input,
      { role: 'stylist', providerId: 'jules' }
    ))?.status).toBe(400);
    expect(store.providers[0].slotDuration).toBe(30);
  });
});

describe('appointment duration and closing time', () => {
  it('accepts appointments before or exactly at closing', () => {
    for (const time of ['15:00', '16:30']) {
      const store = createStore();
      const input = createInput();
      input.time = time;

      expect(appointmentInput(store, input, null, null, now)).toBeTruthy();
    }
  });

  it('rejects an appointment ending after closing', () => {
    const store = createStore();
    store.providers[0].slotDuration = 60;
    const input = createInput();
    input.time = '16:30';

    expect(caughtRuleError(() => appointmentInput(store, input, null, null, now))
      ?.status).toBe(409);
  });
});
