import { test, expect, vi, afterEach } from 'vitest';
import { appointmentInput, cancelAppointment } from '../../booking-rules';

//Set a fixed date/time so tests are repeatable
const now = new Date(2026, 9, 19, 10, 0);   //Monday, October 19, 2026, 10:00 AM

//Create small sample of data to use in tests
function createStore() {
    return {
        settings: { registrationRequired: false },
        users: [],
        appointments: [],
        services: [{ id: 'cut', name: 'Haircut', price: 30 }],
        providers: [{
            id: 'provider1',
            name: 'Test Stylist',
            serviceIds: ['cut'],
            workingDays: [1, 2, 3, 4, 5, 6],
            start: '09:00',
            end: '17:00',
            slotDuration: 30
        }]
    };
}

function createInput(date, time) {
    return {
        providerId: 'provider1',
        serviceId: 'cut',
        date,
        time,
        visitorName: 'Test Customer',
        patronName: 'Test Customer',
        patronEmail: 'test@example.com',
        anonymous: false
    };
}

test('OptionalRegistration_RegistrationOptional_GuestCanBook', () => {
    const store = createStore();
    store.settings.registrationRequired = false;
    const input = createInput('2026-10-20', '11:00');
    
    const result = appointmentInput(store, input, null, null, now);

    expect(result).toBeDefined();
    expect(result.patronUserId).toBeNull();
});

test('RequiredRegistration_RegistrationRequired_RegisteredPatronCanBook', () => {
    const store = createStore();
    store.settings.registrationRequired = true;

    const patron = {
        id: 'patron1',
        role: 'patron',
        name: 'Test Customer',
        email: 'test@example.com'
    };

    store.users.push(patron);
    const input = createInput('2026-10-20', '11:00');

    const result = appointmentInput(store, input, null, patron, now);

    expect(result.patronUserId).toBe('patron1');
});

test('RequiredRegistration_RegistrationRequired_GuestCannotBook', () => {
    const store = createStore();
    store.settings.registrationRequired = true;
    const input = createInput('2026-10-20', '11:00');

    const action = () => appointmentInput(store, input, null, null, now);

    expect(action).toThrow(expect.objectContaining({ status: 401 }));
});

test('PatronContact_ValidPatronContact_AcceptsBooking', () => {
  
  const store = createStore();
  const input = createInput('2026-10-20', '11:00');
  input.patronName = 'Test Customer';
  input.patronEmail = 'customer@example.com';

  
  const result = appointmentInput(store, input, null, null, now);

  
  expect(result.patronName).toBe('Test Customer');
  expect(result.patronEmail).toBe('customer@example.com');
});

test('PatronContact_MissingPatronName_RejectsBooking', () => {
  
  const store = createStore();
  const input = createInput('2026-10-20', '11:00');
  input.patronName = '';

  
  const action = () => appointmentInput(store, input, null, null, now);

  
  expect(action).toThrow(
    expect.objectContaining({ status: 400 })
  );
});

test('PatronContact_InvalidPatronEmail_RejectsBooking', () => {
  
  const store = createStore();
  const input = createInput('2026-10-20', '11:00');
  input.patronEmail = 'invalid-email';

  
  const action = () => appointmentInput(store, input, null, null, now);

  
  expect(action).toThrow(
    expect.objectContaining({ status: 400 })
  );
});