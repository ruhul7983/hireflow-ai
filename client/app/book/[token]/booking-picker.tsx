"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { primaryButton } from "@/components/chat/action-buttons";
import { api, errorMessage } from "@/lib/api";
import type { PublicMeeting } from "@/lib/chat-types";

function dayLabel(slot: string) {
  return new Date(slot).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function timeLabel(slot: string) {
  return new Date(slot).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupByDay(slots: string[]) {
  const days = new Map<string, string[]>();

  for (const slot of slots) {
    const day = dayLabel(slot);
    days.set(day, [...(days.get(day) ?? []), slot]);
  }
  return [...days];
}

export function BookingPicker() {
  const { token } = useParams<{ token: string }>();
  const [meeting, setMeeting] = useState<PublicMeeting | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    api<PublicMeeting>(`/meetings/public/${token}`)
      .then((loaded) => {
        if (active) setMeeting(loaded);
      })
      .catch((cause) => {
        if (active) setError(errorMessage(cause));
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function book() {
    setPending(true);
    setError(null);
    try {
      setMeeting(
        await api<PublicMeeting>(`/meetings/public/${token}/book`, {
          method: "POST",
          body: JSON.stringify({ startsAt: selected }),
        }),
      );
    } catch (cause) {
      setError(errorMessage(cause));
      setSelected(null);
      setMeeting(await api<PublicMeeting>(`/meetings/public/${token}`));
    }
    setPending(false);
  }

  if (!meeting) {
    return error ? (
      <p role="alert" className="text-sm font-medium text-danger-strong">
        {error}
      </p>
    ) : (
      <p className="text-sm text-muted">Loading times…</p>
    );
  }

  if (meeting.status === "BOOKED" && meeting.startsAt) {
    return (
      <section role="status" className="space-y-2">
        <CalendarCheck className="size-8 text-success-strong" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">You&apos;re booked</h1>
        <p className="text-muted">
          {dayLabel(meeting.startsAt)} at {timeLabel(meeting.startsAt)} with{" "}
          {meeting.hostName}, about the {meeting.jobTitle} role.
        </p>
      </section>
    );
  }

  if (meeting.status !== "LINK_SENT") {
    return (
      <p className="text-sm text-muted">This booking link is no longer active.</p>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {meeting.firstName ? `Hi ${meeting.firstName}, pick` : "Pick"} a time
        </h1>
        <p className="mt-1 text-muted">
          A meeting with {meeting.hostName} about the {meeting.jobTitle} role.
          Times are shown in your time zone.
        </p>
      </div>

      {groupByDay(meeting.slots).map(([day, slots]) => (
        <div key={day} className="space-y-2">
          <h2 className="text-sm font-semibold">{day}</h2>
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => (
              <button
                key={slot}
                type="button"
                aria-pressed={selected === slot}
                onClick={() => setSelected(slot)}
                className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  selected === slot
                    ? "border-brand bg-brand text-white"
                    : "border-line hover:bg-canvas"
                }`}
              >
                {timeLabel(slot)}
              </button>
            ))}
          </div>
        </div>
      ))}

      {meeting.slots.length === 0 && (
        <p className="text-sm text-muted">No times are available right now.</p>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-danger-strong">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={book}
        disabled={!selected || pending}
        className={primaryButton}
      >
        {pending ? "Booking…" : "Confirm this time"}
      </button>
    </section>
  );
}
