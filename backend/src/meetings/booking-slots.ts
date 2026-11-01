// src/meetings/booking-slots.ts
const SLOT_HOURS = [10, 14, 16];
const WORKING_DAYS_SHOWN = 3;
const WEEKEND = [0, 6];

// A mock calendar, so slots are worked out rather than read from a real one
export function upcomingSlots(from = new Date()) {
  const slots: Date[] = [];
  const day = new Date(from);

  while (slots.length < WORKING_DAYS_SHOWN * SLOT_HOURS.length) {
    day.setDate(day.getDate() + 1);
    if (WEEKEND.includes(day.getDay())) continue;

    for (const hour of SLOT_HOURS) {
      const slot = new Date(day);
      slot.setHours(hour, 0, 0, 0);
      slots.push(slot);
    }
  }

  return slots;
}
