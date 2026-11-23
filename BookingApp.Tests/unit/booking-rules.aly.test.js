// Import Statements for Testing Environment in Node.js

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  appointmentInput,
  cancelAppointment,
  getAvailability,
  parseBookingDate,
  timeToMinutes,
  updateProviderAvailability
} from '../booking-rules.js';

const provider = {
  id: 'provider-1',
  name: 'Aly Palmer',
  start: '09:00',
  end: '11:00',
  slotDuration: 30,
  workingDays: [1],
  serviceIds: ['service-1']
};

const service = {
  id: 'service-1',
  name: 'Signature cut',
  price: 38
};

function createStore(appointments = []) {
  return {
    providers: [{ ...provider }],
    services: [{ ...service }],
    appointments,
    users: [],
    settings: { registrationRequired: false }
  };
}

function createAppointment(overrides = {}) {
  return {
    id: 'appointment-1',
    providerId: provider.id,
    date: '2026-01-05',
    time: '09:30',
    durationMinutes: 30,
    patronUserId: 'patron-1',
    ...overrides
  };
}

function assertBookingError(action, status) {
  assert.throws(action, (error) => error.status === status);
}

describe('Unit: timeToMinutes - appointment time validation', () => {
it('timeToMinutes_ValidTime_ReturnsMinutesAfterMidnight', () => {
  const actual = timeToMinutes('09:30');

  assert.equal(actual, 570);
});

it('timeToMinutes_MidnightAndLastMinute_ReturnsBoundaryMinutes', () => {
  const actual = [timeToMinutes('00:00'), timeToMinutes('23:59')];

  assert.deepEqual(actual, [0, 1439]);
});

it('timeToMinutes_InvalidTime_ReturnsNegativeOne', () => {
  const actual = ['24:00', '12:60', '9:30', 'noon'].map(timeToMinutes);

  assert.deepEqual(actual, [-1, -1, -1, -1]);
});
});

describe('Unit: parseBookingDate - booking date validation', () => {
it('parseBookingDate_LeapYearDate_ReturnsParsedDate', () => {
  const actual = parseBookingDate('2024-02-29');

  assert.equal(actual?.toISOString().slice(0, 10), '2024-02-29');
});

it('parseBookingDate_NonLeapYearFebruary29_ReturnsNull', () => {
  const actual = parseBookingDate('2025-02-29');

  assert.equal(actual, null);
});

it('parseBookingDate_WrongFormat_ReturnsNull', () => {
  const actual = parseBookingDate('2026/01/05');

  assert.equal(actual, null);
});
});

describe('Unit: getAvailability - slots and conflict detection', () => {
it('getAvailability_WorkingDayWithoutAppointments_ReturnsSlotsWithinHours', () => {
  const store = createStore();
  const now = new Date(2026, 0, 4, 12, 0);

  const actual = getAvailability(store, store.providers[0], '2026-01-05', now);

  assert.deepEqual(actual, ['09:00', '09:30', '10:00', '10:30']);
});

it('getAvailability_OverlappingAppointment_ExcludesConflictingSlotsOnly', () => {
  const store = createStore([createAppointment()]);
  const now = new Date(2026, 0, 4, 12, 0);

  const actual = getAvailability(store, store.providers[0], '2026-01-05', now);

  assert.deepEqual(actual, ['09:00', '10:00', '10:30']);
});

it('getAvailability_IgnoredAppointmentId_DoesNotBlockItsOwnSlot', () => {
  const appointment = createAppointment();
  const store = createStore([appointment]);
  const now = new Date(2026, 0, 4, 12, 0);

  const actual = getAvailability(store, store.providers[0], '2026-01-05', now, appointment.id);

  assert.deepEqual(actual, ['09:00', '09:30', '10:00', '10:30']);
});

it('getAvailability_TodayAtCurrentSlot_ExcludesPastAndCurrentTimes', () => {
  const store = createStore();
  const now = new Date(2026, 0, 5, 9, 30);

  const actual = getAvailability(store, store.providers[0], '2026-01-05', now);

  assert.deepEqual(actual, ['10:00', '10:30']);
});

it('getAvailability_NonWorkingDay_ReturnsNoSlots', () => {
  const store = createStore();
  const now = new Date(2026, 0, 4, 12, 0);

  const actual = getAvailability(store, store.providers[0], '2026-01-06', now);

  assert.deepEqual(actual, []);
});
});

