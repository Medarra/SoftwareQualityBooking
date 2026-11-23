import { describe, expect, it } from 'vitest';
import { appointmentInput } from '../../booking-rules.js';
import { getEligibleProviders } from '../../public/provider-rules.js';
import { caughtRuleError, createInput, createStore } from './fixtures.js';

const now = new Date(2026, 11, 7, 8, 0);

describe('provider and service compatibility', () => {
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

    expect(caughtRuleError(() => appointmentInput(store, input, null, null, now))
      ?.status).toBe(400);
  });

  it('rejects an unknown provider', () => {
    const store = createStore();
    const input = createInput();
    input.providerId = 'missing-provider';

    expect(caughtRuleError(() => appointmentInput(store, input, null, null, now))
      ?.status).toBe(400);
  });

  it('rejects an unknown service', () => {
    const store = createStore();
    const input = createInput();
    input.serviceId = 'missing-service';

    expect(caughtRuleError(() => appointmentInput(store, input, null, null, now))
      ?.status).toBe(400);
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

    const imaniInput = createInput();
    imaniInput.providerId = 'imani';
    imaniInput.serviceId = 'colour';
    imaniInput.time = '10:00';
    expect(appointmentInput(store, imaniInput, null, null, now))
      .toMatchObject({ providerId: 'imani', serviceId: 'colour' });

    expect(getEligibleProviders(store.providers, 'cut').map(({ id }) => id))
      .toEqual(['jules', 'imani']);
    expect(getEligibleProviders(store.providers, 'beard').map(({ id }) => id))
      .toEqual(['jules']);
    expect(getEligibleProviders(store.providers, 'fade')).toEqual([]);
  });
});
