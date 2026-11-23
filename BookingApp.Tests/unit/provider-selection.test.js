import { describe, expect, it } from 'vitest';
import { appointmentInput } from '../../booking-rules.js';
import { getEligibleProviders } from '../../public/provider-rules.js';
import { createInput, createStore } from './fixtures.js';

describe('provider and service compatibility', () => {
  const now = new Date(2026, 11, 7, 8, 0);

  it('accepts a booking for a service offered by the selected provider', () => {
    const store = createStore();
    const input = createInput();
    input.serviceId = 'beard';

    expect(appointmentInput(store, input, null, null, now))
      .toMatchObject({ providerId: 'jules', serviceId: 'beard' });
  });

  it('accepts a booking when the selected service is the provider only offering', () => {
    const store = createStore();
    store.providers[0].serviceIds = ['beard'];
    const input = createInput();
    input.serviceId = 'beard';

    expect(appointmentInput(store, input, null, null, now).serviceId).toBe('beard');
  });

  it('rejects a booking for a service the provider does not offer', () => {
    const store = createStore();
    const input = createInput();
    input.serviceId = 'colour';

    expect(() => appointmentInput(store, input, null, null, now)).toThrow();
  });
});

describe('getEligibleProviders', () => {
  it('returns all and only providers offering the selected service', () => {
    const store = createStore();
    store.providers.push({
      id: 'imani',
      name: 'Imani Brooks',
      start: '10:00',
      end: '18:00',
      slotDuration: 45,
      workingDays: [1, 2, 3, 4, 5, 6],
      serviceIds: ['cut', 'colour']
    });

    expect(getEligibleProviders(store.providers, 'cut').map(({ id }) => id))
      .toEqual(['jules', 'imani']);
    expect(getEligibleProviders(store.providers, 'beard').map(({ id }) => id))
      .toEqual(['jules']);
    expect(getEligibleProviders(store.providers, 'fade')).toEqual([]);
  });
});
