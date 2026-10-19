import { describe, test, expect } from '@jest/globals';
import { appointmentInput, getAvailability, cancelAppointment, BookingRuleError } from '../booking-rules.js';

// Fixed Tuesday and fixed clock: no real time, network, or database dependencies.
const NOW = new Date(2026, 9, 19, 9, 0);
const DATE = '2026-10-20';
const patron = { id: 'p1', role: 'patron', name: 'Alice Smith', email: 'alice@example.com' };
const otherPatron = { id: 'p2', role: 'patron', name: 'Dana Lee', email: 'dana@example.com' };

function makeStore() {
  return {
    settings: { registrationRequired: false },
    users: [patron, otherPatron],
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
