import { describe, it, expect } from 'vitest';
import { appointmentInput, cancelAppointment } from '../../booking-rules.js';
import { fixture, booking, caughtRuleError } from './fixtures.tian.js';

describe('appointmentInput', () => {
  it('appointmentInput_ValidBooking_ReturnsRequestedAppointmentDetails', () => {
    // Arrange
    const { store, input, patron, now } = fixture();

    // Act
    const actual = appointmentInput(store, input, null, patron, now);

    // Assert
    expect(actual).toMatchObject({
      providerId: 'provider-1', serviceId: 'service-1', date: '2026-10-19', time: '09:00', visitorName: 'Tian'
    });
  });

  // Interpretation: a slot must start strictly later than the supplied current time.
  it('appointmentInput_StartEqualsCurrentTime_ThrowsConflict', () => {
    // Arrange
    const { store, input, patron } = fixture();
    const now = new Date(2026, 9, 19, 9, 0);

    // Act
    const error = caughtRuleError(() => appointmentInput(store, input, null, patron, now));

    // Assert
    expect(error?.status).toBe(409);
  });

  it('appointmentInput_StartOneMinuteAfterNow_AcceptsBooking', () => {
    // Arrange
    const { store, input, patron } = fixture();
    const now = new Date(2026, 9, 19, 8, 59);

    // Act
    const actual = appointmentInput(store, input, null, patron, now);

    // Assert
    expect(actual.time).toBe('09:00');
  });

  it('appointmentInput_PastDate_ThrowsBadRequest', () => {
    // Arrange
    const { store, input, patron } = fixture();
    const now = new Date(2026, 9, 20, 8, 0);

    // Act
    const error = caughtRuleError(() => appointmentInput(store, input, null, patron, now));

    // Assert
    expect(error?.status).toBe(400);
  });
});

// "now" is passed explicitly (three days before the appointment) so these tests never read the system clock,
// including if cancelAppointment gains a time-dependent rule such as a minimum-notice period.
describe('cancelAppointment', () => {
  it('cancelAppointment_OwnBooking_RemovesOnlySelectedAppointment', () => {
    // Arrange
    const { store, patron, now } = fixture();
    const remaining = booking({ id: 'appointment-2', time: '09:30' });
    store.appointments.push(booking(), remaining);

    // Act
    cancelAppointment(store, 'appointment-1', patron, now);

    // Assert
    expect(store.appointments).toEqual([remaining]);
  });

  it('cancelAppointment_LastBooking_LeavesEmptyAppointmentList', () => {
    // Arrange
    const { store, patron, now } = fixture();
    store.appointments.push(booking());

    // Act
    cancelAppointment(store, 'appointment-1', patron, now);

    // Assert
    expect(store.appointments).toEqual([]);
  });

  it('cancelAppointment_OtherPatronsBooking_ThrowsForbidden', () => {
    // Arrange
    const { store, patron, now } = fixture();
    store.appointments.push(booking({ patronUserId: 'patron-2' }));

    // Act
    const error = caughtRuleError(() => cancelAppointment(store, 'appointment-1', patron, now));

    // Assert
    expect(error?.status).toBe(403);
  });

  it('cancelAppointment_OtherPatronsBooking_KeepsAppointment', () => {
    // Arrange
    const { store, patron, now } = fixture();
    const existing = booking({ patronUserId: 'patron-2' });
    store.appointments.push(existing);

    // Act
    caughtRuleError(() => cancelAppointment(store, existing.id, patron, now));

    // Assert
    expect(store.appointments).toEqual([existing]);
  });

  it('cancelAppointment_EmptyAppointmentList_ThrowsNotFound', () => {
    // Arrange
    const { store, patron, now } = fixture();

    // Act
    const error = caughtRuleError(() => cancelAppointment(store, 'missing', patron, now));

    // Assert
    expect(error?.status).toBe(404);
  });
});
