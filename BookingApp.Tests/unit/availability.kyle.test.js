import { describe, it, expect } from 'vitest';
import { getAvailability } from '../../booking-rules.js';

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
            appointments: [{
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