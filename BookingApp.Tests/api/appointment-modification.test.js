import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startTestServer } from './test-server.js';
import { getFutureBookingDate, registerTestPatron } from './helpers.js';

describe('PATCH /api/appointments/:id', () => {
    let testServer;

    beforeEach(async () => {
        testServer = await startTestServer();
    }, 20000);

    afterEach(async () => {
        await testServer?.stop();
    }, 10000);

    
    // Successfully modify an existing appointment
    it('allows a registered customer to reschedule their appointment', async () => {
        // Arrange
        const { user, cookie } = await registerTestPatron(testServer.url);
        const date = getFutureBookingDate();

        const booking = {
            providerId: 'jules',
            serviceId: 'cut',
            date: date,
            time: '09:00',
            visitorName: user.name,
            anonymous: false
        };

        // Create the original appointment
        const createResponse = await fetch(`${testServer.url}/api/appointments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookie
            },
            body: JSON.stringify(booking)
        });

        expect(createResponse.status).toBe(201);

        const createdData = await createResponse.json();
        const appointmentId = createdData.appointment.id;

        // Act - Reschedule from 09:00 to 10:00
        const updatedBooking = {
            ...booking,
            time: '10:00'
        };

        const response = await fetch(
            `${testServer.url}/api/appointments/${appointmentId}`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': cookie
                },
                body: JSON.stringify(updatedBooking)
            }
        );

        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(data.appointment.id).toBe(appointmentId);
        expect(data.appointment.time).toBe('10:00');
        expect(data.appointment.date).toBe(date);

        // Verify the modified appointment was saved
        const appointmentsResponse = await fetch(
            `${testServer.url}/api/appointments`,
            {
                headers: { 'Cookie': cookie }
            }
        );

        const appointmentsData = await appointmentsResponse.json();

        expect(appointmentsResponse.status).toBe(200);
        expect(appointmentsData.appointments).toHaveLength(1);
        expect(appointmentsData.appointments[0].time).toBe('10:00');
        expect(appointmentsData.appointments[0].id).toBe(appointmentId);
    });


    // Unauthorized appointment modification
    it('rejects a customer modifying another customers appointment', async () => {
        // Arrange
        const patronA = await registerTestPatron(testServer.url);
        const patronB = await registerTestPatron(testServer.url);
        const date = getFutureBookingDate();

        const booking = {
            providerId: 'jules',
            serviceId: 'cut',
            date: date,
            time: '09:00',
            visitorName: patronA.user.name,
            anonymous: false
        };

        // Create appointment belonging to Patron A
        const createResponse = await fetch(`${testServer.url}/api/appointments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': patronA.cookie
            },
            body: JSON.stringify(booking)
        });

        expect(createResponse.status).toBe(201);

        const createdData = await createResponse.json();
        const appointmentId = createdData.appointment.id;

        // Act - Patron B attempts to reschedule Patron A's appointment
        const updatedBooking = {
            ...booking,
            time: '10:00'
        };

        const response = await fetch(
            `${testServer.url}/api/appointments/${appointmentId}`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': patronB.cookie
                },
                body: JSON.stringify(updatedBooking)
            }
        );

        const data = await response.json();

        // Assert
        expect(response.status).toBe(403);
        expect(data.error).toBe('You do not have access to this appointment.');

        // Verify Patron A's appointment was not modified
        const appointmentsResponse = await fetch(
            `${testServer.url}/api/appointments`,
            {
                headers: { 'Cookie': patronA.cookie }
            }
        );

        const appointmentsData = await appointmentsResponse.json();

        expect(appointmentsResponse.status).toBe(200);
        expect(appointmentsData.appointments).toHaveLength(1);
        expect(appointmentsData.appointments[0].id).toBe(appointmentId);
        expect(appointmentsData.appointments[0].time).toBe('09:00');
    });


    // Invalid modification - selected slot already occupied
    it('rejects rescheduling an appointment into an occupied slot', async () => {
        // Arrange
        const { user, cookie } = await registerTestPatron(testServer.url);
        const date = getFutureBookingDate();

        const booking = {
            providerId: 'jules',
            serviceId: 'cut',
            date: date,
            time: '09:00',
            visitorName: user.name,
            anonymous: false
        };

        // Create Appointment A at 09:00
        const firstResponse = await fetch(`${testServer.url}/api/appointments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookie
            },
            body: JSON.stringify(booking)
        });

        expect(firstResponse.status).toBe(201);

        // Create Appointment B at 10:00
        const secondBooking = {
            ...booking,
            time: '10:00'
        };

        const secondResponse = await fetch(`${testServer.url}/api/appointments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookie
            },
            body: JSON.stringify(secondBooking)
        });

        expect(secondResponse.status).toBe(201);

        const secondData = await secondResponse.json();
        const appointmentId = secondData.appointment.id;

        // Act - Attempt to move Appointment B to 09:00
        const updatedBooking = {
            ...secondBooking,
            time: '09:00'
        };

        const response = await fetch(
            `${testServer.url}/api/appointments/${appointmentId}`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': cookie
                },
                body: JSON.stringify(updatedBooking)
            }
        );

        const data = await response.json();

        // Assert
        expect(response.status).toBe(409);
        expect(data.error).toBe(
            'That appointment time is no longer available. Choose another slot.'
        );

        // Verify both appointments retain their original times
        const appointmentsResponse = await fetch(
            `${testServer.url}/api/appointments`,
            {
                headers: { 'Cookie': cookie }
            }
        );

        const appointmentsData = await appointmentsResponse.json();

        expect(appointmentsResponse.status).toBe(200);
        expect(appointmentsData.appointments).toHaveLength(2);

        const savedAppointment = appointmentsData.appointments.find(
            appointment => appointment.id === appointmentId
        );

        expect(savedAppointment).toBeDefined();
        expect(savedAppointment.time).toBe('10:00');
    });

});