describe('Unit: appointmentInput - booking creation and editing rules', () => {
it('appointmentInput_ValidGuestBooking_ReturnsNormalizedAppointment', () => {
  const store = createStore();
  const input = {
    providerId: provider.id,
    serviceId: service.id,
    date: '2026-01-05',
    time: '09:00',
    visitorName: '  Sam Guest  ',
    anonymous: true
  };
  const now = new Date(2026, 0, 4, 12, 0);

  const actual = appointmentInput(store, input, null, null, now);

  assert.deepEqual(actual, {
    providerId: 'provider-1',
    providerName: 'Aly Palmer',
    serviceId: 'service-1',
    serviceName: 'Signature cut',
    price: 38,
    date: '2026-01-05',
    time: '09:00',
    durationMinutes: 30,
    visitorName: 'Sam Guest',
    anonymous: true,
    patronName: '',
    patronEmail: '',
    patronUserId: null,
    updatedAt: now.toISOString()
  });
});

it('appointmentInput_TodayWithFutureSlot_AcceptsBookingAtDateBoundary', () => {
  const store = createStore();
  const input = {
    providerId: provider.id,
    serviceId: service.id,
    date: '2026-01-05',
    time: '09:00',
    visitorName: 'Sam Guest',
    anonymous: true
  };
  const now = new Date(2026, 0, 5, 8, 30);

  const actual = appointmentInput(store, input, null, null, now);

  assert.equal(actual.date, '2026-01-05');
});

it('appointmentInput_EditingAtExistingTime_DoesNotConflictWithItself', () => {
  const existing = createAppointment({ anonymous: true, patronUserId: null });
  const store = createStore([existing]);
  const input = {
    providerId: provider.id,
    serviceId: service.id,
    date: '2026-01-05',
    time: existing.time,
    visitorName: 'Updated visitor',
    anonymous: true
  };
  const now = new Date(2026, 0, 4, 12, 0);

  const actual = appointmentInput(store, input, existing, null, now);

  assert.equal(actual.time, existing.time);
});

it('appointmentInput_EditingIntoAnotherBooking_RejectsConflictingChange', () => {
  const existing = createAppointment({ anonymous: true, patronUserId: null });
  const other = createAppointment({ id: 'appointment-2', time: '10:00' });
  const store = createStore([existing, other]);
  const input = {
    providerId: provider.id,
    serviceId: service.id,
    date: '2026-01-05',
    time: '10:00',
    visitorName: 'Updated visitor',
    anonymous: true
  };
  const now = new Date(2026, 0, 4, 12, 0);

  assertBookingError(() => appointmentInput(store, input, existing, null, now), 409);
});

it('appointmentInput_OverlappingAppointment_RejectsBookingWithConflict', () => {
  const store = createStore([createAppointment()]);
  const input = {
    providerId: provider.id,
    serviceId: service.id,
    date: '2026-01-05',
    time: '09:30',
    visitorName: 'Sam Guest',
    anonymous: true
  };
  const now = new Date(2026, 0, 4, 12, 0);

  assertBookingError(() => appointmentInput(store, input, null, null, now), 409);
});

it('appointmentInput_PastDate_RejectsBookingAsInvalid', () => {
  const store = createStore();
  const input = {
    providerId: provider.id,
    serviceId: service.id,
    date: '2026-01-05',
    time: '09:00',
    visitorName: 'Sam Guest',
    anonymous: true
  };
  const now = new Date(2026, 0, 6, 12, 0);

  assertBookingError(() => appointmentInput(store, input, null, null, now), 400);
});
});

describe('Unit: updateProviderAvailability - provider schedule rules', () => {
it('updateProviderAvailability_AdminWithValidSchedule_UpdatesProviderHours', () => {
  const store = createStore();
  const input = {
    start: '09:00',
    end: '12:00',
    slotDuration: 30,
    workingDays: [1, 2, 3]
  };

  const actual = updateProviderAvailability(store, provider.id, input, { role: 'admin' });

  assert.deepEqual(
    { start: actual.start, end: actual.end, slotDuration: actual.slotDuration, workingDays: actual.workingDays },
    input
  );
});

it('updateProviderAvailability_DurationExactlyFitsHours_AcceptsBoundarySchedule', () => {
  const store = createStore();
  const input = {
    start: '09:00',
    end: '10:00',
    slotDuration: 60,
    workingDays: [1]
  };

  const actual = updateProviderAvailability(store, provider.id, input, { role: 'admin' });

  assert.equal(actual.slotDuration, 60);
});

it('updateProviderAvailability_DurationLongerThanHours_RejectsSchedule', () => {
  const store = createStore();
  const input = {
    start: '09:00',
    end: '09:30',
    slotDuration: 60,
    workingDays: [1]
  };

  assertBookingError(
    () => updateProviderAvailability(store, provider.id, input, { role: 'admin' }),
    400
  );
});
});

describe('Unit: cancelAppointment - cancellation ownership rules', () => {
it('cancelAppointment_OwnerCancelsAppointment_RemovesAndReturnsAppointment', () => {
  const appointment = createAppointment();
  const store = createStore([appointment]);

  const actual = cancelAppointment(store, appointment.id, { id: 'patron-1', role: 'patron' });

  assert.equal(actual, appointment);
  assert.deepEqual(store.appointments, []);
});

it('cancelAppointment_NonOwnerCancelsAppointment_RejectsWithoutRemovingIt', () => {
  const appointment = createAppointment();
  const store = createStore([appointment]);

  assertBookingError(
    () => cancelAppointment(store, appointment.id, { id: 'patron-2', role: 'patron' }),
    403
  );

  assert.deepEqual(store.appointments, [appointment]);
});

it('cancelAppointment_UnknownAppointment_ReturnsNotFoundError', () => {
  const store = createStore();

  assertBookingError(
    () => cancelAppointment(store, 'missing-appointment', { id: 'patron-1', role: 'patron' }),
    404
  );
});
});
