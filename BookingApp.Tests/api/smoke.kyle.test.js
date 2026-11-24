import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { startTestServer } from './test-server.js';

describe('Booking API Smoke Tests', () => {
    let testServer;

    // Start a fresh server before every test.
    beforeEach(async () => {
        testServer = await startTestServer();
    }, 20000);

    // Stop the server and delete temporary data after every test.
    afterEach(async () => {
        await testServer?.stop();
    }, 10000);

    it('getBootstrap_ValidRequest_ReturnsServicesAndProviders', async () => {
        // Arrange
        const url = `${testServer.url}/api/bootstrap`;

        // Act
        const response = await fetch(url);
        const data = await response.json();

        // Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(data.services)).toBe(true);
        expect(Array.isArray(data.providers)).toBe(true);
        expect(data.services.length).toBeGreaterThan(0);
        expect(data.providers.length).toBeGreaterThan(0);
    });
});
