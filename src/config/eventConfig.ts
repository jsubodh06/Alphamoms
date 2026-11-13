export interface EventConfig {
  title: string;
  eventDate: string;
  eventTime: string;
  startIso: string;
  endIso: string;
  venueName: string;
  venueAddress: string;
  mapsUrl: string;
  specialGuest: string;
  rsvpByDate: string;
  seatLimit: number;
}

export const DEFAULT_EVENT_CONFIG: EventConfig = {
  title: 'Alpha Moms – Coffee Meet',
  eventDate: 'Saturday, 28 November 2026',
  eventTime: '10:30 AM – 12:30 PM',
  startIso: '2026-11-28T10:30:00',
  endIso: '2026-11-28T12:30:00',
  venueName: 'Blue Tokai Coffee Roasters, Khan Market',
  venueAddress: 'Middle Lane, Khan Market, New Delhi 110003',
  mapsUrl:
    'https://maps.google.com/?q=Blue+Tokai+Coffee+Roasters+Khan+Market+New+Delhi',
  specialGuest: 'Dr. Pratyush Jain',
  rsvpByDate: '25 November 2026',
  seatLimit: 25,
};

export const ATTENDING_OPTIONS = [
  'Absolutely! Count me in ☕',
  "I'll try my best!",
] as const;

export const COFFEE_OPTIONS = [
  'Cappuccino',
  'Iced latte',
  'Fresh fruit juice',
  'Any other choice',
] as const;

export function normalizeIndianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

function toCompactUtcOrLocal(iso: string): string {
  // Format YYYYMMDDTHHMMSS for local-time calendar links
  const cleaned = iso.replace(/[-:]/g, '');
  return cleaned.length >= 15 ? cleaned.slice(0, 15) : '20261128T103000';
}

export function buildGoogleCalendarUrl(config: EventConfig): string {
  const start = toCompactUtcOrLocal(config.startIso);
  const end = toCompactUtcOrLocal(config.endIso);
  const details = [
    `Mommy, let's make some coffee memories!`,
    `Join us for a morning of coffee, conversations and an exclusive interaction with ${config.specialGuest}.`,
    `Venue map: ${config.mapsUrl}`,
    `Note: This is a Dutch-pay coffee meet.`,
  ].join('\n\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: config.title,
    dates: `${start}/${end}`,
    details,
    location: `${config.venueName}, ${config.venueAddress}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildOutlookCalendarUrl(config: EventConfig): string {
  const body = [
    `Mommy, let's make some coffee memories!`,
    `An exclusive morning of coffee & conversations with ${config.specialGuest}.`,
    `Maps: ${config.mapsUrl}`,
    `Note: This is a Dutch-pay coffee meet.`,
  ].join('\n\n');

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: config.title,
    startdt: config.startIso,
    enddt: config.endIso,
    body,
    location: `${config.venueName}, ${config.venueAddress}`,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function buildIcsContent(config: EventConfig): string {
  const start = toCompactUtcOrLocal(config.startIso);
  const end = toCompactUtcOrLocal(config.endIso);
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const escapeIcs = (value: string) =>
    value
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');

  const description = escapeIcs(
    `Mommy, let's make some coffee memories!\nExclusive interaction with ${config.specialGuest}.\nMap: ${config.mapsUrl}\nNote: Dutch-pay coffee meet.`,
  );

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Alpha Moms//Coffee Meet RSVP//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:alpha-moms-coffee-meet-${start}@alphamoms`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(config.title)}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${escapeIcs(`${config.venueName}, ${config.venueAddress}`)}`,
    `URL:${config.mapsUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
