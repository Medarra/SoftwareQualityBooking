# Goodday Studio Booking

A small full-stack appointment booking app for a multi-provider studio. It uses a Node.js HTTP server, a responsive browser interface, and a JSON file for local persistence; there are no package dependencies.

## Run locally

Requires Node.js 18 or newer.

```sh
npm start
```

Open <http://localhost:3000>. Appointment and studio settings are created in `data/booking.json` on first run and persist between restarts. That local data folder is ignored by Git.

## Included

- Book for yourself or another person, with a provider and service of choice.
- Guest bookings or bookings with contact details; vendors can require contact details.
- Availability based on each provider's working hours and configurable appointment block length.
- Appointment creation, editing, and cancellation. A provider's occupied time is blocked, and cancellation frees it.
- Multiple appointments for different people/providers, including appointments at the same time when each provider is available.
- Appointment list filters by date and provider.

The JSON API is served by the same application: `GET /api/bootstrap`, `GET /api/availability`, `GET /api/appointments`, `POST /api/appointments`, `PATCH /api/appointments/:id`, `DELETE /api/appointments/:id`, `PATCH /api/providers/:id`, and `PATCH /api/settings`.

## Prototype scope

Booking contact details are stored with each appointment. This MVP does not include password-based patron accounts, authentication, or role-based access control, so it is intended for local evaluation and not direct public deployment.