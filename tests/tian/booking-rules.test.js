import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BookingRuleError, getAvailability, slotIsFree, appointmentInput,
  updateProviderAvailability, cancelAppointment
} from '../../booking-rules.js';

function fixture() {
  const provider = {
    id: 'provider-1', name: 'Stylist One', serviceIds: ['service-1'],
    start: '09:00', end: '10:00', slotDuration: 30, workingDays: [1]
  };
  const patron = { id: 'patron-1', role: 'patron', name: 'Tian', email: 'tian@example.test' };
  const store = {
    providers: [provider], services: [{ id: 'service-1', name: 'Haircut', price: 30 }],
    users: [patron], settings: { registrationRequired: false }, appointments: []
  };
  const input = {
    providerId: 'provider-1', serviceId: 'service-1', date: '2026-10-19',
    time: '09:00', visitorName: 'Tian', anonymous: false
  };
  return { store, provider, patron, input, now: new Date(2026, 9, 16, 8, 0) };
}

function booking(overrides = {}) {
  return {
    id: 'appointment-1', providerId: 'provider-1', patronUserId: 'patron-1',
    date: '2026-10-19', time: '09:00', durationMinutes: 30, ...overrides
  };
}

function ruleError(status) {
  return error => error instanceof BookingRuleError && error.status === status;
}

test('getAvailability_WorkingDayWithoutBookings_ReturnsOpenSlots', () => {
  // Arrange
  const { store, provider, now } = fixture();

  // Act
  const actual = getAvailability(store, provider, '2026-10-19', now);

  // Assert
  assert.deepStrictEqual(actual, ['09:00', '09:30']);
});

// Interpretation: ending exactly at closing is allowed.
test('getAvailability_AppointmentEndsAtClosing_IncludesLastSlot', () => {
  // Arrange
  const { store, provider, now } = fixture();
  provider.end = '09:30';

  // Act
  const actual = getAvailability(store, provider, '2026-10-19', now);

  // Assert
  assert.deepStrictEqual(actual, ['09:00']);
});

test('getAvailability_AppointmentEndsAfterClosing_ExcludesOverrunningSlot', () => {
  // Arrange
  const { store, provider, now } = fixture();
  provider.end = '09:29';

  // Act
  const actual = getAvailability(store, provider, '2026-10-19', now);

  // Assert
  assert.deepStrictEqual(actual, []);
});

test('getAvailability_NonWorkingDay_ReturnsNoSlots', () => {
  // Arrange
  const { store, provider, now } = fixture();

  // Act
  const actual = getAvailability(store, provider, '2026-10-20', now);

  // Assert
  assert.deepStrictEqual(actual, []);
});

test('slotIsFree_OtherProviderBooked_ReturnsTrue', () => {
  // Arrange
  const { store, provider } = fixture();
  store.appointments.push(booking({ providerId: 'provider-2' }));

  // Act
  const actual = slotIsFree(store, provider, '2026-10-19', '09:00');

  // Assert
  assert.strictEqual(actual, true);
});

// Interpretation: appointments occupy [start, end), allowing back-to-back bookings.
test('slotIsFree_StartsAtExistingEnd_ReturnsTrue', () => {
  // Arrange
  const { store, provider } = fixture();
  store.appointments.push(booking());

  // Act
  const actual = slotIsFree(store, provider, '2026-10-19', '09:30');

  // Assert
  assert.strictEqual(actual, true);
});

test('slotIsFree_OverlapsByOneMinute_ReturnsFalse', () => {
  // Arrange
  const { store, provider } = fixture();
  store.appointments.push(booking());

  // Act
  const actual = slotIsFree(store, provider, '2026-10-19', '09:29');

  // Assert
  assert.strictEqual(actual, false);
});

test('slotIsFree_EndsAtExistingStart_ReturnsTrue', () => {
  // Arrange
  const { store, provider } = fixture();
  store.appointments.push(booking({ time: '09:30' }));

  // Act
  const actual = slotIsFree(store, provider, '2026-10-19', '09:00');

  // Assert
  assert.strictEqual(actual, true);
});

test('appointmentInput_ValidBooking_ReturnsRequestedAppointmentDetails', () => {
  // Arrange
  const { store, input, patron, now } = fixture();

  // Act
  const actual = appointmentInput(store, input, null, patron, now);

  // Assert
  assert.deepStrictEqual(
    { providerId: actual.providerId, serviceId: actual.serviceId, date: actual.date, time: actual.time, visitorName: actual.visitorName },
    { providerId: 'provider-1', serviceId: 'service-1', date: '2026-10-19', time: '09:00', visitorName: 'Tian' }
  );
});

