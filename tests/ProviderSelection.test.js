import { appointmentInput, getAvailability, updateProviderAvailability, BookingRuleError } from '../booking-rules.js';

// Fixed date/time and isolated in-memory fixtures; no live booking.json, database, or system clock.
const NOW = new Date(2026, 9, 19, 9, 0);
const DATE = '2026-10-20'; // Tuesday

function makeStore() {
  return {
    settings: { registrationRequired: false },
    users: [],
    services: [
      { id: 'cut', name: 'Signature cut', price: 38 },
      { id: 'fade', name: 'Skin fade', price: 34 },
      { id: 'beard', name: 'Beard tidy', price: 22 },
      { id: 'colour', name: 'Colour refresh', price: 65 }
    ],
    providers: [
      { id: 'jules', name: 'Jules Carter', start: '09:00', end: '17:00', slotDuration: 30, workingDays: [1,2,3,4,5,6], serviceIds: ['cut', 'fade', 'beard'] },
      { id: 'imani', name: 'Imani Brooks', start: '10:00', end: '18:00', slotDuration: 45, workingDays: [1,2,3,4,5,6], serviceIds: ['cut', 'colour'] },
      { id: 'leo', name: 'Leo Nguyen', start: '09:00', end: '16:00', slotDuration: 30, workingDays: [1,2,3,4,5,6], serviceIds: ['cut', 'fade', 'beard'] },
      { id: 'rowan', name: 'Rowan Ellis', start: '11:00', end: '19:00', slotDuration: 60, workingDays: [1,2,3,4,5,6], serviceIds: ['cut', 'colour'] }
    ],
    appointments: []
  };
}

const patron = { id: 'patron-1', role: 'patron', name: 'Alex Morgan', email: 'alex@example.com' };
function input(overrides = {}) {
  return { providerId: 'jules', serviceId: 'cut', date: DATE, time: '10:00', visitorName: 'Sam Morgan', ...overrides };
}

describe('Provider Selection — service compatibility (appointmentInput)', () => {
  test('appointmentInput_ProviderOffersRequestedService_AcceptsSelection', () => {
    // Arrange
    const store = makeStore();

    // Act
    const result = appointmentInput(store, input({ providerId: 'imani', serviceId: 'colour' }), null, patron, NOW);

    // Assert
    expect(result.providerId).toBe('imani');
    expect(result.serviceId).toBe('colour');
  });

  test('appointmentInput_ProviderOffersOnlyOneOfRequestedServices_RejectsUnsupportedService', () => {
    // Arrange
    const store = makeStore();
    const selection = input({ providerId: 'leo', serviceId: 'colour' });

    // Act
    const action = () => appointmentInput(store, selection, null, patron, NOW);

    // Assert
    expect(action).toThrow('Choose a service offered by this provider.');
  });

  test('appointmentInput_UnknownProvider_RejectsSelection', () => {
    // Arrange
    const store = makeStore();
    const selection = input({ providerId: 'missing-provider' });

    // Act
    const action = () => appointmentInput(store, selection, null, patron, NOW);

    // Assert
    expect(action).toThrow(BookingRuleError);
    expect(action).toThrow('Choose a service offered by this provider.');
  });

  test('appointmentInput_UnknownService_RejectsSelection', () => {
    // Arrange
    const store = makeStore();
    const selection = input({ serviceId: 'missing-service' });

    // Act
    const action = () => appointmentInput(store, selection, null, patron, NOW);

    // Assert
    expect(action).toThrow('Choose a service offered by this provider.');
  });
});

