"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

const FORMATS: Record<"date" | "dateTime", Intl.DateTimeFormatOptions> = {
  date: { dateStyle: "medium" },
  dateTime: { dateStyle: "medium", timeStyle: "short" },
};

type LocalTimeProps = { value: string; format?: keyof typeof FORMATS };

// The server can't know the viewer's timezone, so this fills in once in the browser
export function LocalTime({ value, format = "dateTime" }: LocalTimeProps) {
  const label = useSyncExternalStore(
    subscribe,
    () => new Date(value).toLocaleString(undefined, FORMATS[format]),
    () => "",
  );

  return (
    <time dateTime={value} className="whitespace-nowrap">
      {label}
    </time>
  );
}
