import {
  DEFAULT_EVENT_CONFIG,
  normalizeIndianPhone,
  type EventConfig,
} from '../config/eventConfig';

export interface RsvpRecord {
  id: number;
  createdAt: string;
  momName: string;
  childNameAge: string;
  phone: string;
  attending: string;
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

const LS_RSVPS_KEY = 'alpha_moms_rsvps_v1';
const LS_SETTINGS_KEY = 'alpha_moms_settings_v1';
const SS_STATIC_ADMIN_KEY = 'alpha_moms_static_admin_v1';

// One-way SHA-256 digests for zero-backend static deployments
const ADMIN_USER_SHA256_LIST = [
  '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
  'dae49dccad25363eaa9570911e1ec0f326d71f1b4df28c248edeb8316e5afb91',
];
const ADMIN_PASS_SHA256 =
  '41b5f0f06f63cc6fd4fefbad9c76574772c416a4f32fd61b7473103ab508e0a1';
export const ALLOWED_ADMIN_EMAIL = 'subodhjain2007777@gmail.com';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
  /\/+$/,
  '',
) || '';

let cachedBackendAvailable: boolean | null = null;

export async function isBackendAvailable(): Promise<boolean> {
  if (cachedBackendAvailable !== null) return cachedBackendAvailable;
  try {
    const res = await fetch(`${API_BASE}/api/health`, {
      method: 'GET',
      credentials: API_BASE ? 'omit' : 'include',
    });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      cachedBackendAvailable = false;
      return false;
    }
    const data = (await res.json()) as { ok?: boolean };
    cachedBackendAvailable = Boolean(data?.ok);
    return cachedBackendAvailable;
  } catch {
    cachedBackendAvailable = false;
    return false;
  }
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function readLocalSettings(): EventConfig {
  try {
    const raw = localStorage.getItem(LS_SETTINGS_KEY);
    if (!raw) return DEFAULT_EVENT_CONFIG;
    return { ...DEFAULT_EVENT_CONFIG, ...(JSON.parse(raw) as Partial<EventConfig>) };
  } catch {
    return DEFAULT_EVENT_CONFIG;
  }
}

function writeLocalSettings(settings: EventConfig) {
  localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(settings));
}

function readLocalRsvps(): RsvpRecord[] {
  try {
    const raw = localStorage.getItem(LS_RSVPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RsvpRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalRsvps(rows: RsvpRecord[]) {
  localStorage.setItem(LS_RSVPS_KEY, JSON.stringify(rows));
}

function buildLocalSummary(): EventSummaryResponse {
  const settings = readLocalSettings();
  const rows = readLocalRsvps();
  const confirmedCount = rows.filter((r) => !r.isWaitlist).length;
  const waitlistCount = rows.filter((r) => r.isWaitlist).length;
  const seatsLeft = Math.max(0, settings.seatLimit - confirmedCount);
  return {
    settings,
    confirmedCount,
    waitlistCount,
    seatsLeft,
    isFull: seatsLeft <= 0,
  };
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
        attending: rsvp.isWaitlist ? `${rsvp.attending} (Waitlist)` : rsvp.attending,
        paediatrician_question: rsvp.paediatricianQuestion,
        coffee_order: rsvp.coffeeOrder,
      }),
    });
  } catch {
    // Non-blocking
  }
}

export async function fetchPublicEvent(): Promise<EventSummaryResponse> {
  if (await isBackendAvailable()) {
    const res = await fetch(`${API_BASE}/api/event`);
    if (res.ok) {
      return (await res.json()) as EventSummaryResponse;
    }
  }
  return buildLocalSummary();
}

