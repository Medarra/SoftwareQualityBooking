// This function a default store object, for particular tests properties might be changed
export function createStore() {
    return {
        settings: {registrationRequired: false},
        users: [],
        services: [
            {id: "cut", name: "Signature cut", price: 38},
            { id: "fade", name: "Skin fade", price: 34 },
            { id: "beard", name: "Beard tity", price: 22 },
            { id: "colour", name: "Hair colour", price: 65 }
        ],
        providers : [ {
            id: "jules",
            name: "Jules Carter",
            start: "09:00",
            end: "17:00",
            slotDuration: 30,
            workingDays: [1, 2, 3, 4, 5, 6],
            serviceIds: ["cut"]
        }],
        appointments: []
    };
}

// This function a default input object, for particular tests properties might be changed
export function createInput() {
    return {
        providerId: "jules",
        serviceId: "cut",
        date: "2026-12-07",
        time: "09:00",
        visitorName: "Nemo",
        anonymous: true
    };
}
