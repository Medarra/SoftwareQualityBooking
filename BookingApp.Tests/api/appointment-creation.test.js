import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startTestServer } from './test-server.js';
import { getFutureBookingDate } from './date-helpers.js';

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


    it('creates an appointment with valid booking details', async () => {
        // Arrange
        const date = getFutureBookingDate();

        const booking = {
            providerId: 'jules',
            serviceId: 'cut',
            date: date,
            time: '09:00',
            visitorName: 'Test Customer',
            anonymous: true
        };

        // Act
        const response = await fetch(`${testServer.url}/api/appointments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
            visitorName: 'Test Customer',
            anonymous: true
        });
        expect(data.appointment.id).toBeTruthy();
    });


});