export async function submitPublicRsvp(payload: {
  momName: string;
  childNameAge: string;
  phone: string;
  attending: string;
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
  if (await isBackendAvailable()) {
    const method = payload.mode === 'update' ? 'PUT' : 'POST';
    const res = await fetch(`${API_BASE}/api/rsvps`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        momName: payload.momName,
        childNameAge: payload.childNameAge,
        phone: payload.phone,
        attending: payload.attending,
        paediatricianQuestion: payload.paediatricianQuestion,
        coffeeOrder: payload.coffeeOrder,
        joinWaitlist: payload.joinWaitlist,
      }),
    });
    const data = (await res.json()) as {
      code?: string;
      error?: string;
      status?: 'confirmed' | 'updated' | 'waitlisted';
      rsvp?: RsvpRecord;
    };
    return {
      ok: res.ok,
      statusCode: res.status,
      code: data.code,
      error: data.error,
      status: data.status,
      rsvp: data.rsvp,
    };
  }

  // Zero-backend static mode
  const phone = normalizeIndianPhone(payload.phone);
  const rows = readLocalRsvps();
  const settings = readLocalSettings();
  const existingIdx = rows.findIndex((r) => r.phone === phone);

  if (existingIdx !== -1 && payload.mode !== 'update') {
    return {
      ok: false,
      statusCode: 409,
      code: 'DUPLICATE_PHONE',
      error: "You've already RSVP'd – want to update?",
    };
  }

  const confirmedCount = rows.filter((r) => !r.isWaitlist).length;

  if (existingIdx !== -1 && payload.mode === 'update') {
    const existing = rows[existingIdx];
    const canClaimSeat = !existing.isWaitlist || confirmedCount < settings.seatLimit;
    const updated: RsvpRecord = {
      ...existing,
      momName: payload.momName,
      childNameAge: payload.childNameAge,
      attending: payload.attending,
      paediatricianQuestion: payload.paediatricianQuestion,
      coffeeOrder: payload.coffeeOrder,
      isWaitlist: !canClaimSeat,
    };
    rows[existingIdx] = updated;
    writeLocalRsvps(rows);
    void pushToClientGoogleSheet(updated);
    return {
      ok: true,
      statusCode: 200,
      status: updated.isWaitlist ? 'waitlisted' : 'updated',
      rsvp: updated,
    };
  }

  const isFull = confirmedCount >= settings.seatLimit;
  if (isFull && !payload.joinWaitlist) {
    return {
      ok: false,
      statusCode: 409,
      code: 'SEATS_FULL',
      error: 'Seats full – join waitlist',
    };
  }

  const nextId = rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
  const created: RsvpRecord = {
    id: nextId,
    createdAt: new Date().toISOString(),
    momName: payload.momName,
    childNameAge: payload.childNameAge,
    phone,
    attending: payload.attending,
    paediatricianQuestion: payload.paediatricianQuestion,
    coffeeOrder: payload.coffeeOrder,
    isWaitlist: isFull,
  };
  writeLocalRsvps([created, ...rows]);
  void pushToClientGoogleSheet(created);

  return {
    ok: true,
    statusCode: 201,
    status: isFull ? 'waitlisted' : 'confirmed',
    rsvp: created,
  };
}

