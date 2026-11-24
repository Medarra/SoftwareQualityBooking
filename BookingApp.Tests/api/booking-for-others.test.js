import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startTestServer } from "./test-server.js";
import { getFutureBookingDate, registerTestPatron } from "./helpers.js";

let testServer;
let BASE_URL;

beforeEach(async () => {
    testServer = await startTestServer();
    BASE_URL = testServer.url;
}, 20000);

afterEach(async () => {
    await testServer?.stop();
}, 10000);

// const { user, cookie } = await registerTestPatron(BASE_URL);
//const date = getFutureBookingDate();

describe( "POST api/appointment - booking for others", () => {
    // Verify that registered patron can book for another person
    // while retaining their account contact details
    it ("allows booking for another person", async () =>{
        const { user, cookie } = await registerTestPatron(BASE_URL);
        const date = getFutureBookingDate();
        const response = await fetch(`${BASE_URL}/api/appointments`, { method: "POST",
                                                                      headers: { "Content-Type": "application/json",
                                                                                    "Cookie": cookie },
                                                                      body: JSON.stringify({ providerId: "jules",
                                                                                            serviceId: "cut",
                                                                                            date,
                                                                                            time: "10:00",
                                                                                            visitorName: "Another Person",
                                                                                            anonymous: false,
                                                                                            patronName: "Registered Person",
                                                                                            patronEmail: "registered@mail.com" })  
        });
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.appointment.visitorName).toBe("Another Person");
        expect(data.appointment.patronUserId).toBe(user.id);
        expect(data.appointment.patronName).toBe(user.name);
        expect(data.appointment.patronEmail).toBe(user.email);
        expect(data.appointment.anonymous).toBe(false);
    });

    // Verify that visitor's name is required
    it ("rejects booking without visitor's name", async () => {
        const date = getFutureBookingDate();
        const response = await fetch(`${BASE_URL}/api/appointments`, { method: "POST",
                                                                      headers: { "Content-Type": "application/json" },
                                                                      body: JSON.stringify({ providerId: "jules",
                                                                                            serviceId: "cut",
                                                                                            date,
                                                                                            time: "10:00",
                                                                                            visitorName: "",
                                                                                            anonymous: false,
                                                                                            patronName: "Guest Customer",
                                                                                            patronEmail: "guest@mail.com" })  
        });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Enter the name of the person attending.");
    });
});