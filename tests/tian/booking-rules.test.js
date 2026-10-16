import test from 'node:test';
import assert from 'node:assert/strict';
import { getAvailability } from '../../booking-rules.js';

test('getAvailability_WorkingDayWithoutBookings_ReturnsOpenSlots', () => {
  // Arrange
  const store = { appointments: [] };
  const provider = { id: 'provider-1', start: '09:00', end: '10:00', slotDuration: 30, workingDays: [1] };
  const now = new Date(2026, 9, 16, 8, 0);

  // Act
  const actual = getAvailability(store, provider, '2026-10-19', now);

  // Assert
  assert.deepStrictEqual(actual, ['09:00', '09:30']);
});