describe('Provider Selection — available provider slots (getAvailability)', () => {
  test('getAvailability_ProviderHasNoBookings_ReturnsOpeningSlot', () => {
    // Arrange
    const store = makeStore();
    const provider = store.providers.find((p) => p.id === 'jules');

    // Act
    const slots = getAvailability(store, provider, DATE, NOW);

    // Assert
    expect(slots).toContain('09:00');
  });

  test('getAvailability_BookingExactlyBeforeNextSlot_KeepsNextSlotAvailable', () => {
    // Arrange
    const store = makeStore();
    const provider = store.providers.find((p) => p.id === 'jules');
    store.appointments.push({ id: 'a1', providerId: 'jules', date: DATE, time: '10:00', durationMinutes: 30 });

    // Act
    const slots = getAvailability(store, provider, DATE, NOW);

    // Assert
    expect(slots).not.toContain('10:00');
    expect(slots).toContain('10:30');
  });

  test('getAvailability_ProviderBookedAtTime_DoesNotBlockOtherProvider', () => {
    // Arrange
    const store = makeStore();
    const leo = store.providers.find((p) => p.id === 'leo');
    store.appointments.push({ id: 'a1', providerId: 'jules', date: DATE, time: '10:00', durationMinutes: 30 });

    // Act
    const slots = getAvailability(store, leo, DATE, NOW);

    // Assert
    expect(slots).toContain('10:00');
  });

  // Boundary: Saturday is the last working day before Jules's Sunday closure.
  test('getAvailability_DayBeforeSunday_ReturnsAvailableSlots', () => {
    // Arrange
    const store = makeStore();
    const provider = store.providers.find((p) => p.id === 'jules');
    const saturday = '2026-10-24';

    // Act
    const slots = getAvailability(store, provider, saturday, NOW);

    // Assert
    expect(slots).toContain('09:00');
  });

  test('getAvailability_ProviderNotWorkingOnRequestedDay_ReturnsNoSlots', () => {
    // Arrange
    const store = makeStore();
    const provider = store.providers.find((p) => p.id === 'jules');
    const sunday = '2026-10-25';

    // Act
    const slots = getAvailability(store, provider, sunday, NOW);

    // Assert
    expect(slots).toEqual([]);
  });
  // Boundary: Monday is the first working day after Jules's Sunday closure.
  test('getAvailability_DayAfterSunday_ReturnsAvailableSlots', () => {
    // Arrange
    const store = makeStore();
    const provider = store.providers.find((p) => p.id === 'jules');
    const monday = '2026-10-26';

    // Act
    const slots = getAvailability(store, provider, monday, NOW);

    // Assert
    expect(slots).toContain('09:00');
  });

  // Boundary: 16:30–17:00 fits Jules's 17:00 closing time exactly.
  test('getAvailability_SlotEndingExactlyAtClosing_IncludesSlot', () => {
    // Arrange
    const store = makeStore();
    const provider = store.providers.find((p) => p.id === 'jules');

    // Act
    const slots = getAvailability(store, provider, DATE, NOW);

    // Assert
    expect(slots).toContain('16:30');
  });

  // Boundary: a 30-minute slot starting at 17:00 would finish after closing.
  test('getAvailability_SlotStartingAtClosing_ExcludesSlot', () => {
    // Arrange
    const store = makeStore();
    const provider = store.providers.find((p) => p.id === 'jules');

    // Act
    const slots = getAvailability(store, provider, DATE, NOW);

    // Assert
    expect(slots).not.toContain('17:00');
  });
});

