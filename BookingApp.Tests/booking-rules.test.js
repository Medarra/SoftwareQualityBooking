import { describe, it, expect } from 'vitest';
import { getAvailability, parseBookingDate, appointmentInput, cancelAppointment, updateProviderAvailability } from '../booking-rules.js';

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

// appointmentInput Unit Tests
describe('appointmentInput', () => {

    function createBookingTestData() {
        const store = {
            settings: { registrationRequired: true },
            providers: [{
                id: 'provider1',
                name: 'Test Provider',
                serviceIds: ['cut'],
                start: '09:00',
                end: '10:00',
                slotDuration: 30,
                workingDays: [3]
            }],
            services: [{
                id: 'cut',
                name: 'Haircut',
                price: 30
            }],
            appointments: []
        };

        const input = {
            providerId: 'provider1',
            serviceId: 'cut',
            date: '2026-10-21',
            time: '09:00',
            visitorName: 'Aly',
            anonymous: false
        };

        const user = {
            id: 'patron1',
            name: 'Kyle',
            email: 'kyle@example.com',
            role: 'patron'
        };

        return { store, input, user };
    }


    it('appointmentInput_ValidBookingForAnotherPerson_ReturnsCorrectBookingDetails', () => {
        // Arrange
        const { store, input, user } = createBookingTestData();
        const now = new Date('2026-10-20T12:00:00');

        // Act
        const result = appointmentInput(store, input, null, user, now);

        // Assert
        expect(result).toMatchObject({
            visitorName: 'Aly',
            patronName: 'Kyle',
            patronEmail: 'kyle@example.com',
            patronUserId: 'patron1'
        });
    });

    it('appointmentInput_BookingTodayBeforeStartTime_ReturnsValidAppointment', () => {
        // Arrange
        const { store, input, user } = createBookingTestData();
        const now = new Date('2026-10-21T08:59:00');

        // Act
        const result = appointmentInput(store, input, null, user, now);

        // Assert
        expect(result).toMatchObject({
            date: '2026-10-21',
            time: '09:00'
        });
    });


    it('appointmentInput_PastBookingDate_ThrowsError', () => {
        // Arrange
        const { store, input, user } = createBookingTestData();
        input.date = '2026-10-20';
        const now = new Date('2026-10-21T08:59:00');

        // Act
        const action = () => appointmentInput(store, input, null, user, now);

        // Assert
        expect(action).toThrow(/past/i);
    });

    it('appointmentInput_RegistrationRequiredWithoutUser_ThrowsSignInError', () => {
        // Arrange
        const { store, input } = createBookingTestData();
        input.anonymous = true;
        const user = null;
        const now = new Date('2026-10-20T12:00:00');

        // Act
        const action = () => appointmentInput(store, input, null, user, now);

        // Assert
        expect(action).toThrow(/sign in/i);
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

// updateProviderAvailability Unit Tests
describe('updateProviderAvailability', () => {

    function createProviderTestData() {
        const store = {
            providers: [{
                id: 'provider1',
                start: '09:00',
                end: '17:00',
                slotDuration: 30,
                workingDays: [1, 2, 3, 4, 5]
            }]
        };

        const input = {
            start: '10:00',
            end: '16:00',
            slotDuration: 60,
            workingDays: [1, 3, 5]
        };

        const user = {
            id: 'stylist1',
            role: 'stylist',
            providerId: 'provider1'
        };

        return { store, input, user };
    }

    it('updateProviderAvailability_ValidStylistUpdate_ReturnsUpdatedSchedule', () => {
        // Arrange
        const { store, input, user } = createProviderTestData();

        // Act
        const result = updateProviderAvailability(store, 'provider1', input, user);

        // Assert
        expect(result).toMatchObject({
            start: '10:00',
            end: '16:00',
            slotDuration: 60,
            workingDays: [1, 3, 5]
        });
    });

    it('updateProviderAvailability_BoundaryExactAppointmentDuration_AcceptsSchedule', () => {
        // Arrange
        const { store, input, user } = createProviderTestData();
        input.start = '09:00';
        input.end = '09:15';
        input.slotDuration = 15;

        // Act
        const result = updateProviderAvailability(store, 'provider1', input, user);

        // Assert
        expect(result).toMatchObject({
            start: '09:00',
            end: '09:15',
            slotDuration: 15
        });
    });

    it('updateProviderAvailability_InsufficientWorkingHours_ThrowsError', () => {
        // Arrange
        const { store, input, user } = createProviderTestData();
        input.start = '09:00';
        input.end = '09:14';
        input.slotDuration = 15;

        // Act
        const action = () => updateProviderAvailability(store, 'provider1', input, user);

        // Assert
        expect(action).toThrow(/valid working hours/i);
    });

    it('updateProviderAvailability_UnauthorizedStylist_ThrowsAccessError', () => {
        // Arrange
        const { store, input, user } = createProviderTestData();
        user.providerId = 'provider2';

        // Act
        const action = () => updateProviderAvailability(store, 'provider1', input, user);

        // Assert
        expect(action).toThrow(/own stylist profile/i);
    });
});