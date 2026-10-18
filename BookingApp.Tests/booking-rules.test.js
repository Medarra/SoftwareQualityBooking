import {
  BookingRuleError,
    parseBookingDate,
  timeToMinutes,
  getAvailability,
  appointmentInput,
  updateProviderAvailability,
  cancelAppointment
} from "../booking-rules.js";

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Unit 1 - Provider's slot duration validation
// Verifies that provider slot durations fit within working hours and that invalid durations are rejected
describe("getAvailability", () => {
    it("30MinuteDurationWithinOneHour_ReturnsTwoAvailableSlots", () => {
        // Arrange
        const now = new Date(2026, 11, 7, 8, 0);
        const store = { appointments: [] };
        const provider = {
            id: "jules",
            name: "Jules Carter",
            start: "09:00",
            end: "10:00",
            slotDuration: 30,
            workingDays: [1]
        };
        
        // Act
        const actual = getAvailability( store, provider, "2026-12-07", now);

        // Assert
        assert.deepEqual(actual, ["09:00", "09:30"]);
    });

    it("60MinuteDurationWithinOneHour_ReturnsOneSlot", () => {
        // Arrange
        const now = new Date(2026, 11, 7, 8, 0);
        const store = { appointments: [] };
        const provider = {
            id: "jules",
            name: "Jules Carter",
            start: "16:00",
            end: "17:00",
            slotDuration: 60,
            workingDays: [1]
        };
        
        // Act
        const actual = getAvailability( store, provider, "2026-12-07", now);

        // Assert
        assert.deepEqual(actual, ["16:00"]);
    });

    it("DurationExceedsWorkingHours_ReturnsNoSlots", () => {
        // Arrange
        const now = new Date(2026, 11, 7, 8, 0);
        const store = { appointments: [] };
        const provider = {
            id: "jules",
            name: "Jules Carter",
            start: "12:00",
            end: "12:30",
            slotDuration: 45,
            workingDays: [1]
        };
        
        // Act
        const actual = getAvailability( store, provider, "2026-12-07", now);

        // Assert
        assert.deepEqual(actual, []);
    });
});