describe('Provider Selection — provider schedule management (updateProviderAvailability)', () => {
  test('updateProviderAvailability_OwnStylistProfile_UpdatesWorkingHours', () => {
    // Arrange
    const store = makeStore();
    const stylist = { id: 'stylist-1', role: 'stylist', providerId: 'jules' };
    const changes = { start: '10:00', end: '18:00', slotDuration: 30, workingDays: [1,2,3,4,5] };

    // Act
    const updated = updateProviderAvailability(store, 'jules', changes, stylist);

    // Assert
    expect(updated.start).toBe('10:00');
    expect(updated.end).toBe('18:00');
  });

  test('updateProviderAvailability_AppointmentExactlyFitsWorkingHours_AcceptsBoundary', () => {
    // Arrange
    const store = makeStore();
    const admin = { role: 'admin' };
    const changes = { start: '09:00', end: '09:30', slotDuration: 30, workingDays: [2] };

    // Act
    const updated = updateProviderAvailability(store, 'jules', changes, admin);

    // Assert
    expect(updated.slotDuration).toBe(30);
    expect(updated.end).toBe('09:30');
  });

  // Boundary: 31 minutes is just above the minimum span for a 30-minute slot.
  test('updateProviderAvailability_ThirtyOneMinuteWindow_AcceptsChange', () => {
    // Arrange
    const store = makeStore();
    const admin = { role: 'admin' };
    const changes = { start: '09:00', end: '09:31', slotDuration: 30, workingDays: [2] };

    // Act
    const updated = updateProviderAvailability(store, 'jules', changes, admin);

    // Assert
    expect(updated.end).toBe('09:31');
  });

  test('updateProviderAvailability_SlotExceedsWorkingHours_RejectsChange', () => {
    // Arrange
    const store = makeStore();
    const admin = { role: 'admin' };
    const changes = { start: '09:00', end: '09:29', slotDuration: 30, workingDays: [2] };

    // Act
    const action = () => updateProviderAvailability(store, 'jules', changes, admin);

    // Assert
    expect(action).toThrow('Enter valid working hours and an appointment length that fits within them.');
  });

  test('updateProviderAvailability_StylistEditsDifferentProvider_RejectsChange', () => {
    // Arrange
    const store = makeStore();
    const stylist = { id: 'stylist-1', role: 'stylist', providerId: 'jules' };
    const changes = { start: '10:00', end: '18:00', slotDuration: 45, workingDays: [1,2,3,4,5] };

    // Act
    const action = () => updateProviderAvailability(store, 'imani', changes, stylist);

    // Assert
    expect(action).toThrow('You can only change availability for your own stylist profile.');
  });
});

// Boundary-value tests: Jules works Saturday and Monday, but not Sunday.
// NOW is injected; no test reads the system clock.
describe('Provider Selection — working-day boundaries (getAvailability)', () => {
  test('getAvailability_SaturdayBeforeNonWorkingSunday_ReturnsAvailableSlots', () => {
    // Arrange
    const store = makeStore();
    const provider = store.providers.find((p) => p.id === 'jules');
    const saturday = '2026-10-24';

    // Act
    const slots = getAvailability(store, provider, saturday, NOW);

    // Assert
    expect(slots).toContain('09:00');
  });

  test('getAvailability_SundayBetweenWorkingDays_ReturnsNoSlots', () => {
    // Arrange
    const store = makeStore();
    const provider = store.providers.find((p) => p.id === 'jules');
    const sunday = '2026-10-25';

    // Act
    const slots = getAvailability(store, provider, sunday, NOW);

    // Assert
    expect(slots).toEqual([]);
  });

  test('getAvailability_MondayAfterNonWorkingSunday_ReturnsAvailableSlots', () => {
    // Arrange
    const store = makeStore();
    const provider = store.providers.find((p) => p.id === 'jules');
    const monday = '2026-10-26';

    // Act
    const slots = getAvailability(store, provider, monday, NOW);

    // Assert
    expect(slots).toContain('09:00');
  });
});

// Closing-time boundary: a 30-minute slot must end by 17:00.
describe('Provider Selection — closing-time boundaries (getAvailability)', () => {
  test('getAvailability_SlotEndsExactlyAtClosing_IncludesLastSlot', () => {
    // Arrange
    const store = makeStore();
    const provider = store.providers.find((p) => p.id === 'jules');

    // Act
    const slots = getAvailability(store, provider, DATE, NOW);

    // Assert
    expect(slots).toContain('16:30');
  });

  test('getAvailability_SlotStartsAtClosing_ExcludesSlot', () => {
    // Arrange
    const store = makeStore();
    const provider = store.providers.find((p) => p.id === 'jules');

    // Act
    const slots = getAvailability(store, provider, DATE, NOW);

    // Assert
    expect(slots).not.toContain('17:00');
  });
});

// A schedule of exactly 30 minutes is allowed; 29 minutes is too short.
describe('Provider Selection — minimum schedule-length boundaries (updateProviderAvailability)', () => {
  test('updateProviderAvailability_ThirtyOneMinuteWindow_AcceptsSchedule', () => {
    // Arrange
    const store = makeStore();
    const admin = { role: 'admin' };
    const changes = { start: '09:00', end: '09:31', slotDuration: 30, workingDays: [2] };

    // Act
    const result = updateProviderAvailability(store, 'jules', changes, admin);

    // Assert
    expect(result.end).toBe('09:31');
  });
});
