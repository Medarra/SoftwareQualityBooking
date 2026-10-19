import { describe, it, expect } from 'vitest';
import { parseBookingDate } from '../booking-rules.js';

describe('parseBookingDate', () => {
  it('parseBookingDate_ValidCalendarDate_ReturnsDateObject', () => {
    // Arrange
    const input = '2026-10-20';

    // Act
    const result = parseBookingDate(input);

    // Assert
    expect(result).toBeInstanceOf(Date);
  });
});
