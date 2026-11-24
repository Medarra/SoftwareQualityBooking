import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startTestServer } from "./test-server.js";
import { getFutureBookingDate } from "./helpers.js";

let testServer;
let BASE_URL;

beforeEach(async () => {
    testServer = await startTestServer();
    BASE_URL = testServer.url;
}, 20000);

afterEach(async () => {
    await testServer?.stop();
}, 10000);


describe("GET /api/availability", () => {
    // Verify that an existing provider has available booking slots
    // on a valid future working day
    it("returns available slots for existing provider", async () => {
        const date = getFutureBookingDate();

        const response = await fetch(`${BASE_URL}/api/availability?providerId=jules&date=${date}`);

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toHaveProperty("slots");
        expect(Array.isArray(data.slots)).toBe(true);
        expect(data.slots.length).toBeGreaterThan(0);
    });

    // Verify that a provider has no available slots on a nonworking day
    it("returns empty slots array on Sunday", async () => {
        const date = new Date();
        const daysUntilSunday = (7 - date.getDay()) % 7 || 7;

        date.setDate(date.getDate() + daysUntilSunday);

        const sunday = [date.getFullYear(),
                        String(date.getMonth() + 1).padStart(2, "0"),
                        String(date.getDate()).padStart(2, "0")].join("-");

        const response = await fetch(`${BASE_URL}/api/availability?providerId=jules&date=${sunday}`);

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.slots).toEqual([]);
    });

    // Verify that the API rejects requests for a provider that does not exist
    it("returns 404 for a nonexistent provider", async () => {
        const date = getFutureBookingDate();

        const response = await fetch(`${BASE_URL}/api/availability?providerId=unknown&date=${date}`);

        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe("Service provider not found.");
    });
});
