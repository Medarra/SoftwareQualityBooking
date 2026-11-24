import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startTestServer } from "./test-server.js";
import { getFutureBookingDate, loginTestAdmin } from "./helpers.js";

let testServer;
let BASE_URL;

beforeEach(async () => {
    testServer = await startTestServer();
    BASE_URL = testServer.url;
}, 20000);

afterEach(async () => {
    await testServer?.stop();
}, 10000);


describe("POST /api/appointments - booking without registration", () => {
    // Verify that a guest can book without a profile or contact details
    it ("allows booking without registration", async () => {
        const date = getFutureBookingDate();
        const response = await fetch(`${BASE_URL}/api/appointments`, { method: "POST",
                                                                        headers: {"Content-Type": "application/json"},
                                                                        body: JSON.stringify({providerId: "jules",
                                                                                                serviceId: "cut",
                                                                                                date,
                                                                                                time: "10:00",
                                                                                                visitorName: "Guest Customer",
                                                                                                anonymous: true })    
        });

        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.appointment).toBeDefined();
        expect(data.appointment.anonymous).toBe(true);
        expect(data.appointment.visitorName).toBe("Guest Customer");
        expect(data.appointment.patronUserId).toBeNull();
        expect(data.appointment.patronName).toBe("");
        expect(data.appointment.patronEmail).toBe("");
    });

    // Verify that a non-anonymous guest booking requires contact details
    it ("rejects non-anonymous booking without contact details", async () => {
        const date = getFutureBookingDate();
        const response = await fetch(`${BASE_URL}/api/appointments`, { method: "POST",
                                                                        headers: {"Content-Type": "application/json"},
                                                                        body: JSON.stringify({providerId: "jules",
                                                                                                serviceId: "cut",
                                                                                                date,
                                                                                                time: "10:00",
                                                                                                visitorName: "Guest Customer",
                                                                                                anonymous: false })    
        });

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Enter the booking contact name and a valid email address.");
    });

    // Verify that a guest cannot book when registration is required
    it ("rejects anonymous booking when registration is required", async() => {
        // Sign in as administrator
        const { cookie } = await loginTestAdmin(BASE_URL);

        // Enable mandatory registration
        const settingsResponse = await fetch(`${BASE_URL}/api/settings`, { method: "PATCH",
                                                                            headers: {"Content-Type": "application/json",
                                                                                        "Cookie": cookie},
                                                                            body: JSON.stringify({registrationRequired: true})
        });

        const settingsData = await settingsResponse.json();

        expect(settingsResponse.status).toBe(200);
        expect(settingsData.settings.registrationRequired).toBe(true);

        // Attempt to book without authentication
        const date = getFutureBookingDate();
        const response = await fetch(`${BASE_URL}/api/appointments`, { method: "POST",
                                                                        headers: {"Content-Type": "application/json"},
                                                                        body: JSON.stringify({ providerId: "jules",
                                                                                                serviceId: "cut",
                                                                                                date,
                                                                                                time: "10:00",
                                                                                                visitorName: "Guest Customer",
                                                                                                anonymous: true })
        });

        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe("Create an account or sign in to book at this studio.");
    });
});