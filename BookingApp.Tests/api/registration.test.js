import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startTestServer } from "./test-server.js";
import { randomUUID } from "node:crypto";

let testServer;
let BASE_URL;

beforeEach(async () => {
    testServer = await startTestServer();
    BASE_URL = testServer.url;
}, 20000);

afterEach(async () => {
    await testServer?.stop();
}, 10000);

describe("POST /api/auth/register", () => {
    // Verify that a customer can register with valid information
    it ("registers a new customer successfully", async () => {
        const email = `test${randomUUID()}@mail.com`;

        const response = await fetch(`${BASE_URL}/api/auth/register`, {method: "POST",
                                                                        headers: {"Content-Type": "application/json"},
                                                                        body: JSON.stringify({name: "Test Customer",
                                                                                                email,
                                                                                                password: "TestPassword123",
                                                                                                role: "patron"
                                                                        })                         
        });

        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.user).toBeDefined();
        expect(data.user.email).toBe(email);
        expect(data.user.role).toBe("patron");
    });

    // Verify that registration accepts minimum password length
    it ("accepts password with exactly 10 characters", async () => {
        const email = `test${randomUUID()}@mail.com`;

        const response = await fetch(`${BASE_URL}/api/auth/register`, {method: "POST",
                                                                        headers: {"Content-Type": "application/json"},
                                                                        body: JSON.stringify({name: "Test Customer",
                                                                                                email,
                                                                                                password: "Password10",
                                                                                                role: "patron"
                                                                        })                         
        });

        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.user.email).toBe(email);
    });

    // Verify that registration is rejected when password is shorter that 10 characters
    it ("rejects password shorter than minimum length", async () => {
        const email = `test${randomUUID()}@mail.com`;

        const response = await fetch(`${BASE_URL}/api/auth/register`, {method: "POST",
                                                                        headers: {"Content-Type": "application/json"},
                                                                        body: JSON.stringify({name: "Test Customer",
                                                                                                email,
                                                                                                password: "Password",
                                                                                                role: "patron"
                                                                        })                         
        });
        
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Use a password with at least 10 characters.");
    });
});