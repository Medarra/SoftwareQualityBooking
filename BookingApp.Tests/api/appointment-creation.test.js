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


    // Valid registered appointment creation
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


        // Verify the appointment was saved
        const appointmentsResponse = await fetch(
            `${testServer.url}/api/appointments`,
            {
                headers: { 'Cookie': cookie }
            }
        );

        const appointmentsData = await appointmentsResponse.json();

        // Expect success, 1 appt, returned appt id matches our posted id
        expect(appointmentsResponse.status).toBe(200);
        expect(appointmentsData.appointments).toHaveLength(1);
        expect(appointmentsData.appointments[0].id).toBe(data.appointment.id);
    });

    // Invalid registered appointment creation
    it('refuses to create an appointment missing visitor name', async () => {
        // Arrange
        const { cookie } = await registerTestPatron(testServer.url);
        const date = getFutureBookingDate();

        const booking = {
            providerId: 'jules',
            serviceId: 'cut',
            date: date,
            time: '09:00',
            visitorName: '',
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
        expect(response.status).toBe(400);
        expect(data.error).toBe('Enter the name of the person attending.');
    });

    // Invalid conflict test
    it('rejects an appointment when the selected slot is already booked', async () => {
        // Arrange
        const { cookie } = await registerTestPatron(testServer.url);
        const date = getFutureBookingDate();

        const booking = {
            providerId: 'jules',
            serviceId: 'cut',
            date: date,
            time: '09:00',
            visitorName: 'Test Customer',
            anonymous: false
        };

        // Create first appt
        const firstResponse = await fetch(`${testServer.url}/api/appointments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookie
            },  
            body: JSON.stringify(booking)
        });

        expect(firstResponse.status).toBe(201);

        // Act - Book second appt
        const secondResponse = await fetch(`${testServer.url}/api/appointments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookie
            },
            body: JSON.stringify(booking)
        });

        const data = await secondResponse.json();

        // Assert
        expect(secondResponse.status).toBe(409);
        expect(data.error).toBe(
            'That appointment time is no longer available. Choose another slot.'
        );

        // Verify that the rejected booking was not saved
        const appointmentsResponse = await fetch(
            `${testServer.url}/api/appointments`,
            {
                headers: { 'Cookie': cookie }
            }
        );

        const appointmentsData = await appointmentsResponse.json();

        expect(appointmentsResponse.status).toBe(200);
        expect(appointmentsData.appointments).toHaveLength(1);
    });


    // Create appointment for a service not offered by provider - Error test
    it('rejects an appointment for a service the provider does not offer', async () => {
        // Arrange
        const { cookie } = await registerTestPatron(testServer.url);
        const date = getFutureBookingDate();

        const booking = {
            providerId: 'jules',
            serviceId: 'colour',
            date: date,
            time: '09:00',
            visitorName: 'Test Customer',
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
        expect(response.status).toBe(400);
        expect(data.error).toBe('Choose a service offered by this provider.');
    });


    // Verify provider-specific appointment duration
    it('creates an appointment using the provider block duration', async () => {
        // Arrange
        const { user, cookie } = await registerTestPatron(testServer.url);
        const date = getFutureBookingDate();

        const booking = {
            providerId: 'imani',
            serviceId: 'cut',
            date: date,
            time: '10:00',
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
        expect(data.appointment.durationMinutes).toBe(45);

        // Verify the booked slot is unavailable
        const availabilityResponse = await fetch(
            `${testServer.url}/api/availability?providerId=imani&date=${date}`
        );

        const availabilityData = await availabilityResponse.json();

        expect(availabilityResponse.status).toBe(200);
        expect(availabilityData.slots).not.toContain('10:00');
        expect(availabilityData.slots).toContain('10:45');
    });


    // Reject an appointment that does not align with provider block duration
    it('rejects a booking outside the provider appointment blocks', async () => {
        // Arrange
        const { user, cookie } = await registerTestPatron(testServer.url);
        const date = getFutureBookingDate();

        const booking = {
            providerId: 'imani',
            serviceId: 'cut',
            date: date,
            time: '10:30',
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
        expect(response.status).toBe(409);
        expect(data.error).toBe(
            'That appointment time is no longer available. Choose another slot.'
        );
    });

});