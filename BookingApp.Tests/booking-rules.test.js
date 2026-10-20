import {
  BookingRuleError,
  getAvailability,
  updateProviderAvailability,
  appointmentInput,
  //getEligibleProviders
} from "../booking-rules.js";

import { createStore, createInput } from "./test.helpers.js";

import { describe, it, expect } from "vitest";

// Unit 1 - Provider's block duration validation
// Verifies that provider slot durations fit within working hours and that invalid durations are rejected
describe("BlockDurationValidation", () => {
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
        expect(actual).toEqual(["09:00", "09:30"]);
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
        expect(actual).toEqual(["16:00"]);
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
        expect(actual).toEqual([]);
    });
});

// Unit 2 - Provider sets the availability block duration
// Verifies that providers can configure valid working hours and appointment durations, 
// including durations that exactly fit within working hours.
describe("ProviderSetsBlockDuration", () => {
    it("StylistSetsValidDuration_UpdatesAvailability", () => {
        // Arrange
        const store = createStore();
        
        const input = { 
            start: "09:00",
            end: "16:00",
            slotDuration: 45,
            workingDays: [1, 2, 3, 4, 5, 6] 
        };
        const stylist = { role: "stylist", providerId: "jules"};

        // Act
        const actual = updateProviderAvailability(store, "jules", input, stylist);

        // Assert
        expect(actual.slotDuration).toEqual(45);
    });

    it("MinimalValidDuration_UpdatesAvailability", () => {
        // Arrange
        const store = createStore();
        const input = { 
            start: "09:00",
            end: "09:15",
            slotDuration: 15,
            workingDays: [1] 
        };
        const stylist = { role: "stylist", providerId: "jules"};

        // Act
        const actual = updateProviderAvailability(store, "jules", input, stylist);

        // Assert
        expect(actual.slotDuration).toEqual(15);
    });

    it("StylistSetsInvalidDuration_ThrowValidationError", () => {
        // Arrange
        const store = createStore();
        const input = { 
            start: "09:00",
            end: "16:00",
            slotDuration: 20,
            workingDays: [1, 2, 3, 4, 5, 6] 
        };
        const stylist = { role: "stylist", providerId: "jules"};

        // Act and Assert
        let error;

        try {
            updateProviderAvailability(store, "jules", input, stylist);
        } catch (caught) {
            error = caught;
        }

        // Assert
        expect(error).toBeInstanceOf(BookingRuleError);
        expect(error.status).toBe(400);
        
        // Check that original settings remain unchanged
        expect(store.providers[0].slotDuration).toEqual(30);
    });
});

// Unit 3 - Block duration and closing time validation
// Verifies that patrons can only book slot durations that fit into providers closing time
describe("BlockDuration_ClosingTimeValidation", () => {
    const now = new Date(2026, 11, 7, 8, 0);

    it("AppointmentBeforeClosing_IsAccepted", () => {
        // Arrange
        const store = createStore();
        const input = createInput();
        input.time = "15:00"

        // Act
        const actual = appointmentInput(store, input, null, null, now);

        //Assert
        expect(actual).toBeTruthy();
    });

    it("AppointmentEndingAtClosing_IsAccepted", () => {
        // Arrange
        const store = createStore();
        const input = createInput();
        input.time = "16:30";

        // Act
        const actual = appointmentInput(store, input, null, null, now);

        //Assert
        expect(actual).toBeTruthy();
    });

    it("AppointmentEndingAfterClosing_ThrowsValidationError", () => {
        // Arrange
        const store = createStore();
        store.providers[0].slotDuration = 60;
        const input = createInput();
        input.time = "16:30";

        // Act
        let error;

        try {
            appointmentInput(store, input, null, null, now);
        } catch (caught) {
            error = caught;
        }

        // Assert
        expect(error).toBeInstanceOf(BookingRuleError);
        expect(error.status).toBe(409);
    });
});

// Unit 4 - Provider and service compatibility
// Verifies whether selected provider offers selected service
describe("ProviderServiceCompatibility", () => {
    const now = new Date(2026, 11, 7, 8, 0);

    it("ProviderOffersSelectedService_BookingAccepted", () => {
        // Arrange
        const store = createStore();
        const input = createInput();
        input.serviceId = "beard";

        // Act
        const actual = appointmentInput(store, input, null, null, now);

        // Assert
        expect(actual.providerId).toEqual("jules");
        expect(actual.serviceId).toEqual("beard");
    });

    it("ProviderOffersOnlySelectedService_BookingAccepted", () => {
        // Arrange
        const store = createStore();
        store.providers[0].serviceIds = ["beard"];
        const input = createInput();
        input.serviceId = "beard";

        // Act
        const actual = appointmentInput(store, input, null, null, now);

        // Assert
        expect(actual.serviceId).toEqual("beard");
    });

    it("ProviderDoesNotOfferSelectedService_ThrowsValidationError", () => {
        // Arrange
        const store = createStore();
        const input = createInput();
        input.serviceId = "colour";

        // Act
        let error;

        try {
            appointmentInput(store, input, null, null, now);
        } catch (caught) {
            error = caught;
        }

        // Assert
        expect(error).toBeInstanceOf(BookingRuleError);
        expect(error.status).toBe(400);
    });
});

// Unit 5 - Provider selection by service
// Verifies that only providers offering the selected service are available for selection
// Note: These three tests require an independently testable provider filtering function
// Current filtering logic is inside renderProviders() in app.js which does not allow to test in isolation
// The tests fails since getEligibleProviders() is not implemented in the booking-rules.js
describe("ProviderSelectionByService", () => {

    it("MultipleProvidersOfferService_ReturnsAllEligibleProviders", () => {
        // Arrange
        const store = createStore();
        store.providers.push({
            id: "imani",
            name: "Imani Brooks",
            start: "10:00",
            end: "18:00",
            slotDuration: 45,
            workingDays: [1, 2, 3, 4, 5, 6],
            serviceIds: ["cut", "colour"]
        });

        // Act
        const actual = getEligibleProviders(store.providers, "cut");

        // Assert
        expect(actual.map(provider => provider.id)).toEqual(["jules", "imani"]);
    });

    it("ProviderDoesNotOfferService_ExcludeFromSelection", () => {
        // Arrange
        const store = createStore();
        store.providers.push({
            id: "imani",
            name: "Imani Brooks",
            start: "10:00",
            end: "18:00",
            slotDuration: 45,
            workingDays: [1, 2, 3, 4, 5, 6],
            serviceIds: ["colour"]
        });

        // Act
        const actual = getEligibleProviders(store.providers, "cut");

        // Assert
        expect(actual.map(provider => provider.id)).toEqual(["jules"]);
    });

    it("NoProvidersOfferService_ReturnEmptyList", () => {
        // Arrange
        const store = createStore();
        store.providers[0].serviceIds = ["colour"];

        // Act
        const actual = getEligibleProviders(store.providers, "cut");

        // Assert
        expect(actual.map(provider => provider.id)).toEqual([]);
    });
});