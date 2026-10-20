import { describe, test, expect } from '@jest/globals';
import { appointmentInput, getAvailability, cancelAppointment, BookingRuleError } from '../booking-rules.js';

// Fixed Tuesday and fixed clock: no real time, network, or database dependencies.
const NOW = new Date(2026, 9, 19, 9, 0);
const DATE = '2026-10-20';


function makeStore() {
  return {
    settings: { registrationRequired: false },
    users: [],
    services: [
      { id: 'cut', name: 'Signature cut', price: 38 },
      { id: 'colour', name: 'Colour refresh', price: 65 }
    ],
    providers: [
      { id: 'jules', name: 'Jules Carter', start: '09:00', end: '17:00', slotDuration: 30, workingDays: [1, 2, 3, 4, 5, 6], serviceIds: ['cut','fade','beard'] },
      { id: 'imani', name: 'Imani Brooks', start: '10:00', end: '18:00', slotDuration: 45, workingDays: [1, 2, 3, 4, 5, 6], serviceIds: ['cut','color'] },
      { id: 'leo', name: 'Leo Nguyen',start: '09:00', end: '16:00', slotDuration: 30, workingDays: [1, 2, 3, 4, 5, 6], serviceIds: ['cut','fade','beard'] }
    ],
    appointments: []
  };
}

function makePatron() {
  return { id: 'patron-1', name: 'Alex Morgan', email: 'alex@example.com', role: 'patron' };
}

function makeInput(changes = {}) {
  return { providerId: 'jules', serviceId: 'cut', date: DATE, time: '10:00', visitorName: 'Sam Morgan', ...changes };
}

function save(store, input, user = makePatron(), id = `appointment-${store.appointments.length + 1}`) {
  const validated = appointmentInput(store, input, null, user, NOW);
  const appointment = { id, ...validated };
  store.appointments.push(appointment);
  return appointment;
}

describe('Booking for Others — attendee details', () => {
  test('appointmentInput_DifferentVisitor_StoresAttendeeName', () => {
    // Arrange
    const store = makeStore();
    const input = makeInput({ visitorName: 'Sam Morgan' });

    // Act
    const result = appointmentInput(store, input, null, makePatron(), NOW);

    // Assert
    expect(result.visitorName).toBe('Sam Morgan');
  });

  test('appointmentInput_SamePersonAsPatron_AllowsSelfBooking', () => {
    // Arrange
    const store = makeStore();
    const input = makeInput({ visitorName: 'Alex Morgan' });

    // Act
    const result = appointmentInput(store, input, null, makePatron(), NOW);

    // Assert
    expect(result.visitorName).toBe('Alex Morgan');
  });

  test('appointmentInput_BlankVisitorName_RejectsBooking', () => {
    // Arrange
    const store = makeStore();
    const input = makeInput({ visitorName: '' });

    // Act
    const action = () => appointmentInput(store, input, null, makePatron(), NOW);

    // Assert
    expect(action).toThrow('Enter the name of the person attending.');
  });

  test('appointmentInput_WhitespaceVisitorName_RejectsBooking', () => {
    // Arrange
    const store = makeStore();
    const input = makeInput({ visitorName: '   ' });

    // Act
    const action = () => appointmentInput(store, input, null, makePatron(), NOW);

    // Assert
    expect(action).toThrow(BookingRuleError);
  });
});

describe('Booking for Others — ownership and contact', () => {
  test('appointmentInput_OnBehalfOfVisitor_RetainsPatronAccountId', () => {
    // Arrange
    const store = makeStore();
    const patron = makePatron();

    // Act
    const result = appointmentInput(store, makeInput(), null, patron, NOW);

    // Assert
    expect(result.patronUserId).toBe(patron.id);
  });

  test('appointmentInput_OnBehalfOfVisitor_RetainsPatronContact', () => {
    // Arrange
    const store = makeStore();
    const patron = makePatron();

    // Act
    const result = appointmentInput(store, makeInput(), null, patron, NOW);

    // Assert
    expect({ name: result.patronName, email: result.patronEmail }).toEqual({ name: patron.name, email: patron.email });
  });

  test('appointmentInput_SignedInPatronRequestsAnonymousBooking_UsesAccountIdentity', () => {
    // Arrange
    const store = makeStore();
    const input = makeInput({ anonymous: true });

    // Act
    const result = appointmentInput(store, input, null, makePatron(), NOW);

    // Assert
    expect(result.anonymous).toBe(false);
  });

  test('appointmentInput_GuestWithoutValidContact_RejectsBooking', () => {
    // Arrange
    const store = makeStore();
    const input = makeInput({ patronName: 'Taylor', patronEmail: 'invalid-email' });

    // Act
    const action = () => appointmentInput(store, input, null, null, NOW);

    // Assert
    expect(action).toThrow('Enter the booking contact name and a valid email address.');
  });
});

