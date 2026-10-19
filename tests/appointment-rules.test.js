import {test, expect} from 'vitest';
import {appointmentInput} from '../booking-rules.js';

//Set a fixed date/time so tests are repeatable
const now = new Date(2026, 9, 19, 10, 0);   //Monday, October 19, 2026, 10:00 AM

//Create small sample of data to use in tests
function createStore(){
    return{
        settings: {registrationRequired: false},
        users: [],
        appointments: [],
        services: [{id: 'cut', name: 'Haircut', price: 30}],
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

function createInput(date, time){
    return{
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
test('appointmentInput_WhenDateIsTomorrow_AcceptsBooking', () => {
    const store = createStore();
    const input = createInput('2026-10-20', '11:00');

    const result = appointmentInput(store, input, null, null, now);

    expect(result.date).toBe('2026-10-20');
});

test('appointmentInput_WhenTimeIsLaterToday_AcceptsBooking', () => {
    const store = createStore();
    const input = createInput('2026-10-19', '11:00');

    const result = appointmentInput(store, input, null, null, now);

    expect(result.time).toBe('11:00');
});

test('appointmentInput_WhenDateIsYesterday_RejectsBooking', () => {
    const store = createStore();
    const input = createInput('2026-10-18', '11:00');

    const action = () => appointmentInput(store, input, null, null, now);

    expect(action).toThrow(expect.objectContaining({status: 400}));
});

test('appointmentInput_WhenTimeIsExactlyNow_RejectsBooking', () => {
    const store = createStore();
    const input = createInput('2026-10-19', '10:00');

    const action = () => appointmentInput(store, input, null, null, now);

    expect(action).toThrow(expect.objectContaining({status: 409}));
});