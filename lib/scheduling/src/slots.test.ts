import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { blockRange, generateSlots, isSlotBookable } from "./slots";
import { formatInZone, wallClockToInstant } from "./timezones";
import type { SlotRequest } from "./types";

const TORONTO = "America/Toronto";
const LONDON = "Europe/London";
const DUBAI = "Asia/Dubai";
const KARACHI = "Asia/Karachi";
const LOS_ANGELES = "America/Los_Angeles";

/** Weekdays Mon–Fri, 14:00–17:00 local — the example from the brief. */
const AFTERNOON_WINDOWS = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startMinute: 14 * 60,
  endMinute: 17 * 60,
}));

function request(overrides: Partial<SlotRequest> = {}): SlotRequest {
  const now = new Date("2026-03-01T00:00:00Z");
  return {
    timezone: TORONTO,
    windows: AFTERNOON_WINDOWS,
    exceptions: [],
    busy: [],
    durationMinutes: 60,
    policy: {
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      minNoticeMinutes: 0,
      maxAdvanceDays: 365,
    },
    slotIntervalMinutes: 60,
    rangeStart: now,
    rangeEnd: new Date("2026-03-08T00:00:00Z"),
    now,
    ...overrides,
  };
}

describe("wall-clock to instant conversion", () => {
  it("returns null for a local time skipped by spring forward", () => {
    // Toronto jumps 02:00 → 03:00 on 2026-03-08; 02:30 never happens.
    expect(wallClockToInstant("2026-03-08", 2 * 60 + 30, TORONTO)).toBeNull();
  });

  it("resolves an ambiguous fall-back time to the earlier offset", () => {
    // Toronto repeats 01:00–02:00 on 2026-11-01.
    const instant = wallClockToInstant("2026-11-01", 60 + 30, TORONTO);
    expect(instant).not.toBeNull();
    expect(instant?.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });
});

describe("slot generation in the practitioner's zone", () => {
  it("offers 2pm, 3pm and 4pm Toronto time on a weekday", () => {
    const slots = generateSlots(
      request({
        rangeStart: new Date("2026-03-02T00:00:00Z"),
        rangeEnd: new Date("2026-03-03T00:00:00Z"),
      }),
    );

    const local = slots.map((slot) => formatInZone(slot.startsAt, TORONTO, "HH:mm"));
    expect(local).toEqual(["14:00", "15:00", "16:00"]);
  });

  it("keeps 2pm local fixed to a different UTC instant across a DST change", () => {
    // Before the transition Toronto is UTC-5, after it is UTC-4.
    const beforeDst = generateSlots(
      request({
        rangeStart: new Date("2026-03-06T00:00:00Z"),
        rangeEnd: new Date("2026-03-07T00:00:00Z"),
        now: new Date("2026-03-01T00:00:00Z"),
      }),
    );
    const afterDst = generateSlots(
      request({
        rangeStart: new Date("2026-03-09T00:00:00Z"),
        rangeEnd: new Date("2026-03-10T00:00:00Z"),
        now: new Date("2026-03-01T00:00:00Z"),
      }),
    );

    expect(beforeDst[0]?.startsAt.toISOString()).toBe("2026-03-06T19:00:00.000Z");
    expect(afterDst[0]?.startsAt.toISOString()).toBe("2026-03-09T18:00:00.000Z");
    expect(formatInZone(beforeDst[0]!.startsAt, TORONTO, "HH:mm")).toBe("14:00");
    expect(formatInZone(afterDst[0]!.startsAt, TORONTO, "HH:mm")).toBe("14:00");
  });

  it("never offers a start time inside the skipped spring-forward hour", () => {
    const slots = generateSlots(
      request({
        // Overnight window that spans the transition.
        windows: [{ weekday: 7, startMinute: 0, endMinute: 6 * 60 }],
        durationMinutes: 30,
        slotIntervalMinutes: 30,
        rangeStart: new Date("2026-03-08T00:00:00Z"),
        rangeEnd: new Date("2026-03-09T12:00:00Z"),
        now: new Date("2026-03-01T00:00:00Z"),
      }),
    );

    const localTimes = slots.map((slot) =>
      formatInZone(slot.startsAt, TORONTO, "HH:mm"),
    );
    expect(localTimes).not.toContain("02:00");
    expect(localTimes).not.toContain("02:30");
    expect(localTimes).toContain("01:30");
    expect(localTimes).toContain("03:00");
  });
});

describe("cross-time-zone display", () => {
  const cases: Array<{ zone: string; expected: string }> = [
    { zone: TORONTO, expected: "14:00" },
    { zone: LONDON, expected: "19:00" },
    { zone: DUBAI, expected: "23:00" },
    { zone: KARACHI, expected: "00:00" },
    { zone: LOS_ANGELES, expected: "11:00" },
  ];

  it("shows one Toronto slot correctly in every client zone", () => {
    // 2026-03-02 is after Toronto's DST start? No — Toronto switches 2026-03-08,
    // so Toronto is UTC-5 and London is still on GMT.
    const slot = generateSlots(
      request({
        rangeStart: new Date("2026-03-02T00:00:00Z"),
        rangeEnd: new Date("2026-03-03T00:00:00Z"),
      }),
    )[0]!;

    expect(slot.startsAt.toISOString()).toBe("2026-03-02T19:00:00.000Z");
    for (const { zone, expected } of cases) {
      expect(formatInZone(slot.startsAt, zone, "HH:mm")).toBe(expected);
    }
  });

  it("shifts the client-side clock when only the practitioner's zone changes DST", () => {
    // Between 8 and 29 March, Toronto is on EDT but London is still on GMT, so
    // a 2pm Toronto session moves from 19:00 to 18:00 for a London client.
    const before = generateSlots(
      request({
        rangeStart: new Date("2026-03-06T00:00:00Z"),
        rangeEnd: new Date("2026-03-07T00:00:00Z"),
      }),
    )[0]!;
    const after = generateSlots(
      request({
        rangeStart: new Date("2026-03-09T00:00:00Z"),
        rangeEnd: new Date("2026-03-10T00:00:00Z"),
      }),
    )[0]!;

    expect(formatInZone(before.startsAt, LONDON, "HH:mm")).toBe("19:00");
    expect(formatInZone(after.startsAt, LONDON, "HH:mm")).toBe("18:00");
  });

  it("keeps a booked instant stable when a client's zone changes DST later", () => {
    const booked = new Date("2026-03-02T19:00:00.000Z");
    // Karachi never observes DST, so the local time is unchanged either side.
    expect(formatInZone(booked, KARACHI, "HH:mm")).toBe("00:00");
    expect(
      DateTime.fromJSDate(booked, { zone: KARACHI }).toISODate(),
    ).toBe("2026-03-03");
  });

  it("handles a Los Angeles practitioner booked by a Dubai client", () => {
    const slots = generateSlots(
      request({
        timezone: LOS_ANGELES,
        rangeStart: new Date("2026-06-01T00:00:00Z"),
        rangeEnd: new Date("2026-06-02T00:00:00Z"),
        now: new Date("2026-05-01T00:00:00Z"),
      }),
    );

    const first = slots[0]!;
    expect(formatInZone(first.startsAt, LOS_ANGELES, "HH:mm")).toBe("14:00");
    expect(formatInZone(first.startsAt, DUBAI, "HH:mm")).toBe("01:00");
  });
});

describe("duration, buffers and busy time", () => {
  it("does not offer a start whose session would overrun the window", () => {
    const slots = generateSlots(
      request({
        durationMinutes: 90,
        slotIntervalMinutes: 30,
        rangeStart: new Date("2026-03-02T00:00:00Z"),
        rangeEnd: new Date("2026-03-03T00:00:00Z"),
      }),
    );

    const local = slots.map((slot) => formatInZone(slot.startsAt, TORONTO, "HH:mm"));
    expect(local).toEqual(["14:00", "14:30", "15:00", "15:30"]);
  });

  it("removes slots whose buffered block collides with an existing booking", () => {
    const busyStart = new Date("2026-03-02T20:00:00Z"); // 15:00 Toronto
    const slots = generateSlots(
      request({
        policy: {
          bufferBeforeMinutes: 15,
          bufferAfterMinutes: 15,
          minNoticeMinutes: 0,
          maxAdvanceDays: 365,
        },
        busy: [
          {
            start: busyStart,
            end: new Date(busyStart.getTime() + 60 * 60_000),
          },
        ],
        rangeStart: new Date("2026-03-02T00:00:00Z"),
        rangeEnd: new Date("2026-03-03T00:00:00Z"),
      }),
    );

    const local = slots.map((slot) => formatInZone(slot.startsAt, TORONTO, "HH:mm"));
    // 14:00 ends 15:00 but its 15-minute trailing buffer runs into the booking,
    // and 16:00's leading buffer starts before the booking ends.
    expect(local).toEqual([]);
  });

  it("respects minimum notice and the maximum advance window", () => {
    const slots = generateSlots(
      request({
        now: new Date("2026-03-02T18:30:00Z"), // 13:30 Toronto
        policy: {
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 0,
          minNoticeMinutes: 120,
          maxAdvanceDays: 1,
        },
        rangeStart: new Date("2026-03-02T00:00:00Z"),
        rangeEnd: new Date("2026-03-10T00:00:00Z"),
      }),
    );

    // 14:00 and 15:00 fall inside the two-hour notice window, and the one-day
    // advance limit expires at 13:30 Toronto the next day — before that day's
    // window opens.
    const local = slots.map((slot) => formatInZone(slot.startsAt, TORONTO, "HH:mm"));
    expect(local).toEqual(["16:00"]);

    const wider = generateSlots(
      request({
        now: new Date("2026-03-02T18:30:00Z"),
        policy: {
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 0,
          minNoticeMinutes: 120,
          maxAdvanceDays: 2,
        },
        rangeStart: new Date("2026-03-02T00:00:00Z"),
        rangeEnd: new Date("2026-03-10T00:00:00Z"),
      }),
    );
    expect(
      wider.map((slot) => formatInZone(slot.startsAt, TORONTO, "HH:mm")),
    ).toEqual(["16:00", "14:00", "15:00", "16:00"]);
  });
});

describe("exceptions", () => {
  it("removes a blocked afternoon but keeps other days", () => {
    const slots = generateSlots(
      request({
        exceptions: [
          {
            kind: "block",
            startDate: "2026-03-02",
            endDate: "2026-03-02",
            startMinute: 14 * 60,
            endMinute: 16 * 60,
          },
        ],
        rangeStart: new Date("2026-03-02T00:00:00Z"),
        rangeEnd: new Date("2026-03-03T12:00:00Z"),
      }),
    );

    const monday = slots.filter((slot) => slot.practitionerDate === "2026-03-02");
    expect(monday.map((slot) => formatInZone(slot.startsAt, TORONTO, "HH:mm"))).toEqual([
      "16:00",
    ]);
  });

  it("clears a whole vacation range", () => {
    const slots = generateSlots(
      request({
        exceptions: [
          {
            kind: "vacation",
            startDate: "2026-03-02",
            endDate: "2026-03-06",
            startMinute: null,
            endMinute: null,
          },
        ],
      }),
    );
    expect(slots).toHaveLength(0);
  });

  it("adds one-off extra hours on a day with no weekly window", () => {
    const slots = generateSlots(
      request({
        exceptions: [
          {
            kind: "extra",
            startDate: "2026-03-07", // a Saturday
            endDate: "2026-03-07",
            startMinute: 9 * 60,
            endMinute: 11 * 60,
          },
        ],
        rangeStart: new Date("2026-03-07T00:00:00Z"),
        rangeEnd: new Date("2026-03-08T00:00:00Z"),
      }),
    );

    expect(
      slots.map((slot) => formatInZone(slot.startsAt, TORONTO, "HH:mm")),
    ).toEqual(["09:00", "10:00"]);
  });
});

describe("booking re-check", () => {
  it("accepts a generated slot and rejects one that has just been taken", () => {
    const base = request({
      rangeStart: new Date("2026-03-02T00:00:00Z"),
      rangeEnd: new Date("2026-03-03T00:00:00Z"),
    });
    const slot = generateSlots(base)[0]!;

    expect(isSlotBookable(base, slot.startsAt)).toBe(true);
    expect(
      isSlotBookable(
        {
          ...base,
          busy: [{ start: slot.startsAt, end: slot.endsAt }],
        },
        slot.startsAt,
      ),
    ).toBe(false);
  });

  it("rejects a start time that is not on the availability grid", () => {
    const base = request();
    const offGrid = new Date("2026-03-02T19:07:00Z");
    expect(isSlotBookable(base, offGrid)).toBe(false);
  });
});

describe("block range", () => {
  it("widens an appointment by its buffers", () => {
    const range = blockRange(new Date("2026-03-02T19:00:00Z"), 60, 15, 30);
    expect(range.blockStartsAt.toISOString()).toBe("2026-03-02T18:45:00.000Z");
    expect(range.endsAt.toISOString()).toBe("2026-03-02T20:00:00.000Z");
    expect(range.blockEndsAt.toISOString()).toBe("2026-03-02T20:30:00.000Z");
  });
});