export async function checkAdminSessionClient(): Promise<{
  authenticated: boolean;
  email?: string;
  mode: 'backend' | 'static';
}> {
  if (await isBackendAvailable()) {
    try {
      const res = await fetch(`${API_BASE}/api/admin/session`, {
        credentials: API_BASE ? 'omit' : 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as {
          authenticated: boolean;
          admin?: { email: string };
        };
        if (data.authenticated && data.admin) {
          return { authenticated: true, email: data.admin.email, mode: 'backend' };
        }
      }
    } catch {
      // fall through
    }
    return { authenticated: false, mode: 'backend' };
  }

  const saved = sessionStorage.getItem(SS_STATIC_ADMIN_KEY);
  return saved
    ? { authenticated: true, email: saved, mode: 'static' }
    : { authenticated: false, mode: 'static' };
}

export async function loginAdminWithCredentials(
  username: string,
  password: string,
): Promise<{
  ok: boolean;
  token?: string;
  email?: string;
  mode: 'backend' | 'static';
  error?: string;
}> {
  if (await isBackendAvailable()) {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      credentials: API_BASE ? 'omit' : 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    const rawText = await res.text();
    let data: { error?: string; token?: string; email?: string } = {};
    try {
      data = rawText ? (JSON.parse(rawText) as typeof data) : {};
    } catch {
      return {
        ok: false,
        mode: 'backend',
        error: `Server returned an unexpected response (${res.status}).`,
      };
    }
    if (!res.ok || !data.token) {
      return {
        ok: false,
        mode: 'backend',
        error: data.error || 'Invalid username or password.',
      };
    }
    return {
      ok: true,
      mode: 'backend',
      token: data.token,
      email: data.email || username.trim(),
    };
  }

  // Zero-backend static verification via Web Crypto SHA-256
  const [userHash, passHash] = await Promise.all([
    sha256Hex(username.trim().toLowerCase()),
    sha256Hex(password),
  ]);
  if (!ADMIN_USER_SHA256_LIST.includes(userHash) || passHash !== ADMIN_PASS_SHA256) {
    return {
      ok: false,
      mode: 'static',
      error: 'Invalid username or password.',
    };
  }

  const email = username.trim();
  sessionStorage.setItem(SS_STATIC_ADMIN_KEY, email);
  return {
    ok: true,
    mode: 'static',
    token: 'static-session',
    email,
  };
}

export async function verifyAdminGoogleToken(
  idToken: string,
  email: string | null,
  emailVerified: boolean,
): Promise<{
  ok: boolean;
  mode: 'backend' | 'static';
  email?: string;
  error?: string;
}> {
  if (await isBackendAvailable()) {
    const verifyRes = await fetch(`${API_BASE}/api/admin/session`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const verifyData = (await verifyRes.json()) as {
      error?: string;
      authenticated?: boolean;
      admin?: { email: string };
    };
    if (!verifyRes.ok || !verifyData.authenticated) {
      return {
        ok: false,
        mode: 'backend',
        error: verifyData.error || 'This Google account is not authorized.',
      };
    }
    return {
      ok: true,
      mode: 'backend',
      email: verifyData.admin?.email || email || 'Admin',
    };
  }

  const normalized = (email || '').toLowerCase();
  if (!emailVerified || normalized !== ALLOWED_ADMIN_EMAIL) {
    return {
      ok: false,
      mode: 'static',
      error: 'Only the authorized organizer Google account can access admin.',
    };
  }
  sessionStorage.setItem(SS_STATIC_ADMIN_KEY, normalized);
  return { ok: true, mode: 'static', email: normalized };
}

export async function logoutAdminClient(): Promise<void> {
  sessionStorage.removeItem(SS_STATIC_ADMIN_KEY);
  if (await isBackendAvailable()) {
    await fetch(`${API_BASE}/api/admin/logout`, {
      method: 'POST',
      credentials: API_BASE ? 'omit' : 'include',
    }).catch(() => undefined);
  }
}

export async function fetchAdminRsvps(token: string | null): Promise<{
  rsvps: RsvpRecord[];
  summary: EventSummaryResponse;
  unauthorized?: boolean;
}> {
  if (await isBackendAvailable()) {
    const res = await fetch(`${API_BASE}/api/admin/rsvps`, {
      credentials: API_BASE ? 'omit' : 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (res.status === 401 || res.status === 403) {
      return {
        rsvps: [],
        summary: buildLocalSummary(),
        unauthorized: true,
      };
    }
    if (!res.ok) {
      throw new Error('Could not load RSVP list.');
    }
    return (await res.json()) as {
      rsvps: RsvpRecord[];
      summary: EventSummaryResponse;
    };
  }

  return {
    rsvps: readLocalRsvps(),
    summary: buildLocalSummary(),
  };
}

export async function updateAdminRsvp(
  id: number,
  fields: Omit<RsvpRecord, 'id' | 'createdAt'>,
  token: string | null,
) {
  if (await isBackendAvailable()) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/api/admin/rsvps/${id}`, {
      method: 'PATCH',
      credentials: API_BASE ? 'omit' : 'include',
      headers,
      body: JSON.stringify(fields),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error || 'Failed to update RSVP.');
    return;
  }

  const phone = normalizeIndianPhone(fields.phone);
  if (!/^\d{10}$/.test(phone)) {
    throw new Error('Phone must be 10 digits.');
  }
  const rows = readLocalRsvps();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error('RSVP not found.');
  rows[idx] = { ...rows[idx], ...fields, phone };
  writeLocalRsvps(rows);
}

export async function deleteAdminRsvp(id: number, token: string | null) {
  if (await isBackendAvailable()) {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/api/admin/rsvps/${id}`, {
      method: 'DELETE',
      credentials: API_BASE ? 'omit' : 'include',
      headers,
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error || 'Failed to delete RSVP.');
    }
    return;
  }

  const rows = readLocalRsvps().filter((r) => r.id !== id);
  writeLocalRsvps(rows);
}

export async function bulkImportAdminRsvps(
  mappedRows: Array<{
    momName: string;
    childNameAge: string;
    phone: string;
    attending: string;
    paediatricianQuestion: string;
    coffeeOrder: string;
  }>,
  token: string | null,
): Promise<{
  importedCount: number;
  updatedCount: number;
  skipped: Array<{ row: number; reason: string }>;
}> {
  if (await isBackendAvailable()) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/api/admin/rsvps/import`, {
      method: 'POST',
      credentials: API_BASE ? 'omit' : 'include',
      headers,
      body: JSON.stringify({ rows: mappedRows }),
    });
    const result = (await res.json()) as {
      error?: string;
      importedCount?: number;
      updatedCount?: number;
      skipped?: Array<{ row: number; reason: string }>;
    };
    if (!res.ok) {
      throw new Error(result.error || 'Import failed.');
    }
    return {
      importedCount: result.importedCount ?? 0,
      updatedCount: result.updatedCount ?? 0,
      skipped: result.skipped ?? [],
    };
  }

  const rows = readLocalRsvps();
  const settings = readLocalSettings();
  let runningConfirmed = rows.filter((r) => !r.isWaitlist).length;
  let nextId = rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
  let importedCount = 0;
  let updatedCount = 0;
  const skipped: Array<{ row: number; reason: string }> = [];

  mappedRows.forEach((raw, idx) => {
    const phone = normalizeIndianPhone(raw.phone);
    if (!raw.momName || !raw.childNameAge || !/^\d{10}$/.test(phone)) {
      skipped.push({
        row: idx + 1,
        reason: 'Missing mom name, child details, or valid 10-digit phone',
      });
      return;
    }
    const existingIdx = rows.findIndex((r) => r.phone === phone);
    const isWaitlist = /\(Waitlist\)/i.test(raw.attending);
    const cleanAttending =
      raw.attending.replace(/\s*\(Waitlist\)\s*$/i, '') ||
      'Absolutely! Count me in ☕';

    if (existingIdx !== -1) {
      rows[existingIdx] = {
        ...rows[existingIdx],
        momName: raw.momName,
        childNameAge: raw.childNameAge,
        attending: cleanAttending,
        paediatricianQuestion: raw.paediatricianQuestion,
        coffeeOrder: raw.coffeeOrder || 'Cappuccino',
      };
      updatedCount++;
    } else {
      const waitlisted = isWaitlist || runningConfirmed >= settings.seatLimit;
      rows.unshift({
        id: nextId++,
        createdAt: new Date().toISOString(),
        momName: raw.momName,
        childNameAge: raw.childNameAge,
        phone,
        attending: cleanAttending,
        paediatricianQuestion: raw.paediatricianQuestion,
        coffeeOrder: raw.coffeeOrder || 'Cappuccino',
        isWaitlist: waitlisted,
      });
      if (!waitlisted) runningConfirmed++;
      importedCount++;
    }
  });

  if (importedCount === 0 && updatedCount === 0) {
    throw new Error('No valid RSVP rows found in the uploaded sheet.');
  }

  writeLocalRsvps(rows);
  return { importedCount, updatedCount, skipped };
}

export async function updateAdminEventSettings(
  settings: EventConfig,
  token: string | null,
): Promise<EventConfig> {
  if (await isBackendAvailable()) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/api/admin/settings`, {
      method: 'PUT',
      credentials: API_BASE ? 'omit' : 'include',
      headers,
      body: JSON.stringify(settings),
    });
    const data = (await res.json()) as {
      error?: string;
      settings?: EventConfig;
    };
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save event settings.');
    }
    return data.settings ?? settings;
  }

  writeLocalSettings(settings);
  return settings;
}
