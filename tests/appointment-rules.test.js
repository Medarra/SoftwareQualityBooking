import { test, expect, vi, afterEach } from 'vitest';
import { appointmentInput, cancelAppointment } from '../booking-rules.js';

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

//Test
test('appointmentCreation_WhenDateIsTomorrow_AcceptsBooking', () => {
    const store = createStore();
    const input = createInput('2026-10-20', '11:00');

    const result = appointmentInput(store, input, null, null, now);

    expect(result.date).toBe('2026-10-20');
});

test('appointmentCreation_WhenTimeIsLaterToday_AcceptsBooking', () => {
    const store = createStore();
    const input = createInput('2026-10-19', '11:00');

    const result = appointmentInput(store, input, null, null, now);

    expect(result.time).toBe('11:00');
});

test('appointmentCreation_WhenDateIsYesterday_RejectsBooking', () => {
    const store = createStore();
    const input = createInput('2026-10-18', '11:00');

    const action = () => appointmentInput(store, input, null, null, now);

    expect(action).toThrow(expect.objectContaining({ status: 400 }));
});

test('appointmentCreation_WhenTimeIsExactlyNow_RejectsBooking', () => {
    const store = createStore();
    const input = createInput('2026-10-19', '10:00');

    const action = () => appointmentInput(store, input, null, null, now);

    expect(action).toThrow(expect.objectContaining({ status: 409 }));
});

test('appointmentEditing_WhenEditingFutureAppointment_AllowsEdit', () => {
    const store = createStore();
    const existing = {
        id: 'appointment1',
        providerId: 'provider1',
        serviceId: 'cut',
        date: '2026-10-20',
        time: '11:00',
        patronUserId: null
    };
    const input = createInput('2026-10-20', '12:00');

    const result = appointmentInput(store, input, existing, null, now);

    expect(result.time).toBe('12:00');
});

test('appointmentEditing_AppointmentAtCurrentTime_RejectsEdit', () => {
    const store = createStore();
    const existing = {
        id: 'appointment1',
        providerId: 'provider1',
        serviceId: 'cut',
        date: '2026-10-19',
        time: '10:00',
        patronUserId: null
    };
    const input = createInput('2026-10-19', '12:00');

    const action = () => appointmentInput(store, input, existing, null, now);

    expect(action).toThrow(expect.objectContaining({ status: 400 }));
});

test('appointmentEditing_PastAppointment_RejectsEdit', () => {
    const store = createStore();
    const existing = {
        id: 'appointment1',
        providerId: 'provider1',
        serviceId: 'cut',
        date: '2026-10-18',
        time: '11:00',
        patronUserId: null
    };
    const input = createInput('2026-10-20', '12:00');

    const action = () => appointmentInput(store, input, existing, null, now);

    expect(action).toThrow(expect.objectContaining({ status: 400 }));
});

afterEach(() => {
    vi.useRealTimers();
});

function createCancellationStore(date, time) {
    const store = createStore();

    store.appointments.push({
        id: 'appointment1',
        providerId: 'provider1',
        serviceId: 'cut',
        date,
        time,
        patronUserId: null
    });

    return store;
}

test('cancelAppointment_WhenMoreThan24HoursRemain_AllowsCancellation', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const store = createCancellationStore('2026-10-21', '10:00');

    cancelAppointment(store, 'appointment1', {
        id: 'stylist1',
        role: 'stylist',
        providerId: 'provider1'
    });
    expect(store.appointments).toHaveLength(0);
});

test('cancelAppointment_WhenExactly24HoursRemain_AllowsCancellation', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const store = createCancellationStore('2026-10-20', '10:00');

    cancelAppointment(store, 'appointment1', {
        id: 'stylist1',
        role: 'stylist',
        providerId: 'provider1'
    });

    expect(store.appointments).toHaveLength(0);
});

test('cancelAppointment_WhenLessThan24HoursRemain_RejectsCancellation', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const store = createCancellationStore('2026-10-19', '22:00');

    const action = () => cancelAppointment(store, 'appointment1', {
        id: 'stylist1',
        role: 'stylist',
        providerId: 'provider1'
    });

    expect(action).toThrow();
    expect(store.appointments).toHaveLength(1);
});

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
