import { describe, it, expect } from "vitest";

import {
    BookingRuleError,
    appointmentInput
} from "../../booking-rules.js";

import { getEligibleProviders } from "../../public/provider-rules.js";

import { createStore, createInput } from "../test.helpers.js";

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