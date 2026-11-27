import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  ATTENDING_OPTIONS,
  DEFAULT_EVENT_CONFIG,
  normalizeIndianPhone,
  type EventConfig,
} from '../config/eventConfig';
import {
  auth,
  firestore,
  handleFirestoreError,
  OperationType,
} from './firebase';

export interface RsvpRecord {
  id: string;
  createdAt: string;
  momName: string;
  childNameAge: string;
  phone: string;
  attending: string;
  doctorTopic: string;
  paediatricianQuestion: string;
  coffeeOrder: string;
  isWaitlist: boolean;
}

export interface EventSummaryResponse {
  settings: EventConfig;
  confirmedCount: number;
  waitlistCount: number;
  seatsLeft: number;
  isFull: boolean;
}

export const ALLOWED_ADMIN_EMAIL = 'subodhjain2007777@gmail.com';

const EVENT_META_COLLECTION = 'event_meta';
const EVENT_META_DOC_ID = 'current';
const RSVPS_COLLECTION = 'rsvps';
const RSVP_LOCKS_COLLECTION = 'rsvp_locks';
const CURRENT_SEAT_LIMIT_VERSION = 4;

class DuplicatePhoneError extends Error {
  constructor() {
    super("You've already RSVP'd – want to update?");
    this.name = 'DuplicatePhoneError';
  }
}

class SeatsFullError extends Error {
  constructor() {
    super('Seats full – join waitlist');
    this.name = 'SeatsFullError';
  }
}

function sanitizeText(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return new Date().toISOString();
}

function mapEventMetaDoc(data: Record<string, unknown> | undefined): EventSummaryResponse {
  if (!data) {
    return {
      settings: { ...DEFAULT_EVENT_CONFIG },
      confirmedCount: 0,
      waitlistCount: 0,
      seatsLeft: DEFAULT_EVENT_CONFIG.seatLimit,
      isFull: false,
    };
  }

  const settings: EventConfig = {
    title:
      typeof data.title === 'string' && data.title.trim()
        ? data.title
        : DEFAULT_EVENT_CONFIG.title,
    eventDate:
      typeof data.eventDate === 'string' && data.eventDate.trim()
        ? data.eventDate
        : DEFAULT_EVENT_CONFIG.eventDate,
    eventTime:
      typeof data.eventTime === 'string' && data.eventTime.trim()
        ? data.eventTime
        : DEFAULT_EVENT_CONFIG.eventTime,
    startIso:
      typeof data.startIso === 'string' && data.startIso.trim()
        ? data.startIso
        : DEFAULT_EVENT_CONFIG.startIso,
    endIso:
      typeof data.endIso === 'string' && data.endIso.trim()
        ? data.endIso
        : DEFAULT_EVENT_CONFIG.endIso,
    venueName:
      typeof data.venueName === 'string' && data.venueName.trim()
        ? data.venueName
        : DEFAULT_EVENT_CONFIG.venueName,
    venueAddress:
      typeof data.venueAddress === 'string' && data.venueAddress.trim()
        ? data.venueAddress
        : DEFAULT_EVENT_CONFIG.venueAddress,
    mapsUrl:
      typeof data.mapsUrl === 'string' && data.mapsUrl.trim()
        ? data.mapsUrl
        : DEFAULT_EVENT_CONFIG.mapsUrl,
    specialGuest:
      typeof data.specialGuest === 'string' && data.specialGuest.trim()
        ? data.specialGuest
        : DEFAULT_EVENT_CONFIG.specialGuest,
    rsvpByDate:
      typeof data.rsvpByDate === 'string' && data.rsvpByDate.trim()
        ? data.rsvpByDate
        : DEFAULT_EVENT_CONFIG.rsvpByDate,
    seatLimit: (() => {
      const rawLimit =
        typeof data.seatLimit === 'number' &&
        Number.isInteger(data.seatLimit) &&
        data.seatLimit >= 1
          ? data.seatLimit
          : DEFAULT_EVENT_CONFIG.seatLimit;
      const existingVersion =
        typeof data.seatLimitVersion === 'number' ? data.seatLimitVersion : 0;
      const isLegacyUnmigrated =
        existingVersion < CURRENT_SEAT_LIMIT_VERSION &&
        (rawLimit === 25 || rawLimit === 30 || rawLimit === 40);
      return isLegacyUnmigrated ? DEFAULT_EVENT_CONFIG.seatLimit : rawLimit;
    })(),
  };

  const confirmedCount =
    typeof data.confirmedCount === 'number' && data.confirmedCount >= 0
      ? data.confirmedCount
      : 0;
  const waitlistCount =
    typeof data.waitlistCount === 'number' && data.waitlistCount >= 0
      ? data.waitlistCount
      : 0;
  const seatsLeft = Math.max(0, settings.seatLimit - confirmedCount);

  return {
    settings,
    confirmedCount,
    waitlistCount,
    seatsLeft,
    isFull: seatsLeft <= 0,
  };
}

