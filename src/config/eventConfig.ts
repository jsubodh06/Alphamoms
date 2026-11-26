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

export const EVENT_POSTER_URL = '/assets/aistudio/IMG-20261124-WA0008_b60c083e.jpg';

export const DEFAULT_EVENT_CONFIG: EventConfig = {
  title: 'Alpha Moms – Coffee Meet',
  eventDate: 'Monday, 30th Nov 2026',
  eventTime: '9:30 – 12 noon',
  startIso: '2026-11-30T09:30:00',
  endIso: '2026-11-30T12:00:00',
  venueName: 'At Bungalow No. 6',
  venueAddress: 'Indore',
  mapsUrl: 'https://maps.google.com/?q=Bungalow+No.+6+Indore',
  specialGuest: 'Dr. Pratyush Jain',
  rsvpByDate: '28th Nov 2026',
  seatLimit: 40,
};

export const ATTENDING_OPTIONS = [
  'Absolutely! Count me in ☕',
  "I'll try my best!",
] as const;

export interface DoctorTopicOption {
  id: string;
  badge: string;
  title: string;
  value: string;
  description: string;
}

export const DOCTOR_TOPIC_OPTIONS: readonly DoctorTopicOption[] = [
  {
    id: 'toddler-handbook',
    badge: '1️⃣',
    title: 'The Toddler Health Handbook',
    value: '1️⃣ The Toddler Health Handbook',
    description:
      'Common illnesses, fever, cough, cold, infections, immunity myths, and knowing when a child actually needs a doctor.',
  },
  {
    id: 'growing-right',
    badge: '2️⃣',
    title: 'Is My Child Growing Right?',
    value: '2️⃣ Is My Child Growing Right?',
    description:
      'Growth milestones, height and weight, developmental delays, speech concerns, screen time, and signs that warrant assessment.',
  },
  {
    id: 'vaccines-immunity',
    badge: '3️⃣',
    title: 'Vaccines, Immunity & Preventive Care',
    value: '3️⃣ Vaccines, Immunity & Preventive Care',
    description:
      'Vaccination schedules, booster doses, annual health checks, vitamin D, iron deficiency, and evidence-based immunity advice.',
  },
  {
    id: 'all-three',
    badge: '4️⃣',
    title: 'All 3',
    value: '4️⃣ All 3',
    description: 'Cover all three topics during the session.',
  },
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
  const cleaned = iso.replace(/[-:]/g, '');
  return cleaned.length >= 15 ? cleaned.slice(0, 15) : '20261130T093000';
}

export function buildGoogleCalendarUrl(config: EventConfig): string {
  const start = toCompactUtcOrLocal(config.startIso);
  const end = toCompactUtcOrLocal(config.endIso);
  const details = [
    `Mommy, let's make some coffee memories!`,
    `We are excited to have you join us for a RENDEZVOUS WITH ${config.specialGuest.toUpperCase()}.`,
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
    `We are excited to have you join us for a RENDEZVOUS WITH ${config.specialGuest.toUpperCase()}.`,
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
    `Mommy, let's make some coffee memories!\nWe are excited to have you join us for a RENDEZVOUS WITH ${config.specialGuest.toUpperCase()}.\nMap: ${config.mapsUrl}\nNote: Dutch-pay coffee meet.`,
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
