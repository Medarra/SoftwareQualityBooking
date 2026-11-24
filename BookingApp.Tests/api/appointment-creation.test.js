import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startTestServer } from './test-server.js';
import { getFutureBookingDate, registerTestPatron } from './helpers.js';

describe('POST /api/appointments', () => {
    let testServer;

    // Start a new server before every test - Callback
    beforeEach(async () => {
        testServer = await startTestServer();
    }, 20000);

    // Stop the server and delete temp data after every test
    afterEach(async () => {
        await testServer?.stop();
    }, 10000);


    it('creates a valid appointment for a registered customer', async () => {
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

        // Act
        const response = await fetch(`${testServer.url}/api/appointments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookie
            },
            body: JSON.stringify(booking)
        });

        const data = await response.json();

        // Assert
        expect(response.status).toBe(201);
        expect(data.appointment).toMatchObject({
            providerId: 'jules',
            serviceId: 'cut',
            date: date,
            time: '09:00',
            visitorName: user.name,
            anonymous: false,
            patronUserId: user.id,
            patronName: user.name,
            patronEmail: user.email,
            durationMinutes: 30
        });
        expect(data.appointment.id).toBeTruthy();
    });


});