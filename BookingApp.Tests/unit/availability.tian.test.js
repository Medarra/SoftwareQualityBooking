import { describe, it, expect } from 'vitest';
import { getAvailability } from '../../booking-rules.js';
import { fixture } from './fixtures.tian.js';

describe('getAvailability', () => {
  it('getAvailability_WorkingDayWithoutBookings_ReturnsOpenSlots', () => {
    // Arrange
    const { store, provider, now } = fixture();

    // Act
    const actual = getAvailability(store, provider, '2026-10-19', now);

    // Assert
    expect(actual).toEqual(['09:00', '09:30']);
  });

  // Interpretation: ending exactly at closing is allowed.
  it('getAvailability_AppointmentEndsAtClosing_IncludesLastSlot', () => {
    // Arrange
    const { store, provider, now } = fixture();
    provider.end = '09:30';

    // Act
    const actual = getAvailability(store, provider, '2026-10-19', now);

    // Assert
    expect(actual).toEqual(['09:00']);
  });

  it('getAvailability_AppointmentEndsAfterClosing_ExcludesOverrunningSlot', () => {
    // Arrange
    const { store, provider, now } = fixture();
    provider.end = '09:29';

    // Act
    const actual = getAvailability(store, provider, '2026-10-19', now);

    // Assert
    expect(actual).toEqual([]);
  });

  it('getAvailability_NonWorkingDay_ReturnsNoSlots', () => {
    // Arrange
    const { store, provider, now } = fixture();

    // Act
    const actual = getAvailability(store, provider, '2026-10-20', now);

    // Assert
    expect(actual).toEqual([]);
  });
});
