import { describe, it, expect } from 'vitest';
import { appointmentInput } from '../../booking-rules.js';

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