# Goodday Studio Booking

A small full-stack appointment booking app for a multi-provider studio. It uses a Node.js HTTP server, a responsive browser interface, and a JSON file for local persistence; there are no package dependencies.

## Run locally

Requires Node.js 18 or newer.

```sh
npm start
```

Open <http://localhost:3000>. Appointment and studio settings are created in `data/booking.json` on first run and persist between restarts. That local data folder is ignored by Git.

Customers can create an account from **Sign in** to save a favourite stylist and service and review their appointment history. To create a stylist account, choose **Stylist**, select the services offered, and enter the studio invitation code. Registration automatically creates a provider profile using the stylist's name, links it to their account, and sets an initial 9 a.m.–5 p.m. Monday–Saturday schedule. Stylists can adjust their schedule from **My profile** after signing in. Stylist accounts can only see and manage appointments on their linked profile. The local demo invitation code works by default; set a private code before sharing the app:

```powershell
$env:STYLIST_INVITE_CODE = "choose-a-private-value"
npm start
```

For a local demo, the stylist invitation code is `goodday-demo-team`. Set `STYLIST_INVITE_CODE` to override it.

The studio administrator account is created automatically when the server starts:

| User (email) | Password |
| --- | --- |
| `admin@goodday.studio` | `goodday-admin-2026` |

The administrator is the only account that can open **Studio setup** and change studio-wide booking rules or any provider's availability. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before the first server start to use different administrator credentials. Customer and stylist sign-up cannot create administrator accounts.

Stylists can sign in and use **My profile** to update their own working hours, appointment length, and working days. Those changes do not grant access to another provider's profile.

## Included

- Book for yourself or another person, with a provider and service of choice.
- Guest bookings or customer-account bookings; vendors can require a customer account.
- Customer accounts save favourite stylist/service preferences and show service history.
- Stylist accounts see booking details only for their linked provider profile.
- Availability based on each provider's working hours and configurable appointment block length.
- Appointment creation, editing, and cancellation. A provider's occupied time is blocked, and cancellation frees it.
- Multiple appointments for different people/providers, including appointments at the same time when each provider is available.
- Appointment list filters by date and provider.

The JSON API is served by the same application: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `DELETE /api/auth/session`, `GET|PATCH /api/account`, `GET /api/bootstrap`, `GET /api/availability`, `GET /api/appointments`, `POST /api/appointments`, `PATCH /api/appointments/:id`, `DELETE /api/appointments/:id`, `PATCH /api/providers/:id`, and `PATCH /api/settings`. Appointment-list and mutation routes require a signed-in account and enforce customer ownership or stylist-provider scope. Studio settings are administrator-only; provider availability can be changed by the administrator or by that provider's linked stylist.

## Unit tests

Run the Node.js built-in test suite with:

```sh
npm test
```

The tests are kept in `tests/` and exercise these booking-rule units:

- `parseBookingDate` — leap-year dates, invalid calendar dates, and malformed date formats.
- `timeToMinutes` — valid times, the earliest/latest valid times, and malformed or out-of-range times.
- `getAvailability` — slots within working hours, overlapping appointment conflicts, same-day past/current slot exclusion, and ignoring the appointment currently being edited.
- `appointmentInput` — normalized guest bookings, same-day and past-date validation, booking conflicts, and editing an appointment without conflicting with itself.
- `updateProviderAvailability` — valid schedule updates, a duration that exactly fits working hours, and a duration that does not fit.
- `cancelAppointment` — cancellation by the patron who owns the appointment, denied cancellation by another patron, and a missing appointment.

Fixtures and dates are supplied by each test, so the suite does not start the server, access persisted booking data, or depend on the system clock.

## Prototype scope

Passwords are stored as salted scrypt hashes, sessions use HTTP-only cookies, and appointment reads and changes are checked against the signed-in account. The documented administrator credentials are demo credentials; replace them before sharing the app. This MVP does not include email verification, password recovery, rate limiting, or production-grade account administration, so it is intended for local evaluation and not direct public deployment.

## Booking rules and assignment reflection

Availability, date/time validation, appointment normalization, provider schedule validation, and appointment cancellation/ownership rules are implemented as functions in `booking-rules.js`, independently from the HTTP server and persisted JSON file. The server supplies the current time to availability and appointment validation, so the time-dependent rules can be exercised with a chosen time. Cancellation currently has no minimum-notice rule.

Before the refactor, those booking rules were implemented inside `server.js`, which starts the web server when imported, and availability/date validation read the system clock inside the rule functions. The refactor moved the rules into an independent module and made the current time an explicit argument. 