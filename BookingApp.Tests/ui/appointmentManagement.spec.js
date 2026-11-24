import { test, expect } from '@playwright/test';
import { startTestServer } from '../api/test-server.js';

let server;
let baseURL;

const password = 'Test-only-password-123';

// Generate a future working day.
function futureWorkingDay() {
    const date = new Date();
    date.setDate(date.getDate() + 7);

    if (date.getDay() === 0) {
        date.setDate(date.getDate() + 1);
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

const DATE = futureWorkingDay();

// Locate an appointment using the visitor's name.
function row(page, visitor) {
    return page.locator('.appointment-row').filter({
        hasText: visitor
    });
}

// Locate an available appointment time.
function slot(page, time) {
    return page.locator(`#availability [data-time="${time}"]`);
}

// Start an isolated server before each test.
test.beforeEach(async () => {
    server = await startTestServer();
    baseURL = server.url;
});

// Stop the server after each test.
test.afterEach(async () => {
    if (server) {
        await server.stop();
        server = undefined;
    }
});

// Open the booking application.
async function openBooking(page) {
    await page.goto(baseURL);

    await expect(
        page.locator('#service-select option[value="cut"]')
    ).toBeAttached();
}

// Register a customer through the UI.
async function register(page) {
    await openBooking(page);

    await page.locator('#auth-trigger').click();
    await page.locator('#register-mode').click();

    await page.locator('#auth-name').fill('Alex Test');
    await page.locator('#auth-role').selectOption('patron');
    await page.locator('#auth-email').fill('alex@example.test');
    await page.locator('#auth-password').fill(password);

    await page.locator('#auth-submit').click();

    await expect(
        page.locator('#signed-in-name')
    ).toHaveText('Alex Test');
}

// Select a service, provider and appointment date.
async function selectBooking(page) {
    await page.locator('#service-select').selectOption('cut');

    await page.locator('[data-provider-id="jules"]').click();

    const availabilityResponse = page.waitForResponse(response =>
        response.url().includes('/api/availability?') &&
        new URL(response.url()).searchParams.get('providerId') === 'jules' &&
        new URL(response.url()).searchParams.get('date') === DATE &&
        response.ok()
    );

    await page.locator('#booking-date').fill(DATE);

    await availabilityResponse;

    await expect(slot(page, '09:00')).toBeVisible();
}

// Complete an appointment booking.
async function book(page, visitor) {
    await selectBooking(page);

    await slot(page, '10:00').click();
    await page.locator('#visitor-name').fill(visitor);
    await page.locator('#submit-booking').click();

    await expect(row(page, visitor)).toBeVisible();
}

// Navigate to the new appointment screen.
async function newBooking(page) {
    await page.locator('#new-appointment-button').click();
}


// UI-01: Create an appointment and verify persistence.
test('UI-01 Create appointment and display saved booking', async ({ page }) => {
    // Arrange
    await register(page);

    // Act
    await book(page, 'Sam Test');

    // Assert
    await expect(row(page, 'Sam Test'))
        .toContainText('Jules Carter');

    await expect(row(page, 'Sam Test'))
        .toContainText('Signature cut');

    await page.reload();

    await page.locator('#appointments-nav').click();

    await expect(row(page, 'Sam Test')).toBeVisible();
});


// UI-02: Change an appointment and release its original slot.
test('UI-02 Change appointment and release original slot', async ({ page }) => {
    // Arrange
    await register(page);
    await book(page, 'Sam Test');

    // Act
    await row(page, 'Sam Test')
        .getByRole('button', { name: 'Change' }).click();

    await expect(slot(page, '10:00'))
        .toHaveClass(/selected/);

    await slot(page, '10:30').click();

    await expect(slot(page, '10:30'))
        .toHaveClass(/selected/);

    // Capture the appointment update response.
    const [response] = await Promise.all([
        page.waitForResponse(response =>
            response.url().includes('/api/appointments/') &&
            response.request().method() === 'PATCH'
        ),
        page.locator('#submit-booking').click()
    ]);

    console.log('Update status:', response.status());
    console.log('Update response:', await response.json());

    // Assert
    expect(response.status()).toBe(200);

    await expect(page.locator('#toast'))
        .toContainText('Appointment updated.');

    await expect(row(page, 'Sam Test'))
        .toBeVisible();

    await expect(row(page, 'Sam Test'))
        .toContainText('10:30 AM');

    // Verify that the original slot is available again.
    await newBooking(page);
    await selectBooking(page);

    await expect(slot(page, '10:00')).toBeVisible();
    await expect(slot(page, '10:30')).toHaveCount(0);
});


// UI-03: Cancel an appointment and release its time slot.
test('UI-03 Cancel appointment and release slot', async ({ page }) => {
    // Arrange
    await register(page);
    await book(page, 'Sam Test');

    // Act
    await row(page, 'Sam Test')
        .getByRole('button', {
            name: 'Cancel',
            exact: true
        }).click();

    // Assert
    await expect(row(page, 'Sam Test')).toHaveCount(0);

    await expect(page.locator('#results-count'))
        .toHaveText('0 appointments');

    await newBooking(page);
    await selectBooking(page);

    await expect(slot(page, '10:00')).toBeVisible();
});


// UI-04: Prevent guest booking when registration is required.
test('UI-04 Registration required prevents guest booking', async ({ page }) => {

    // Arrange
    await openBooking(page);

    // Sign in as the studio administrator.
    await page.locator('#auth-trigger').click();

    await page.locator('#auth-email').fill(
        process.env.ADMIN_EMAIL || 'admin@goodday.studio'
    );

    await page.locator('#auth-password').fill(
        process.env.ADMIN_PASSWORD || 'goodday-admin-2026'
    );

    await page.locator('#auth-submit').click();

    await expect(page.locator('#registration-required'))
        .toBeVisible();

    // Enable mandatory registration.
    await page.locator('#policy-form .switch-track').click();

    await expect(page.locator('#toast'))
        .toContainText('Booking policy updated.');

    // Sign out of the administrator account.
    await page.locator('#sign-out').click();

    await expect(page.locator('#auth-trigger')).toBeVisible();

    await expect(page.locator('#signed-in-name')).toBeHidden();

    await selectBooking(page);
    await slot(page, '10:00').click();

    // Enter valid booking information.
    await page.locator('#visitor-name').fill('Guest Test');
    await page.locator('#patron-name').fill('Guest Test');
    await page.locator('#patron-email').fill('guest@example.test');


    // Act
    const [bookingResponse] = await Promise.all([
        page.waitForResponse(response =>
            new URL(response.url()).pathname === '/api/appointments' &&
            response.request().method() === 'POST'
        ),
        page.locator('#submit-booking').click()
    ]);


    // Assert
    // Verify that the server rejects the guest booking.
    expect([401, 403]).toContain(bookingResponse.status());

    await expect(page.locator('#toast')).toContainText(
        'Create an account or sign in to book at this studio.'
    );

    await expect(page.locator('#anonymous-control'))
        .toBeHidden();

    // Verify that the rejected booking did not occupy the slot.
    await openBooking(page);
    await selectBooking(page);

    await expect(slot(page, '10:00')).toBeVisible();
});

// UI-05: Verify that registration policy changes persist.
test('UI-05 Registration policy changes persist after reload', async ({ page }) => {

    // Arrange
    await openBooking(page);

    // Sign in as the studio administrator.
    await page.locator('#auth-trigger').click();

    await page.locator('#auth-email').fill(
        process.env.ADMIN_EMAIL || 'admin@goodday.studio'
    );

    await page.locator('#auth-password').fill(
        process.env.ADMIN_PASSWORD || 'goodday-admin-2026'
    );

    await page.locator('#auth-submit').click();

    const registrationRequired = page.locator(
        '#registration-required'
    );

    const policySwitch = page.locator(
        '#policy-form .switch-track'
    );

    await expect(registrationRequired).toBeVisible();

    // Verify the initial registration policy.
    await expect(registrationRequired).not.toBeChecked();


    // Act
    // Enable mandatory registration.
    const [enableResponse] = await Promise.all([
        page.waitForResponse(response =>
            new URL(response.url()).pathname === '/api/settings' &&
            response.request().method() === 'PATCH'
        ),
        policySwitch.click()
    ]);


    // Assert
    expect(enableResponse.status()).toBe(200);

    await expect(registrationRequired).toBeChecked();

    await expect(page.locator('#toast'))
        .toContainText('Booking policy updated.');

    // Verify that the enabled policy persists after reload.
    await page.reload();

    await expect(registrationRequired).toBeVisible();
    await expect(registrationRequired).toBeChecked();


    // Act
    // Disable mandatory registration.
    const [disableResponse] = await Promise.all([
        page.waitForResponse(response =>
            new URL(response.url()).pathname === '/api/settings' &&
            response.request().method() === 'PATCH'
        ),
        policySwitch.click()
    ]);

    // Assert
    expect(disableResponse.status()).toBe(200);

    await expect(registrationRequired).not.toBeChecked();

    await expect(page.locator('#toast'))
        .toContainText('Booking policy updated.');

    // Verify that the disabled policy persists after reload.
    await page.reload();

    await expect(registrationRequired).toBeVisible();
    await expect(registrationRequired).not.toBeChecked();

    // Sign out and verify that anonymous booking is available.
    await page.locator('#sign-out').click();

    await expect(page.locator('#auth-trigger')).toBeVisible();

    await expect(page.locator('#anonymous-control'))
        .toBeVisible();
});
