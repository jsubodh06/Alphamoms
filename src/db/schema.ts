import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const eventSettings = pgTable('event_settings', {
  id: serial('id').primaryKey(),
  title: text('title').notNull().default('Alpha Moms – Coffee Meet'),
  eventDate: text('event_date').notNull().default('Monday, 30th Nov 2026'),
  eventTime: text('event_time').notNull().default('9:30 – 12 noon'),
  startIso: text('start_iso').notNull().default('2026-11-30T09:30:00'),
  endIso: text('end_iso').notNull().default('2026-11-30T12:00:00'),
  venueName: text('venue_name').notNull().default('At Bungalow No. 6'),
  venueAddress: text('venue_address').notNull().default('Indore'),
  mapsUrl: text('maps_url')
    .notNull()
    .default('https://maps.google.com/?q=Bungalow+No.+6+Indore'),
  specialGuest: text('special_guest').notNull().default('Dr. Pratyush Jain'),
  rsvpByDate: text('rsvp_by_date').notNull().default('28th Nov 2026'),
  seatLimit: integer('seat_limit').notNull().default(50),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const rsvps = pgTable('rsvps', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  momName: text('mom_name').notNull(),
  childNameAge: text('child_name_age').notNull(),
  phone: text('phone').notNull().unique(),
  attending: text('attending').notNull(),
  doctorTopic: text('doctor_topic').notNull().default(''),
  paediatricianQuestion: text('paediatrician_question').notNull().default(''),
  coffeeOrder: text('coffee_order').notNull(),
  isWaitlist: boolean('is_waitlist').notNull().default(false),
});

export type EventSettingsRow = typeof eventSettings.$inferSelect;
export type RsvpRow = typeof rsvps.$inferSelect;
