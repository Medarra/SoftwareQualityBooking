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

// Validates an appointment using the real booking rules,
// then saves the result into the fake store.
// It simulates an existing booking without using
// a real database or starting the application server.
function save(store, input, user = makePatron(), id = `appointment-${store.appointments.length + 1}`) {
  const validated = appointmentInput(store, input, null, user, NOW);
  const appointment = { id, ...validated };
  store.appointments.push(appointment);
  return appointment;
}

 
describe('Booking for Others — attendee details', () => {
  // A patron should be able to book an appointment for
  // someone whose name is different from their own.
  test('appointmentInput_DifferentVisitor_StoresAttendeeName', () => {
    // Arrange
    const store = makeStore();
    const input = makeInput({ visitorName: 'Sam Morgan' });

    // Act
    const result = appointmentInput(store, input, null, makePatron(), NOW);

    // Assert
    expect(result.visitorName).toBe('Sam Morgan');
  });

  // Booking for others should not prevent patrons from
  // booking appointments for themselves.
  test('appointmentInput_SamePersonAsPatron_AllowsSelfBooking', () => {
    // Arrange
    const store = makeStore();
    const input = makeInput({ visitorName: 'Alex Morgan' });

    // Act
    const result = appointmentInput(store, input, null, makePatron(), NOW);

    // Assert
    expect(result.visitorName).toBe('Alex Morgan');
  });

  // A name containing only spaces should also be rejected.
  // This checks that whitespace is not treated as a valid name.
  test('appointmentInput_BlankVisitorName_RejectsBooking', () => {
    // Arrange
    const store = makeStore();
    const input = makeInput({ visitorName: '' });

    // Act
    const action = () => appointmentInput(store, input, null, makePatron(), NOW);

    // Assert
    expect(action).toThrow('Enter the name of the person attending.');
  });

  // A name containing only spaces should also be rejected.
  // This checks that whitespace is not treated as a valid name.
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
  // When booking for another person, the appointment should
  // still belong to the registered patron who created it.
  test('appointmentInput_OnBehalfOfVisitor_RetainsPatronAccountId', () => {
    // Arrange
    const store = makeStore();
    const patron = makePatron();

    // Act
    const result = appointmentInput(store, makeInput(), null, patron, NOW);

    // Assert
    expect(result.patronUserId).toBe(patron.id);
  });

  // The booking should retain the account holder's contact
  // information even when another person receives the service.
  test('appointmentInput_OnBehalfOfVisitor_RetainsPatronContact', () => {
    // Arrange
    const store = makeStore();
    const patron = makePatron();

    // Act
    const result = appointmentInput(store, makeInput(), null, patron, NOW);

    // Assert
    expect({ name: result.patronName, email: result.patronEmail }).toEqual({ name: patron.name, email: patron.email });
  });

  // A signed-in patron should remain associated with their
  // account even if anonymous booking is requested.
  test('appointmentInput_SignedInPatronRequestsAnonymousBooking_UsesAccountIdentity', () => {
    // Arrange
    const store = makeStore();
    const input = makeInput({ anonymous: true });

    // Act
    const result = appointmentInput(store, input, null, makePatron(), NOW);

    // Assert
    expect(result.anonymous).toBe(false);
  });

});

describe('Booking for Others — simultaneous bookings', () => {

  // The same patron should be able to book two visitors
  // at the same time if they use different available providers.
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

  // Two visitors cannot occupy the same provider's
  // appointment slot at the same time.
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

  // Back-to-back bookings should be permitted when the
  // first appointment ends exactly as the second begins.
  // This checks the boundary between two appointment slots.
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

  // An existing booking on one date should not prevent
  // the same patron from booking another visitor on a later date.
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

  // A booking with Jules should not block Leo's slot
  // because provider schedules are independent.
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

  // Once Jules has an appointment at 10:00,
  // that slot should no longer be available for another visitor.
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

  // The patron who created a booking should be able to
  // cancel it even when the appointment is for another person.
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

  // A different patron must not be allowed to cancel
  // someone else's appointment.
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

  
});

