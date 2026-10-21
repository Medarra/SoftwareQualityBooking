import { describe, it, expect } from 'vitest';
import { getAvailability, parseBookingDate } from '../booking-rules.js';

// parseBookingDate Unit Tests
describe('parseBookingDate', () => {
    it('parseBookingDate_ValidCalendarDate_ReturnsDateObject', () => {
        // Arrange
        const input = '2026-10-20';

        // Act
        const result = parseBookingDate(input);

        // Assert
        expect(result).toBeInstanceOf(Date);
    });

    it('parseBookingDate_InvalidCalendarDate_ReturnsNull', () => {
        // Arrange
        const input = '2027-02-29';

        // Act
        const result = parseBookingDate(input);

        // Assert
        expect(result).toBeNull();
    });

    it('parseBookingDate_BoundaryCalendarDate_ReturnsCorrectDate', () => {
        // Arrange
        const input = '2028-02-29';

        // Act
        const result = parseBookingDate(input);

        // Assert
        expect(result.getFullYear()).toBe(2028);
        expect(result.getMonth()).toBe(1); // Feb - zero indexed
        expect(result.getDate()).toBe(29);
    });
});

// getAvailability Unit Tests
describe('getAvailability', () => {
    it('getAvailability_ValidNoExistingBookingTime_ReturnsAllSlots', () => {
        // Arrange
        const store = {
            appointments: []
        };

        const provider = {
            id: 'provider1',
            start: '09:00',
            end: '10:00',
            slotDuration: 30,
            workingDays: [3]
        };

        const date = '2026-10-21';
        const now = new Date('2026-10-20T12:00:00'); // Simulate the day as the 20th

        // Act
        const result = getAvailability(store, provider, date, now);

        // Assert
        expect(result).toEqual(['09:00', '09:30']);
    });

    it('getAvailability_BoundarySlotStartsAtCurrentTime_ReturnsEmptySlots', () => {
        // Arrange
        const store = {
            appointments: []
        };

        const provider = {
            id: 'provider1',
            start: '09:00',
            end: '10:00',
            slotDuration: 30,
            workingDays: [3] // zero indexed - Wednesday
        };

        const date = '2026-10-21';
        const now = new Date('2026-10-21T09:30:00');

        // Act
        const result = getAvailability(store, provider, date, now);

        // Assert
        expect(result).toEqual([]);
    });

    it('getAvailability_BoundarySlotStartsAfterCurrentTime_ReturnsFutureSlots', () => {
        // Arrange
        const store = {
            appointments: []
        };

        const provider = {
            id: 'provider1',
            start: '09:00',
            end: '10:00',
            slotDuration: 30,
            workingDays: [3] // zero indexed - Wednesday
        };

        const date = '2026-10-21';
        const now = new Date('2026-10-21T09:29:00');

        // Act
        const result = getAvailability(store, provider, date, now);

        // Assert
        expect(result).toEqual(['09:30']);
    });

    it('getAvailability_BoundarySlotStartsBeforeCurrentTime_ReturnsEmptySlots', () => {
        // Arrange
        const store = {
            appointments: []
        };

        const provider = {
            id: 'provider1',
            start: '09:00',
            end: '10:00',
            slotDuration: 30,
            workingDays: [3] // zero indexed - Wednesday
        };

        const date = '2026-10-21';
        const now = new Date('2026-10-21T09:31:00');

        // Act
        const result = getAvailability(store, provider, date, now);

        // Assert
        expect(result).toEqual([]);
    });

    it('getAvailability_InvalidNonWorkingDay_ReturnsEmptySlots', () => {
        // Arrange
        const store = {
            appointments: []
        };

        const provider = {
            id: 'provider1',
            start: '09:00',
            end: '10:00',
            slotDuration: 30,
            workingDays: [0, 1, 2, 4, 5, 6]
        };

        const date = '2026-10-21';
        const now = new Date('2026-10-20T12:00:00'); // Tuesday

        // Act
        const result = getAvailability(store, provider, date, now);

        // Assert
        expect(result).toEqual([]);
    });

        it('getAvailability_ExistingBooking_ReturnsUnoccupiedSlots', () => {
        // Arrange
        const store = {
            appointments: [ {
                id: 'appointment1',
                providerId: 'provider1',
                date: '2026-10-21',
                time: '09:00',
                durationMinutes: 30
            }]
        };

        const provider = {
            id: 'provider1',
            start: '09:00',
            end: '10:00',
            slotDuration: 30,
            workingDays: [3]
        };

        const date = '2026-10-21';
        const now = new Date('2026-10-20T12:00:00');

        // Act
        const result = getAvailability(store, provider, date, now);

        // Assert
        expect(result).toEqual(['09:30']);
    });
});