function mapRsvpDoc(id: string, data: Record<string, unknown>): RsvpRecord {
  return {
    id,
    createdAt: timestampToIso(data.createdAt),
    momName: typeof data.momName === 'string' ? data.momName : '',
    childNameAge: typeof data.childNameAge === 'string' ? data.childNameAge : '',
    phone: typeof data.phone === 'string' ? data.phone : '',
    attending:
      typeof data.attending === 'string' ? data.attending : ATTENDING_OPTIONS[0],
    doctorTopic: typeof data.doctorTopic === 'string' ? data.doctorTopic : '',
    paediatricianQuestion:
      typeof data.paediatricianQuestion === 'string'
        ? data.paediatricianQuestion
        : '',
    coffeeOrder: typeof data.coffeeOrder === 'string' ? data.coffeeOrder : '',
    isWaitlist: Boolean(data.isWaitlist),
  };
}

function isAuthorizedAdminUser(user: User | null): boolean {
  if (!user || !user.email || !user.emailVerified) return false;
  return user.email.toLowerCase() === ALLOWED_ADMIN_EMAIL.toLowerCase();
}

function waitForAuthReady(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

async function pushToClientGoogleSheet(rsvp: RsvpRecord) {
  const webhookUrl = import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL as
    | string
    | undefined;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        id: rsvp.id,
        created_at: rsvp.createdAt,
        mom_name: rsvp.momName,
        child_name_age: rsvp.childNameAge,
        phone: rsvp.phone,
        attending: rsvp.isWaitlist
          ? `${rsvp.attending} (Waitlist)`
          : rsvp.attending,
        doctor_topic: rsvp.doctorTopic,
        paediatrician_question: rsvp.paediatricianQuestion,
        coffee_order: rsvp.coffeeOrder,
      }),
    });
  } catch {
    // Non-blocking optional backup
  }
}

