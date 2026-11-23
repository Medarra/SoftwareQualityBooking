import { describe, expect, it } from 'vitest';
import { appointmentInput } from '../../booking-rules.js';
import { caughtRuleError, createInput, createStore } from './fixtures.js';

const now = new Date(2026, 11, 6, 8, 0);

function patronInput(overrides = {}) {
  return {
    ...createInput(),
    date: '2026-12-07',
    time: '10:00',
    anonymous: false,
    patronName: 'Test Customer',
    patronEmail: 'customer@example.com',
    ...overrides
  };
}

describe('registration requirements', () => {
  it('allows a guest booking when registration is optional', () => {
    const store = createStore();
    const input = { ...patronInput(), anonymous: true };

    expect(appointmentInput(store, input, null, null, now).patronUserId).toBeNull();
  });

  it('allows a signed-in patron when registration is required', () => {
    const store = createStore();
    store.settings.registrationRequired = true;
    const patron = {
      id: 'patron-1',
      role: 'patron',
      name: 'Test Customer',
      email: 'customer@example.com'
    };
    store.users.push(patron);

    expect(appointmentInput(store, patronInput(), null, patron, now).patronUserId)
      .toBe(patron.id);
  });

  it('rejects a guest booking when registration is required', () => {
    const store = createStore();
    store.settings.registrationRequired = true;

    expect(caughtRuleError(() => appointmentInput(
      store,
      { ...patronInput(), anonymous: true },
      null,
      null,
      now
    ))?.status).toBe(401);
  });
});

describe('booking contact details', () => {
  it('accepts a valid contact name and email', () => {
    const store = createStore();

    expect(appointmentInput(store, patronInput(), null, null, now))
      .toMatchObject({
        patronName: 'Test Customer',
        patronEmail: 'customer@example.com'
      });
  });

  it('rejects a missing contact name', () => {
    const store = createStore();

    expect(caughtRuleError(() => appointmentInput(
      store,
      patronInput({ patronName: '' }),
      null,
      null,
      now
    ))?.status).toBe(400);
  });

  it('rejects an invalid contact email', () => {
    const store = createStore();

    expect(caughtRuleError(() => appointmentInput(
      store,
      patronInput({ patronEmail: 'invalid-email' }),
      null,
      null,
      now
    ))?.status).toBe(400);
  });
});
