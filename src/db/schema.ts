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
  eventDate: text('event_date').notNull().default('Saturday, 28 November 2026'),
  eventTime: text('event_time').notNull().default('10:30 AM – 12:30 PM'),
  startIso: text('start_iso').notNull().default('2026-11-28T10:30:00'),
  endIso: text('end_iso').notNull().default('2026-11-28T12:30:00'),
  venueName: text('venue_name')
    .notNull()
    .default('Blue Tokai Coffee Roasters, Khan Market'),
  venueAddress: text('venue_address')
    .notNull()
    .default('Middle Lane, Khan Market, New Delhi 110003'),
  mapsUrl: text('maps_url')
    .notNull()
    .default(
      'https://maps.google.com/?q=Blue+Tokai+Coffee+Roasters+Khan+Market+New+Delhi',
    ),
  specialGuest: text('special_guest').notNull().default('Dr. Pratyush Jain'),
  rsvpByDate: text('rsvp_by_date').notNull().default('25 November 2026'),
  seatLimit: integer('seat_limit').notNull().default(25),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const rsvps = pgTable('rsvps', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  momName: text('mom_name').notNull(),
  childNameAge: text('child_name_age').notNull(),
  phone: text('phone').notNull().unique(),
  attending: text('attending').notNull(),
  paediatricianQuestion: text('paediatrician_question').notNull().default(''),
  coffeeOrder: text('coffee_order').notNull(),
  isWaitlist: boolean('is_waitlist').notNull().default(false),
});

export type EventSettingsRow = typeof eventSettings.$inferSelect;
export type RsvpRow = typeof rsvps.$inferSelect;