export async function fetchPublicEvent(): Promise<EventSummaryResponse> {
  const path = `${EVENT_META_COLLECTION}/${EVENT_META_DOC_ID}`;
  try {
    const snap = await getDoc(doc(firestore, EVENT_META_COLLECTION, EVENT_META_DOC_ID));
    return mapEventMetaDoc(snap.exists() ? snap.data() : undefined);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function submitPublicRsvp(payload: {
  momName: string;
  childNameAge: string;
  phone: string;
  attending: string;
  doctorTopic: string;
  paediatricianQuestion: string;
  coffeeOrder: string;
  mode: 'create' | 'update';
  joinWaitlist: boolean;
}): Promise<{
  ok: boolean;
  statusCode: number;
  code?: string;
  error?: string;
  status?: 'confirmed' | 'updated' | 'waitlisted';
  rsvp?: RsvpRecord;
}> {
  const phone = normalizeIndianPhone(payload.phone);
  if (!/^[0-9]{10}$/.test(phone)) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Please enter a valid 10-digit mobile number.',
    };
  }

  const momName = sanitizeText(payload.momName, 120);
  const childNameAge = sanitizeText(payload.childNameAge, 120);
  const attending = sanitizeText(payload.attending, 80);
  const doctorTopic = sanitizeText(payload.doctorTopic || '', 160);
  const paediatricianQuestion = sanitizeText(payload.paediatricianQuestion || '', 1500);
  const coffeeOrder = sanitizeText(payload.coffeeOrder, 120);

  if (momName.length < 2) {
    return {
      ok: false,
      statusCode: 400,
      error: "Please enter Alpha mom's name (at least 2 characters).",
    };
  }
  if (childNameAge.length < 2) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Please enter your child’s name & age.',
    };
  }
  if (!attending || !coffeeOrder) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Please complete all required fields.',
    };
  }

  const phoneHash = await sha256Hex(phone);
  const lockRef = doc(firestore, RSVP_LOCKS_COLLECTION, phoneHash);
  const rsvpRef = doc(firestore, RSVPS_COLLECTION, phoneHash);
  const metaRef = doc(firestore, EVENT_META_COLLECTION, EVENT_META_DOC_ID);

  // Check PII-free lock document first
  let existingLockSnap;
  try {
    existingLockSnap = await getDoc(lockRef);
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.GET,
      `${RSVP_LOCKS_COLLECTION}/${phoneHash}`,
    );
  }

  if (existingLockSnap.exists() && payload.mode !== 'update') {
    return {
      ok: false,
      statusCode: 409,
      code: 'DUPLICATE_PHONE',
      error: "You've already RSVP'd – want to update?",
    };
  }

  // Self-update path for returning guest
  if (existingLockSnap.exists() && payload.mode === 'update') {
    const lockData = existingLockSnap.data();
    const isWaitlist = lockData.status === 'waitlisted';

    try {
      const batch = writeBatch(firestore);
      batch.update(rsvpRef, {
        momName,
        childNameAge,
        attending,
        doctorTopic,
        paediatricianQuestion,
        coffeeOrder,
        updatedAt: serverTimestamp(),
      });
      batch.update(lockRef, {
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `${RSVPS_COLLECTION}/${phoneHash}`,
      );
    }

    const updatedRecord: RsvpRecord = {
      id: phoneHash,
      createdAt: new Date().toISOString(),
      momName,
      childNameAge,
      phone,
      attending,
      doctorTopic,
      paediatricianQuestion,
      coffeeOrder,
      isWaitlist,
    };
    void pushToClientGoogleSheet(updatedRecord);

    return {
      ok: true,
      statusCode: 200,
      status: isWaitlist ? 'waitlisted' : 'updated',
      rsvp: updatedRecord,
    };
  }

  // Atomic creation path (enforces seat limit & duplicate prevention together)
  try {
    const result = await runTransaction(firestore, async (tx) => {
      const [metaSnap, lockSnap] = await Promise.all([
        tx.get(metaRef),
        tx.get(lockRef),
      ]);

      if (lockSnap.exists()) {
        throw new DuplicatePhoneError();
      }

      const currentMeta = mapEventMetaDoc(
        metaSnap.exists() ? metaSnap.data() : undefined,
      );
      const isFull = currentMeta.confirmedCount >= currentMeta.settings.seatLimit;

      if (isFull && !payload.joinWaitlist) {
        throw new SeatsFullError();
      }

      const isWaitlist = isFull;
      const nextConfirmed = isWaitlist
        ? currentMeta.confirmedCount
        : currentMeta.confirmedCount + 1;
      const nextWaitlist = isWaitlist
        ? currentMeta.waitlistCount + 1
        : currentMeta.waitlistCount;

      tx.set(rsvpRef, {
        momName,
        childNameAge,
        phone,
        attending,
        doctorTopic,
        paediatricianQuestion,
        coffeeOrder,
        isWaitlist,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      tx.set(lockRef, {
        status: isWaitlist ? 'waitlisted' : 'confirmed',
        updatedAt: serverTimestamp(),
      });

      if (!metaSnap.exists()) {
        tx.set(metaRef, {
          title: sanitizeText(DEFAULT_EVENT_CONFIG.title, 120),
          eventDate: sanitizeText(DEFAULT_EVENT_CONFIG.eventDate, 80),
          eventTime: sanitizeText(DEFAULT_EVENT_CONFIG.eventTime, 80),
          startIso: sanitizeText(DEFAULT_EVENT_CONFIG.startIso, 40),
          endIso: sanitizeText(DEFAULT_EVENT_CONFIG.endIso, 40),
          venueName: sanitizeText(DEFAULT_EVENT_CONFIG.venueName, 120),
          venueAddress: sanitizeText(DEFAULT_EVENT_CONFIG.venueAddress, 180),
          mapsUrl: sanitizeText(DEFAULT_EVENT_CONFIG.mapsUrl, 300),
          specialGuest: sanitizeText(DEFAULT_EVENT_CONFIG.specialGuest, 120),
          rsvpByDate: sanitizeText(DEFAULT_EVENT_CONFIG.rsvpByDate, 80),
          seatLimit: DEFAULT_EVENT_CONFIG.seatLimit,
          seatLimitVersion: CURRENT_SEAT_LIMIT_VERSION,
          confirmedCount: nextConfirmed,
          waitlistCount: nextWaitlist,
          updatedAt: serverTimestamp(),
        });
      } else {
        const existingData = metaSnap.data();
        const existingVersion =
          typeof existingData.seatLimitVersion === 'number'
            ? existingData.seatLimitVersion
            : 0;
        const needsLegacySeatUpgrade =
          existingVersion < CURRENT_SEAT_LIMIT_VERSION &&
          (existingData.seatLimit === 25 ||
            existingData.seatLimit === 30 ||
            existingData.seatLimit === 40);
        if (needsLegacySeatUpgrade) {
          tx.update(metaRef, {
            seatLimit: DEFAULT_EVENT_CONFIG.seatLimit,
            seatLimitVersion: CURRENT_SEAT_LIMIT_VERSION,
            confirmedCount: nextConfirmed,
            waitlistCount: nextWaitlist,
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.update(metaRef, {
            confirmedCount: nextConfirmed,
            waitlistCount: nextWaitlist,
            updatedAt: serverTimestamp(),
          });
        }
      }

      return { isWaitlist };
    });

    const createdRecord: RsvpRecord = {
      id: phoneHash,
      createdAt: new Date().toISOString(),
      momName,
      childNameAge,
      phone,
      attending,
      doctorTopic,
      paediatricianQuestion,
      coffeeOrder,
      isWaitlist: result.isWaitlist,
    };

    void pushToClientGoogleSheet(createdRecord);

    return {
      ok: true,
      statusCode: 201,
      status: result.isWaitlist ? 'waitlisted' : 'confirmed',
      rsvp: createdRecord,
    };
  } catch (error) {
    if (error instanceof DuplicatePhoneError) {
      return {
        ok: false,
        statusCode: 409,
        code: 'DUPLICATE_PHONE',
        error: error.message,
      };
    }
    if (error instanceof SeatsFullError) {
      return {
        ok: false,
        statusCode: 409,
        code: 'SEATS_FULL',
        error: error.message,
      };
    }
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `${RSVPS_COLLECTION}/${phoneHash}`,
    );
  }
}

export async function checkAdminSessionClient(): Promise<{
  authenticated: boolean;
  email: string | null;
}> {
  const user = await waitForAuthReady();
  if (isAuthorizedAdminUser(user)) {
    return { authenticated: true, email: user!.email! };
  }
  return { authenticated: false, email: null };
}

export async function verifyAdminGoogleUser(user: User): Promise<{
  ok: boolean;
  email?: string;
  error?: string;
}> {
  if (!user.emailVerified || !isAuthorizedAdminUser(user)) {
    return {
      ok: false,
      error: `This Google account is not authorized. Please sign in with ${ALLOWED_ADMIN_EMAIL}.`,
    };
  }
  return { ok: true, email: user.email! };
}

export async function logoutAdminClient(): Promise<void> {
  await signOut(auth).catch(() => undefined);
}

async function syncEventMetaCounts(
  currentSettings: EventConfig,
  rsvpsList: RsvpRecord[],
): Promise<EventSummaryResponse> {
  const confirmedCount = rsvpsList.filter((r) => !r.isWaitlist).length;
  const waitlistCount = rsvpsList.filter((r) => r.isWaitlist).length;
  const metaRef = doc(firestore, EVENT_META_COLLECTION, EVENT_META_DOC_ID);

  try {
    await setDoc(metaRef, {
      title: sanitizeText(currentSettings.title, 120),
      eventDate: sanitizeText(currentSettings.eventDate, 80),
      eventTime: sanitizeText(currentSettings.eventTime, 80),
      startIso: sanitizeText(currentSettings.startIso, 40),
      endIso: sanitizeText(currentSettings.endIso, 40),
      venueName: sanitizeText(currentSettings.venueName, 120),
      venueAddress: sanitizeText(currentSettings.venueAddress, 180),
      mapsUrl: sanitizeText(currentSettings.mapsUrl, 300),
      specialGuest: sanitizeText(currentSettings.specialGuest, 120),
      rsvpByDate: sanitizeText(currentSettings.rsvpByDate, 80),
      seatLimit: Math.max(1, Math.min(1000, Math.round(currentSettings.seatLimit))),
      seatLimitVersion: CURRENT_SEAT_LIMIT_VERSION,
      confirmedCount,
      waitlistCount,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `${EVENT_META_COLLECTION}/${EVENT_META_DOC_ID}`,
    );
  }

  const seatsLeft = Math.max(0, currentSettings.seatLimit - confirmedCount);
  return {
    settings: currentSettings,
    confirmedCount,
    waitlistCount,
    seatsLeft,
    isFull: seatsLeft <= 0,
  };
}

export async function fetchAdminRsvps(): Promise<{
  unauthorized?: boolean;
  rsvps: RsvpRecord[];
  summary: EventSummaryResponse;
}> {
  if (!isAuthorizedAdminUser(auth.currentUser)) {
    return {
      unauthorized: true,
      rsvps: [],
      summary: {
        settings: DEFAULT_EVENT_CONFIG,
        confirmedCount: 0,
        waitlistCount: 0,
        seatsLeft: DEFAULT_EVENT_CONFIG.seatLimit,
        isFull: false,
      },
    };
  }

  const metaRef = doc(firestore, EVENT_META_COLLECTION, EVENT_META_DOC_ID);
  let metaSnap;
  try {
    metaSnap = await getDoc(metaRef);
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.GET,
      `${EVENT_META_COLLECTION}/${EVENT_META_DOC_ID}`,
    );
  }

  let rsvpSnap;
  try {
    const q = query(
      collection(firestore, RSVPS_COLLECTION),
      orderBy('createdAt', 'desc'),
    );
    rsvpSnap = await getDocs(q);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, RSVPS_COLLECTION);
  }

  const rows = rsvpSnap.docs.map((d) => mapRsvpDoc(d.id, d.data()));
  const baseSummary = mapEventMetaDoc(metaSnap.exists() ? metaSnap.data() : undefined);
  const actualConfirmed = rows.filter((r) => !r.isWaitlist).length;
  const actualWaitlist = rows.filter((r) => r.isWaitlist).length;

  // Keep public seat counters & capacity version in sync with actual RSVP docs
  const metaData = metaSnap.exists() ? metaSnap.data() : undefined;
  const needsCapacityVersionSync =
    !metaData || metaData.seatLimitVersion !== CURRENT_SEAT_LIMIT_VERSION;
  if (
    !metaSnap.exists() ||
    needsCapacityVersionSync ||
    baseSummary.confirmedCount !== actualConfirmed ||
    baseSummary.waitlistCount !== actualWaitlist
  ) {
    const synced = await syncEventMetaCounts(baseSummary.settings, rows);
    return { rsvps: rows, summary: synced };
  }

  return { rsvps: rows, summary: baseSummary };
}

export async function updateAdminRsvp(
  id: string,
  updates: {
    momName: string;
    childNameAge: string;
    phone: string;
    attending: string;
    doctorTopic: string;
    paediatricianQuestion: string;
    coffeeOrder: string;
    isWaitlist: boolean;
  },
): Promise<void> {
  if (!isAuthorizedAdminUser(auth.currentUser)) {
    throw new Error('Unauthorized. Please sign in with Google.');
  }

  const normalizedPhone = normalizeIndianPhone(updates.phone);
  if (!/^[0-9]{10}$/.test(normalizedPhone)) {
    throw new Error('Phone must be a valid 10-digit number.');
  }

  const momName = sanitizeText(updates.momName, 120);
  const childNameAge = sanitizeText(updates.childNameAge, 120);
  const attending = sanitizeText(updates.attending, 80);
  const doctorTopic = sanitizeText(updates.doctorTopic || '', 160);
  const paediatricianQuestion = sanitizeText(updates.paediatricianQuestion || '', 1500);
  const coffeeOrder = sanitizeText(updates.coffeeOrder, 120);

  const newHash = await sha256Hex(normalizedPhone);
  const oldRsvpRef = doc(firestore, RSVPS_COLLECTION, id);
  const oldLockRef = doc(firestore, RSVP_LOCKS_COLLECTION, id);

  try {
    const batch = writeBatch(firestore);

    if (newHash === id) {
      batch.update(oldRsvpRef, {
        momName,
        childNameAge,
        phone: normalizedPhone,
        attending,
        doctorTopic,
        paediatricianQuestion,
        coffeeOrder,
        isWaitlist: Boolean(updates.isWaitlist),
        updatedAt: serverTimestamp(),
      });
      batch.set(oldLockRef, {
        status: updates.isWaitlist ? 'waitlisted' : 'confirmed',
        updatedAt: serverTimestamp(),
      });
    } else {
      const newRsvpRef = doc(firestore, RSVPS_COLLECTION, newHash);
      const newLockRef = doc(firestore, RSVP_LOCKS_COLLECTION, newHash);
      const existingTarget = await getDoc(newLockRef);
      if (existingTarget.exists()) {
        throw new Error('Another RSVP already uses this contact number.');
      }

      batch.set(newRsvpRef, {
        momName,
        childNameAge,
        phone: normalizedPhone,
        attending,
        doctorTopic,
        paediatricianQuestion,
        coffeeOrder,
        isWaitlist: Boolean(updates.isWaitlist),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(newLockRef, {
        status: updates.isWaitlist ? 'waitlisted' : 'confirmed',
        updatedAt: serverTimestamp(),
      });
      batch.delete(oldRsvpRef);
      batch.delete(oldLockRef);
    }

    await batch.commit();
  } catch (error) {
    if (error instanceof Error && error.message.includes('Another RSVP')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `${RSVPS_COLLECTION}/${id}`);
  }
}

export async function deleteAdminRsvp(id: string): Promise<void> {
  if (!isAuthorizedAdminUser(auth.currentUser)) {
    throw new Error('Unauthorized. Please sign in with Google.');
  }

  try {
    const batch = writeBatch(firestore);
    batch.delete(doc(firestore, RSVPS_COLLECTION, id));
    batch.delete(doc(firestore, RSVP_LOCKS_COLLECTION, id));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${RSVPS_COLLECTION}/${id}`);
  }
}

export async function bulkImportAdminRsvps(
  rows: Array<{
    momName: string;
    childNameAge: string;
    phone: string;
    attending: string;
    doctorTopic: string;
    paediatricianQuestion: string;
    coffeeOrder: string;
  }>,
): Promise<{
  importedCount: number;
  updatedCount: number;
  skipped: Array<{ row: number; reason: string }>;
}> {
  if (!isAuthorizedAdminUser(auth.currentUser)) {
    throw new Error('Unauthorized. Please sign in with Google.');
  }

  const currentData = await fetchAdminRsvps();
  const existingById = new Map(currentData.rsvps.map((r) => [r.id, r]));
  let confirmedCount = currentData.summary.confirmedCount;
  const seatLimit = currentData.summary.settings.seatLimit;

  let importedCount = 0;
  let updatedCount = 0;
  const skipped: Array<{ row: number; reason: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const phone = normalizeIndianPhone(row.phone || '');
    const momName = sanitizeText(row.momName || '', 120);
    const childNameAge = sanitizeText(row.childNameAge || '', 120);
    const attending = sanitizeText(row.attending || ATTENDING_OPTIONS[0], 80);
    const doctorTopic = sanitizeText(row.doctorTopic || '', 160);
    const paediatricianQuestion = sanitizeText(row.paediatricianQuestion || '', 1500);
    const coffeeOrder = sanitizeText(row.coffeeOrder || 'Cappuccino', 120);

    if (momName.length < 2 || childNameAge.length < 2 || !/^[0-9]{10}$/.test(phone)) {
      skipped.push({
        row: i + 2,
        reason: 'Missing valid name, child info, or 10-digit phone',
      });
      continue;
    }

    const phoneHash = await sha256Hex(phone);
    const existing = existingById.get(phoneHash);
    const rsvpRef = doc(firestore, RSVPS_COLLECTION, phoneHash);
    const lockRef = doc(firestore, RSVP_LOCKS_COLLECTION, phoneHash);

    try {
      const batch = writeBatch(firestore);
      if (existing) {
        batch.update(rsvpRef, {
          momName,
          childNameAge,
          phone,
          attending,
          doctorTopic,
          paediatricianQuestion,
          coffeeOrder,
          isWaitlist: existing.isWaitlist,
          updatedAt: serverTimestamp(),
        });
        batch.set(lockRef, {
          status: existing.isWaitlist ? 'waitlisted' : 'confirmed',
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        updatedCount++;
      } else {
        const isWaitlist = confirmedCount >= seatLimit;
        if (!isWaitlist) confirmedCount++;
        batch.set(rsvpRef, {
          momName,
          childNameAge,
          phone,
          attending,
          doctorTopic,
          paediatricianQuestion,
          coffeeOrder,
          isWaitlist,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.set(lockRef, {
          status: isWaitlist ? 'waitlisted' : 'confirmed',
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        importedCount++;
      }
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `${RSVPS_COLLECTION}/${phoneHash}`,
      );
    }
  }

  return { importedCount, updatedCount, skipped };
}

export async function updateAdminEventSettings(
  settings: EventConfig,
): Promise<EventConfig> {
  if (!isAuthorizedAdminUser(auth.currentUser)) {
    throw new Error('Unauthorized. Please sign in with Google.');
  }

  const current = await fetchAdminRsvps();
  const nextSettings: EventConfig = {
    title: sanitizeText(settings.title, 120) || DEFAULT_EVENT_CONFIG.title,
    eventDate: sanitizeText(settings.eventDate, 80) || DEFAULT_EVENT_CONFIG.eventDate,
    eventTime: sanitizeText(settings.eventTime, 80) || DEFAULT_EVENT_CONFIG.eventTime,
    startIso: sanitizeText(settings.startIso, 40) || DEFAULT_EVENT_CONFIG.startIso,
    endIso: sanitizeText(settings.endIso, 40) || DEFAULT_EVENT_CONFIG.endIso,
    venueName: sanitizeText(settings.venueName, 120) || DEFAULT_EVENT_CONFIG.venueName,
    venueAddress:
      sanitizeText(settings.venueAddress, 180) || DEFAULT_EVENT_CONFIG.venueAddress,
    mapsUrl: sanitizeText(settings.mapsUrl, 300) || DEFAULT_EVENT_CONFIG.mapsUrl,
    specialGuest:
      sanitizeText(settings.specialGuest, 120) || DEFAULT_EVENT_CONFIG.specialGuest,
    rsvpByDate: sanitizeText(settings.rsvpByDate, 80) || DEFAULT_EVENT_CONFIG.rsvpByDate,
    seatLimit: Math.max(
      1,
      Math.min(1000, Math.round(Number(settings.seatLimit) || DEFAULT_EVENT_CONFIG.seatLimit)),
    ),
  };

  await syncEventMetaCounts(nextSettings, current.rsvps);
  return nextSettings;
}