describe('Booking for Others — simultaneous bookings', () => {
  test('appointmentInput_TwoVisitorsDifferentProvidersSameTime_AllowsSecondBooking', () => {
    // Arrange
    const store = makeStore();
    save(store, makeInput({ visitorName: 'Sam Morgan' }));
    const second = makeInput({ providerId: 'leo', visitorName: 'Jamie Morgan' });

    // Act
    const result = save(store, second);

    // Assert
    expect(result.providerId).toBe('leo');
    expect(store.appointments).toHaveLength(2);
  });

  test('appointmentInput_TwoVisitorsSameProviderSameTime_RejectsSecondBooking', () => {
    // Arrange
    const store = makeStore();
    save(store, makeInput({ visitorName: 'Sam Morgan' }));
    const second = makeInput({ visitorName: 'Jamie Morgan' });

    // Act
    const action = () => appointmentInput(store, second, null, makePatron(), NOW);

    // Assert
    expect(action).toThrow(BookingRuleError);
  });

  test('appointmentInput_TwoVisitorsSameProviderBackToBack_AllowsSecondBooking', () => {
    // Arrange
    const store = makeStore();
    save(store, makeInput({ time: '10:00' }));
    const second = makeInput({ time: '10:30', visitorName: 'Jamie Morgan' });

    // Act
    const result = appointmentInput(store, second, null, makePatron(), NOW);

    // Assert
    expect(result.time).toBe('10:30');
  });

  test('appointmentInput_SamePatronDifferentDates_AllowsAnotherBooking', () => {
    // Arrange
    const store = makeStore();
    save(store, makeInput({ date: '2026-10-20' }));
    const second = makeInput({ date: '2026-10-21', visitorName: 'Jamie Morgan' });

    // Act
    const result = appointmentInput(store, second, null, makePatron(), NOW);

    // Assert
    expect(result.date).toBe('2026-10-21');
  });
});

describe('Booking for Others — provider availability', () => {
  test('getAvailability_OtherProviderBookedAtSameTime_KeepsFreeProviderSlot', () => {
    // Arrange
    const store = makeStore();
    save(store, makeInput({ providerId: 'jules' }));
    const leo = store.providers.find(provider => provider.id === 'leo');

    // Act
    const slots = getAvailability(store, leo, DATE, NOW);

    // Assert
    expect(slots).toContain('10:00');
  });

  test('getAvailability_ProviderAlreadyBooked_RemovesOccupiedSlot', () => {
    // Arrange
    const store = makeStore();
    save(store, makeInput({ providerId: 'jules' }));
    const jules = store.providers.find(provider => provider.id === 'jules');

    // Act
    const slots = getAvailability(store, jules, DATE, NOW);

    // Assert
    expect(slots).not.toContain('10:00');
  });

  test('appointmentInput_ServiceNotOfferedByProvider_RejectsBooking', () => {
    // Arrange
    const store = makeStore();
    const input = makeInput({ providerId: 'jules', serviceId: 'colour' });

    // Act
    const action = () => appointmentInput(store, input, null, makePatron(), NOW);

    // Assert
    expect(action).toThrow('Choose a service offered by this provider.');
  });
});

describe('Booking for Others — cancellation', () => {
  test('cancelAppointment_PatronCancelsBookingForVisitor_RemovesAppointment', () => {
    // Arrange
    const store = makeStore();
    const appointment = save(store, makeInput());

    // Act
    const cancelled = cancelAppointment(store, appointment.id, makePatron());

    // Assert
    expect(cancelled.id).toBe(appointment.id);
    expect(store.appointments).toHaveLength(0);
  });

  test('cancelAppointment_DifferentPatronAttemptsCancellation_RejectsAccess', () => {
    // Arrange
    const store = makeStore();
    const appointment = save(store, makeInput());
    const otherPatron = { ...makePatron(), id: 'patron-2' };

    // Act
    const action = () => cancelAppointment(store, appointment.id, otherPatron);

    // Assert
    expect(action).toThrow('You do not have access to this appointment.');
  });

  test('getAvailability_AfterCancellation_ReleasesSlotForAnotherVisitor', () => {
    // Arrange
    const store = makeStore();
    const appointment = save(store, makeInput());
    const jules = store.providers.find(provider => provider.id === 'jules');

    // Act
    cancelAppointment(store, appointment.id, makePatron());
    const slots = getAvailability(store, jules, DATE, NOW);

    // Assert
    expect(slots).toContain('10:00');
  });
});

