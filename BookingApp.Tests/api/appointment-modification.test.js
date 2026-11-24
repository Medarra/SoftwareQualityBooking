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

});