# Goodday Studio Booking

A small full-stack appointment booking app for a multi-provider studio. It uses a Node.js HTTP server, a responsive browser interface, and a JSON file for local persistence; there are no package dependencies.

## Run locally

Requires Node.js 18 or newer.

```sh
npm start
```

Open <http://localhost:3000>. Appointment and studio settings are created in `data/booking.json` on first run and persist between restarts. That local data folder is ignored by Git.

Customers can create an account from **Sign in** to save a favourite stylist and service and review their appointment history. Stylist accounts are linked to one provider profile and can only see and manage that provider's appointments. To enable stylist registration, configure a studio invitation code before starting the server:

```powershell
$env:STYLIST_INVITE_CODE = "choose-a-private-value"
npm start
```

The current local demo server uses `goodday-demo-team` as its invitation code. Replace it with a private value before sharing the app.

## Included

- Book for yourself or another person, with a provider and service of choice.
- Guest bookings or customer-account bookings; vendors can require a customer account.
- Customer accounts save favourite stylist/service preferences and show service history.
- Stylist accounts see booking details only for their linked provider profile.
- Availability based on each provider's working hours and configurable appointment block length.
- Appointment creation, editing, and cancellation. A provider's occupied time is blocked, and cancellation frees it.
- Multiple appointments for different people/providers, including appointments at the same time when each provider is available.
- Appointment list filters by date and provider.

The JSON API is served by the same application: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `DELETE /api/auth/session`, `GET|PATCH /api/account`, `GET /api/bootstrap`, `GET /api/availability`, `GET /api/appointments`, `POST /api/appointments`, `PATCH /api/appointments/:id`, `DELETE /api/appointments/:id`, `PATCH /api/providers/:id`, and `PATCH /api/settings`. Appointment-list and mutation routes require a signed-in account and enforce customer ownership or stylist-provider scope.

## Prototype scope

Passwords are stored as salted scrypt hashes, sessions use HTTP-only cookies, and appointment reads and changes are checked against the signed-in account. This MVP does not include email verification, password recovery, rate limiting, production-grade account administration, or secure controls for every studio setting, so it is intended for local evaluation and not direct public deployment.