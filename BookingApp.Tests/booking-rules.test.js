import {
  BookingRuleError,
  getAvailability,
  updateProviderAvailability,
  appointmentInput,
  cancelAppointment
} from "../booking-rules.js";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { error } from "node:console";
import { settings } from "node:cluster";

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
        const actual = getAvailability(store, provider, "2026-12-07", now);

        // Assert
        assert.deepEqual(actual, []);
    });
});

// Unit 2 - Provider sets the availability block duration
// Verifies that providers can configure valid working hours and appointment durations, 
// including durations that exactly fit within working hours.
describe("updateProviderAvailability", () => {
    it("StylistSetsValidDuration_UpdatesAvailability", () => {
        // Arrange
        const store = { 
            providers: [{
                id: "leo",
                start: "09:00",
                end: "16:00",
                slotDuration: 30,
                workingDays: [1, 2, 3, 4, 5, 6] 
            }]
        };
        const input = { 
            start: "09:00",
            end: "16:00",
            slotDuration: 45,
            workingDays: [1, 2, 3, 4, 5, 6] 
        };
        const stylist = { role: "stylist", providerId: "leo"};

        // Act
        const actual = updateProviderAvailability(store, "leo", input, stylist);

        // Assert
        assert.equal(actual.slotDuration, 45)
    });

    it("MinimalValidDuration_UpdatesAvailability", () => {
        // Arrange
        const store = { 
            providers: [{
                id: "leo",
                start: "09:00",
                end: "16:00",
                slotDuration: 30,
                workingDays: [1, 2, 3, 4, 5, 6] 
            }]
        };
        const input = { 
            start: "09:00",
            end: "09:15",
            slotDuration: 15,
            workingDays: [1] 
        };
        const stylist = { role: "stylist", providerId: "leo"};

        // Act
        const actual = updateProviderAvailability(store, "leo", input, stylist);

        // Assert
        assert.equal(actual.slotDuration, 15)
    });

    it("StylistSetsInvalidDuration_ThrowValidationError", () => {
        // Arrange
        const store = { 
            providers: [{
                id: "leo",
                start: "09:00",
                end: "16:00",
                slotDuration: 30,
                workingDays: [1, 2, 3, 4, 5, 6] 
            }]
        };
        const input = { 
            start: "09:00",
            end: "16:00",
            slotDuration: 20,
            workingDays: [1, 2, 3, 4, 5, 6] 
        };
        const stylist = { role: "stylist", providerId: "leo"};

        // Act and Assert
        assert.throws(
            () => updateProviderAvailability(store, "leo", input, stylist),
            error => error instanceof BookingRuleError && error.status == 400
        );
        
        // Check that original settings remain unchanged
        assert.equal(store.providers[0].slotDuration, 30)
    });
});

// Unit 3 - Closing time validation
// Verifies that patrons can only book slot durations that fit into providers closing time
describe("ClosingTimeValidation", () => {
    // Arrange for valid, boundary and error case
    const date = "2026-12-07";
    const now = new Date(2026, 11, 7, 8, 0);

    function createStore() {
        return {
            settings: {registrationRequired: false},
            users: [],
            services: [
                {id: "cut", name: "Signature cut", price: 38}
            ],
            providers : [ {
                id: "jules",
                name: "Jules Carter",
                start: "09:00",
                end: "17:00",
                slotDuration: 60,
                workingDays: [1],
                serviceIds: ["cut"]
            }],
            appointments: []
        };
    }

    function createInput(time) {
        return {
            providerId: "jules",
            serviceId: "cut",
            date,
            time,
            visitorName: "Nemo",
            anonymous: true
        }
    }

    it("AppointmentBeforeClosing_IsAccepted", () => {
        // Arrange
        const store = createStore();
        const input = createInput("15:00");

        // Act
        const actual = appointmentInput(store, input, null, null, now);

        //Assert
        assert.ok(actual);
    });

    it("AppointmentEndingAtClosing_IsAccepted", () => {
        // Arrange
        const store = createStore();
        const input = createInput("16:00");

        // Act
        const actual = appointmentInput(store, input, null, null, now);

        //Assert
        assert.ok(actual);
    });

    it("AppointmentEndingAfterClosing_ThrowsValidationError", () => {
        // Arrange
        const store = createStore();
        const input = createInput("16:30");

        // Act and Assert
        assert.throws(
            () => appointmentInput(store, input, null, null, now),
            error => error instanceof BookingRuleError && error.status == 409
        );
    });
});