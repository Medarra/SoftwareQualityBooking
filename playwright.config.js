import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './BookingApp.Tests/ui',

    fullyParallel: false,
    workers: 1,

    reporter: 'html',

    use: {
        browserName: 'chromium',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure'
    }
});