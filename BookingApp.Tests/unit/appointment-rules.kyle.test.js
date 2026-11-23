import { describe, it, expect } from 'vitest';
import { parseBookingDate, cancelAppointment } from '../../booking-rules.js';

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

// cancelAppointment Unit Tests
describe('cancelAppointment', () => {
    it('cancelAppointment_ValidPatronCancellation_RemovesAppointment', () => {
        // Arrange
        const store = {
            appointments: [
                {
                    id: 'appointment1',
                    patronUserId: 'patron1'
                },
                {
                    id: 'appointment2',
                    patronUserId: 'patron2'
                }
            ]
        };

        const user = {
            id: 'patron1',
            role: 'patron'
        };

        // Act
        cancelAppointment(store, 'appointment1', user);

        // Assert
        expect(store.appointments.map(appointment => appointment.id)).toEqual(['appointment2']);
    });

    it('cancelAppointment_BoundaryOnlyAppointment_RemovesLastAppointment', () => {
        // Arrange
        const store = {
            appointments: [
                {
                    id: 'appointment1',
                    patronUserId: 'patron1'
                }
            ]
        };

        const user = {
            id: 'patron1',
            role: 'patron'
        };

        // Act
        cancelAppointment(store, 'appointment1', user);

        // Assert
        expect(store.appointments).toHaveLength(0);
    });

    it('cancelAppointment_UnauthorizedPatron_ThrowsAccessError', () => {
        // Arrange
        const store = {
            appointments: [
                {
                    id: 'appointment1',
                    patronUserId: 'patron2'
                }
            ]
        };

        const user = {
            id: 'patron1',
            role: 'patron'
        };

        // Act
        const action = () => cancelAppointment(store, 'appointment1', user);

        // Assert
        expect(action).toThrow(/access/i);
    });

    it('cancelAppointment_NonexistentAppointment_ThrowsNotFoundError', () => {
        // Arrange
        const store = {
            appointments: []
        };

        const user = {
            id: 'patron1',
            role: 'patron'
        };

        // Act
        const action = () => cancelAppointment(store, 'appointment1', user);

        // Assert
        expect(action).toThrow(/not found/i);
    });
});