import { describe, it, expect } from 'vitest';
import { updateProviderAvailability } from '../../booking-rules.js';
import { fixture, caughtRuleError } from './fixtures.tian.js';

describe('updateProviderAvailability', () => {
  it('updateProviderAvailability_OwnStylistValidHours_UpdatesSchedule', () => {
    // Arrange
    const { store, provider } = fixture();
    const user = { role: 'stylist', providerId: provider.id };
    const input = { start: '10:00', end: '12:00', slotDuration: 30, workingDays: [1, 2] };

    // Act
    updateProviderAvailability(store, provider.id, input, user);

    // Assert
    expect({
      start: provider.start, end: provider.end, slotDuration: provider.slotDuration, workingDays: provider.workingDays
    }).toEqual(input);
  });

  it('updateProviderAvailability_HoursFitExactlyOneSlot_AcceptsSchedule', () => {
    // Arrange
    const { store, provider } = fixture();
    const input = { start: '09:00', end: '09:30', slotDuration: 30, workingDays: [1] };

    // Act
    const actual = updateProviderAvailability(store, provider.id, input, { role: 'admin' });

    // Assert
    expect(actual.end).toBe('09:30');
  });

  it('updateProviderAvailability_HoursOneMinuteTooShort_ThrowsBadRequest', () => {
    // Arrange
    const { store, provider } = fixture();
    const input = { start: '09:00', end: '09:29', slotDuration: 30, workingDays: [1] };

    // Act
    const error = caughtRuleError(() => updateProviderAvailability(store, provider.id, input, { role: 'admin' }));

    // Assert
    expect(error?.status).toBe(400);
  });

  it('updateProviderAvailability_OtherStylist_ThrowsForbidden', () => {
    // Arrange
    const { store, provider } = fixture();
    const input = { start: '10:00', end: '12:00', slotDuration: 30, workingDays: [1] };
    const user = { role: 'stylist', providerId: 'provider-2' };

    // Act
    const error = caughtRuleError(() => updateProviderAvailability(store, provider.id, input, user));

    // Assert
    expect(error?.status).toBe(403);
  });
});
