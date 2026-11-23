import { describe, it, expect } from 'vitest';
import { updateProviderAvailability } from '../../booking-rules.js';

// updateProviderAvailability Unit Tests
describe('updateProviderAvailability', () => {

    function createProviderTestData() {
        const store = {
            providers: [{
                id: 'provider1',
                start: '09:00',
                end: '17:00',
                slotDuration: 30,
                workingDays: [1, 2, 3, 4, 5]
            }]
        };

        const input = {
            start: '10:00',
            end: '16:00',
            slotDuration: 60,
            workingDays: [1, 3, 5]
        };

        const user = {
            id: 'stylist1',
            role: 'stylist',
            providerId: 'provider1'
        };

        return { store, input, user };
    }

    it('updateProviderAvailability_ValidStylistUpdate_ReturnsUpdatedSchedule', () => {
        // Arrange
        const { store, input, user } = createProviderTestData();

        // Act
        const result = updateProviderAvailability(store, 'provider1', input, user);

        // Assert
        expect(result).toMatchObject({
            start: '10:00',
            end: '16:00',
            slotDuration: 60,
            workingDays: [1, 3, 5]
        });
    });

    it('updateProviderAvailability_BoundaryExactAppointmentDuration_AcceptsSchedule', () => {
        // Arrange
        const { store, input, user } = createProviderTestData();
        input.start = '09:00';
        input.end = '09:15';
        input.slotDuration = 15;

        // Act
        const result = updateProviderAvailability(store, 'provider1', input, user);

        // Assert
        expect(result).toMatchObject({
            start: '09:00',
            end: '09:15',
            slotDuration: 15
        });
    });

    it('updateProviderAvailability_InsufficientWorkingHours_ThrowsError', () => {
        // Arrange
        const { store, input, user } = createProviderTestData();
        input.start = '09:00';
        input.end = '09:14';
        input.slotDuration = 15;

        // Act
        const action = () => updateProviderAvailability(store, 'provider1', input, user);

        // Assert
        expect(action).toThrow(/valid working hours/i);
    });

    it('updateProviderAvailability_UnauthorizedStylist_ThrowsAccessError', () => {
        // Arrange
        const { store, input, user } = createProviderTestData();
        user.providerId = 'provider2';

        // Act
        const action = () => updateProviderAvailability(store, 'provider1', input, user);

        // Assert
        expect(action).toThrow(/own stylist profile/i);
    });
});