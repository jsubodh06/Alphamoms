import { desc, eq, sql } from 'drizzle-orm';
import { DEFAULT_EVENT_CONFIG } from '../config/eventConfig.ts';
import { db } from './index.ts';
import {
  eventSettings,
  rsvps,
  type EventSettingsRow,
  type RsvpRow,
} from './schema.ts';

export class DuplicatePhoneError extends Error {
  public existing: RsvpRow;
  constructor(existing: RsvpRow) {
    super("You've already RSVP'd – want to update?");
    this.name = 'DuplicatePhoneError';
    this.existing = existing;
  }
}

export class SeatsFullError extends Error {
  public seatLimit: number;
  constructor(seatLimit: number) {
    super('Seats full – join waitlist');
    this.name = 'SeatsFullError';
    this.seatLimit = seatLimit;
  }
}

async function ensureEventSettingsRow(
  executor: Pick<typeof db, 'select' | 'insert'> = db,
): Promise<EventSettingsRow> {
  await executor
    .insert(eventSettings)
    .values({
      id: 1,
      title: DEFAULT_EVENT_CONFIG.title,
      eventDate: DEFAULT_EVENT_CONFIG.eventDate,
      eventTime: DEFAULT_EVENT_CONFIG.eventTime,
      startIso: DEFAULT_EVENT_CONFIG.startIso,
      endIso: DEFAULT_EVENT_CONFIG.endIso,
      venueName: DEFAULT_EVENT_CONFIG.venueName,
      venueAddress: DEFAULT_EVENT_CONFIG.venueAddress,
      mapsUrl: DEFAULT_EVENT_CONFIG.mapsUrl,
      specialGuest: DEFAULT_EVENT_CONFIG.specialGuest,
      rsvpByDate: DEFAULT_EVENT_CONFIG.rsvpByDate,
      seatLimit: DEFAULT_EVENT_CONFIG.seatLimit,
    })
    .onConflictDoNothing();

  const rows = await executor
    .select()
    .from(eventSettings)
    .where(eq(eventSettings.id, 1));
  return rows[0];
}

export async function getPublicEventSummary() {
  try {
    const settings = await ensureEventSettingsRow(db);
    const counts = await db
      .select({
        confirmedCount: sql<number>`count(*) filter (where ${rsvps.isWaitlist} = false)::int`,
        waitlistCount: sql<number>`count(*) filter (where ${rsvps.isWaitlist} = true)::int`,
      })
      .from(rsvps);

    const confirmedCount = counts[0]?.confirmedCount ?? 0;
    const waitlistCount = counts[0]?.waitlistCount ?? 0;
    const seatsLeft = Math.max(0, settings.seatLimit - confirmedCount);

    return {
      settings,
      confirmedCount,
      waitlistCount,
      seatsLeft,
      isFull: seatsLeft <= 0,
    };
  } catch (error) {
    console.error('Database query failed in getPublicEventSummary:', error);
    throw new Error('Unable to load event details. Please try again.', {
      cause: error,
    });
  }
}

export interface SubmitRsvpInput {
  momName: string;
  childNameAge: string;
  phone: string;
  attending: string;
  paediatricianQuestion: string;
  coffeeOrder: string;
  mode?: 'create' | 'update';
  joinWaitlist?: boolean;
}

export async function submitRsvpAtomic(input: SubmitRsvpInput) {
  try {
    return await db.transaction(async (tx) => {
      await ensureEventSettingsRow(tx);

      // Lock the single event settings row to serialize concurrent capacity checks
      const lockedSettingsRows = await tx
        .select()
        .from(eventSettings)
        .where(eq(eventSettings.id, 1))
        .for('update');
      const settings = lockedSettingsRows[0];

      const existingRows = await tx
        .select()
        .from(rsvps)
        .where(eq(rsvps.phone, input.phone))
        .for('update');
      const existing = existingRows[0];

      if (existing && input.mode !== 'update') {
        throw new DuplicatePhoneError(existing);
      }

      const countRows = await tx
        .select({
          confirmedCount: sql<number>`count(*) filter (where ${rsvps.isWaitlist} = false)::int`,
        })
        .from(rsvps);
      const currentConfirmed = countRows[0]?.confirmedCount ?? 0;

      if (existing && input.mode === 'update') {
        const canClaimSeat = !existing.isWaitlist || currentConfirmed < settings.seatLimit;
        const nextWaitlist = !canClaimSeat;

        const updatedRows = await tx
          .update(rsvps)
          .set({
            momName: input.momName,
            childNameAge: input.childNameAge,
            attending: input.attending,
            paediatricianQuestion: input.paediatricianQuestion,
            coffeeOrder: input.coffeeOrder,
            isWaitlist: nextWaitlist,
          })
          .where(eq(rsvps.id, existing.id))
          .returning();

        const afterCounts = await tx
          .select({
            confirmedCount: sql<number>`count(*) filter (where ${rsvps.isWaitlist} = false)::int`,
          })
          .from(rsvps);
        const confirmedCount = afterCounts[0]?.confirmedCount ?? 0;

        return {
          rsvp: updatedRows[0],
          settings,
          confirmedCount,
          seatsLeft: Math.max(0, settings.seatLimit - confirmedCount),
          status: nextWaitlist ? ('waitlisted' as const) : ('updated' as const),
        };
      }

      const isFull = currentConfirmed >= settings.seatLimit;
      if (isFull && !input.joinWaitlist) {
        throw new SeatsFullError(settings.seatLimit);
      }

      const insertedRows = await tx
        .insert(rsvps)
        .values({
          momName: input.momName,
          childNameAge: input.childNameAge,
          phone: input.phone,
          attending: input.attending,
          paediatricianQuestion: input.paediatricianQuestion,
          coffeeOrder: input.coffeeOrder,
          isWaitlist: isFull,
        })
        .returning();

      const confirmedCount = isFull ? currentConfirmed : currentConfirmed + 1;
      return {
        rsvp: insertedRows[0],
        settings,
        confirmedCount,
        seatsLeft: Math.max(0, settings.seatLimit - confirmedCount),
        status: isFull ? ('waitlisted' as const) : ('confirmed' as const),
      };
    });
  } catch (error) {
    if (error instanceof DuplicatePhoneError || error instanceof SeatsFullError) {
      throw error;
    }
    console.error('Database transaction failed in submitRsvpAtomic:', error);
    throw new Error('Could not save your RSVP right now. Please try again.', {
      cause: error,
    });
  }
}

