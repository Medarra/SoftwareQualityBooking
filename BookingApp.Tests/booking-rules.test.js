import {
  parseBookingDate,
  timeToMinutes,
  getAvailability,
  appointmentInput,
  updateProviderAvailability,
  cancelAppointment
} from "../booking-rules.js";

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("timeToMinutes", () => {
  it("converts a valid time to minutes", () => {
    assert.equal(timeToMinutes("09:30"), 570);
  });
});