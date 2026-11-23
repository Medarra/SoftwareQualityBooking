import { describe, it, expect } from 'vitest';
import { slotIsFree } from '../../booking-rules.js';
import { fixture, booking } from './fixtures.tian.js';

describe('slotIsFree', () => {
  it('slotIsFree_OtherProviderBooked_ReturnsTrue', () => {
    // Arrange
    const { store, provider } = fixture();
    store.appointments.push(booking({ providerId: 'provider-2' }));

    // Act
    const actual = slotIsFree(store, provider, '2026-10-19', '09:00');

    // Assert
    expect(actual).toBe(true);
  });

  // Interpretation: appointments occupy [start, end), allowing back-to-back bookings.
  it('slotIsFree_StartsAtExistingEnd_ReturnsTrue', () => {
    // Arrange
    const { store, provider } = fixture();
    store.appointments.push(booking());

    // Act
    const actual = slotIsFree(store, provider, '2026-10-19', '09:30');

    // Assert
    expect(actual).toBe(true);
  });

  it('slotIsFree_OverlapsByOneMinute_ReturnsFalse', () => {
    // Arrange
    const { store, provider } = fixture();
    store.appointments.push(booking());

    // Act
    const actual = slotIsFree(store, provider, '2026-10-19', '09:29');

    // Assert
    expect(actual).toBe(false);
  });

  it('slotIsFree_EndsAtExistingStart_ReturnsTrue', () => {
    // Arrange
    const { store, provider } = fixture();
    store.appointments.push(booking({ time: '09:30' }));

    // Act
    const actual = slotIsFree(store, provider, '2026-10-19', '09:00');

    // Assert
    expect(actual).toBe(true);
  });
});
