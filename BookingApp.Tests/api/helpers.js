import { expect } from "vitest";
import { randomUUID } from "node:crypto";

// Helper function to get a future booking date to test with
export function getFutureBookingDate(daysAhead = 2) {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);

    // Jules does not work on Sundays
    if (date.getDay() === 0) {
        date.setDate(date.getDate() + 1);
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

// Helper function to register test customer and return user and session cookie
export async function registerTestPatron(baseUrl) {
    const response = await fetch(`${baseUrl}/api/auth/register`, { method: "POST",
                                                                    headers: {"Content-Type": "application/json"},
                                                                    body: JSON.stringify({ name: "Test Customer",
                                                                                            email: `test${randomUUID()}@mail.com`,
                                                                                            password: "TestPassword123",
                                                                                            role: "patron" })
    });

    const data = await response.json();

    expect(response.status).toBe(201);

    return { user: data.user,
            cookie: getSessionCookie(response)
    };
}

// Helper function to sign in as administrator and return user and session cookie
export async function loginTestAdmin(baseUrl) {
    const response = await fetch(`${baseUrl}/api/auth/login`, { method: "POST",
                                                                headers: {"Content-Type": "application/json"},
                                                                body: JSON.stringify({ email: process.env.ADMIN_EMAIL || "admin@goodday.studio",
                                                                                        password: process.env.ADMIN_PASSWORD || "goodday-admin-2026" })
    });

    const data = await response.json();

    expect(response.status).toBe(200);

    return { user: data.user,
            cookie: getSessionCookie(response)

    };
}

// Reusable function to extract session cookie from the authentication response
function getSessionCookie(response) {
    const sessionCookie = response.headers.get("set-cookie");
    expect(sessionCookie).toBeTruthy();

    return sessionCookie.split(";")[0];
}