export async function listRsvpsAdmin() {
  try {
    return await db
      .select()
      .from(rsvps)
      .orderBy(desc(rsvps.createdAt), desc(rsvps.id));
  } catch (error) {
    console.error('Database query failed in listRsvpsAdmin:', error);
    throw new Error('Failed to load RSVPs.', { cause: error });
  }
}

export async function updateRsvpAdmin(
  id: number,
  fields: {
    momName: string;
    childNameAge: string;
    phone: string;
    attending: string;
    paediatricianQuestion: string;
    coffeeOrder: string;
    isWaitlist: boolean;
  },
) {
  try {
    return await db.transaction(async (tx) => {
      const updated = await tx
        .update(rsvps)
        .set({
          momName: fields.momName,
          childNameAge: fields.childNameAge,
          phone: fields.phone,
          attending: fields.attending,
          paediatricianQuestion: fields.paediatricianQuestion,
          coffeeOrder: fields.coffeeOrder,
          isWaitlist: fields.isWaitlist,
        })
        .where(eq(rsvps.id, id))
        .returning();
      return updated[0] ?? null;
    });
  } catch (error) {
    console.error('Database query failed in updateRsvpAdmin:', error);
    throw new Error('Failed to update RSVP record.', { cause: error });
  }
}

export async function deleteRsvpAdmin(id: number) {
  try {
    const deleted = await db
      .delete(rsvps)
      .where(eq(rsvps.id, id))
      .returning();
    return deleted[0] ?? null;
  } catch (error) {
    console.error('Database query failed in deleteRsvpAdmin:', error);
    throw new Error('Failed to delete RSVP record.', { cause: error });
  }
}

export async function bulkImportRsvpsAdmin(
  items: Array<{
    momName: string;
    childNameAge: string;
    phone: string;
    attending: string;
    paediatricianQuestion: string;
    coffeeOrder: string;
    isWaitlist?: boolean;
  }>,
) {
  try {
    return await db.transaction(async (tx) => {
      await ensureEventSettingsRow(tx);
      const settingsRows = await tx
        .select()
        .from(eventSettings)
        .where(eq(eventSettings.id, 1))
        .for('update');
      const settings = settingsRows[0];

      const countRows = await tx
        .select({
          confirmedCount: sql<number>`count(*) filter (where ${rsvps.isWaitlist} = false)::int`,
        })
        .from(rsvps);
      let runningConfirmed = countRows[0]?.confirmedCount ?? 0;

      let importedCount = 0;
      let updatedCount = 0;

      for (const item of items) {
        const existingRows = await tx
          .select()
          .from(rsvps)
          .where(eq(rsvps.phone, item.phone));

        if (existingRows.length > 0) {
          await tx
            .update(rsvps)
            .set({
              momName: item.momName,
              childNameAge: item.childNameAge,
              attending: item.attending,
              paediatricianQuestion: item.paediatricianQuestion,
              coffeeOrder: item.coffeeOrder,
            })
            .where(eq(rsvps.id, existingRows[0].id));
          updatedCount++;
        } else {
          const shouldWaitlist =
            typeof item.isWaitlist === 'boolean'
              ? item.isWaitlist
              : runningConfirmed >= settings.seatLimit;
          await tx.insert(rsvps).values({
            momName: item.momName,
            childNameAge: item.childNameAge,
            phone: item.phone,
            attending: item.attending,
            paediatricianQuestion: item.paediatricianQuestion,
            coffeeOrder: item.coffeeOrder,
            isWaitlist: shouldWaitlist,
          });
          if (!shouldWaitlist) {
            runningConfirmed++;
          }
          importedCount++;
        }
      }

      return { importedCount, updatedCount };
    });
  } catch (error) {
    console.error('Database transaction failed in bulkImportRsvpsAdmin:', error);
    throw new Error('Failed to import RSVPs from Excel.', { cause: error });
  }
}

export async function updateEventSettingsAdmin(fields: {
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
}) {
  try {
    await ensureEventSettingsRow(db);
    const updated = await db
      .update(eventSettings)
      .set({
        ...fields,
        updatedAt: new Date(),
      })
      .where(eq(eventSettings.id, 1))
      .returning();
    return updated[0];
  } catch (error) {
    console.error('Database query failed in updateEventSettingsAdmin:', error);
    throw new Error('Failed to update event settings.', { cause: error });
  }
}