// Interpretation: a slot must start strictly later than the supplied current time.
test('appointmentInput_StartEqualsCurrentTime_ThrowsConflict', () => {
  // Arrange
  const { store, input, patron } = fixture();
  const now = new Date(2026, 9, 19, 9, 0);

  // Act
  const act = () => appointmentInput(store, input, null, patron, now);

  // Assert
  assert.throws(act, ruleError(409));
});

test('appointmentInput_StartOneMinuteAfterNow_AcceptsBooking', () => {
  // Arrange
  const { store, input, patron } = fixture();
  const now = new Date(2026, 9, 19, 8, 59);

  // Act
  const actual = appointmentInput(store, input, null, patron, now);

  // Assert
  assert.strictEqual(actual.time, '09:00');
});

test('appointmentInput_PastDate_ThrowsBadRequest', () => {
  // Arrange
  const { store, input, patron } = fixture();
  const now = new Date(2026, 9, 20, 8, 0);

  // Act
  const act = () => appointmentInput(store, input, null, patron, now);

  // Assert
  assert.throws(act, ruleError(400));
});

test('updateProviderAvailability_OwnStylistValidHours_UpdatesSchedule', () => {
  // Arrange
  const { store, provider } = fixture();
  const user = { role: 'stylist', providerId: provider.id };
  const input = { start: '10:00', end: '12:00', slotDuration: 30, workingDays: [1, 2] };

  // Act
  updateProviderAvailability(store, provider.id, input, user);

  // Assert
  assert.deepStrictEqual(
    { start: provider.start, end: provider.end, slotDuration: provider.slotDuration, workingDays: provider.workingDays }, input
  );
});

test('updateProviderAvailability_HoursFitExactlyOneSlot_AcceptsSchedule', () => {
  // Arrange
  const { store, provider } = fixture();
  const input = { start: '09:00', end: '09:30', slotDuration: 30, workingDays: [1] };

  // Act
  const actual = updateProviderAvailability(store, provider.id, input, { role: 'admin' });

  // Assert
  assert.strictEqual(actual.end, '09:30');
});

test('updateProviderAvailability_HoursOneMinuteTooShort_ThrowsBadRequest', () => {
  // Arrange
  const { store, provider } = fixture();
  const input = { start: '09:00', end: '09:29', slotDuration: 30, workingDays: [1] };

  // Act
  const act = () => updateProviderAvailability(store, provider.id, input, { role: 'admin' });

  // Assert
  assert.throws(act, ruleError(400));
});

test('updateProviderAvailability_OtherStylist_ThrowsForbidden', () => {
  // Arrange
  const { store, provider } = fixture();
  const input = { start: '10:00', end: '12:00', slotDuration: 30, workingDays: [1] };
  const user = { role: 'stylist', providerId: 'provider-2' };

  // Act
  const act = () => updateProviderAvailability(store, provider.id, input, user);

  // Assert
  assert.throws(act, ruleError(403));
});

test('cancelAppointment_OwnBooking_RemovesOnlySelectedAppointment', () => {
  // Arrange
  const { store, patron } = fixture();
  const remaining = booking({ id: 'appointment-2', time: '09:30' });
  store.appointments.push(booking(), remaining);

  // Act
  cancelAppointment(store, 'appointment-1', patron);

  // Assert
  assert.deepStrictEqual(store.appointments, [remaining]);
});

test('cancelAppointment_LastBooking_LeavesEmptyAppointmentList', () => {
  // Arrange
  const { store, patron } = fixture();
  store.appointments.push(booking());

  // Act
  cancelAppointment(store, 'appointment-1', patron);

  // Assert
  assert.deepStrictEqual(store.appointments, []);
});

test('cancelAppointment_OtherPatronsBooking_ThrowsForbiddenWithoutRemovingIt', () => {
  // Arrange
  const { store, patron } = fixture();
  const existing = booking({ patronUserId: 'patron-2' });
  store.appointments.push(existing);

  // Act
  const act = () => cancelAppointment(store, existing.id, patron);

  // Assert
  assert.throws(act, ruleError(403));
  assert.deepStrictEqual(store.appointments, [existing]);
});

test('cancelAppointment_EmptyAppointmentList_ThrowsNotFound', () => {
  // Arrange
  const { store, patron } = fixture();

  // Act
  const act = () => cancelAppointment(store, 'missing', patron);

  // Assert
  assert.throws(act, ruleError(404));
});
