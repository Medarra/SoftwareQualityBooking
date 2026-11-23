import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:3001";

describe("GET /api/availability", () => {
    // Verify that an existing provider has available booking slots
    // on a valid future working day
    it("returns available slots for existing provider", async () => {
        const date = getFutureWorkDay();

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
        const date = getFutureWorkDay();

        const response = await fetch(`${BASE_URL}/api/availability?providerId=unknown&date=${date}`);

        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe("Service provider not found.");
    });
});

// Helping function to get future working day (Monday to Saturday) for availability testing
// Uses JavaScript Date methods described in MDN Web Docs:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Representing_dates_times
function getFutureWorkDay() {
    const date = new Date();
    date.setDate(date.getDate() +7);

    // Move Sunday to Monday because provider doesn't work Sundays
    if(date.getDate() === 0) {
        date.setDate(date.getDate() + 1);
    }

    return [date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")].join("-");
}