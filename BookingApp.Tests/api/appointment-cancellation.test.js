import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startTestServer } from './test-server.js';
import { getFutureBookingDate, registerTestPatron } from './helpers.js';

describe('DELETE /api/appointments/:id', () => {
    let testServer;

    beforeEach(async () => {
        testServer = await startTestServer();
    }, 20000);

    afterEach(async () => {
        await testServer?.stop();
    }, 10000);

    // Successfully cancel an existing appointment
    it('allows a registered customer to cancel their appointment', async () => {
        // Arrange
        const { user, cookie } = await registerTestPatron(testServer.url);
        const date = getFutureBookingDate(3);

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

        // Act - Cancel the appointment
        const response = await fetch(
            `${testServer.url}/api/appointments/${appointmentId}`,
            {
                method: 'DELETE',
                headers: {
                    'Cookie': cookie
                }
            }
        );

        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(data.appointment.id).toBe(appointmentId);

        // Verify the cancelled appointment was removed
        const appointmentsResponse = await fetch(
            `${testServer.url}/api/appointments`,
            {
                headers: { 'Cookie': cookie }
            }
        );

        const appointmentsData = await appointmentsResponse.json();

        expect(appointmentsResponse.status).toBe(200);
        expect(appointmentsData.appointments).toHaveLength(0);
    });


    // Unauthorized appointment cancellation
    it('rejects a customer cancelling another customer appointment', async () => {
        // Arrange
        const patronA = await registerTestPatron(testServer.url);
        const patronB = await registerTestPatron(testServer.url);
        const date = getFutureBookingDate(3);

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

        // Act - Patron B attempts to cancel Patron A's appointment
        const response = await fetch(
            `${testServer.url}/api/appointments/${appointmentId}`,
            {
                method: 'DELETE',
                headers: {
                    'Cookie': patronB.cookie
                }
            }
        );

        const data = await response.json();

        // Assert
        expect(response.status).toBe(403);
        expect(data.error).toBe('You do not have access to this appointment.');

        // Verify Patron A's appointment was not cancelled
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

});
