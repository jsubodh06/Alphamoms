import 'dotenv/config';
import express from 'express';
import {
  ATTENDING_OPTIONS,
  normalizeIndianPhone,
} from './config/eventConfig.ts';
import {
  bulkImportRsvpsAdmin,
  deleteRsvpAdmin,
  DuplicatePhoneError,
  getPublicEventSummary,
  listRsvpsAdmin,
  SeatsFullError,
  submitRsvpAtomic,
  updateEventSettingsAdmin,
  updateRsvpAdmin,
} from './db/rsvps.ts';
import {
  createAdminSessionToken,
  requireAdmin,
  verifyAdminCredentials,
  type AuthRequest,
} from './middleware/auth.ts';

export const app = express();
app.use('/api', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});
app.use(express.json({ limit: '2mb' }));

async function forwardToGoogleSheets(rsvp: {
  id: number;
  createdAt: Date | string;
  momName: string;
  childNameAge: string;
  phone: string;
  attending: string;
  paediatricianQuestion: string;
  coffeeOrder: string;
  isWaitlist: boolean;
}) {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  } catch (err) {
    console.warn('Google Sheets webhook forwarding failed:', err);
  }
}

function validateRsvpBody(body: Record<string, unknown>) {
  const momName = typeof body.momName === 'string' ? body.momName.trim() : '';
  const childNameAge =
    typeof body.childNameAge === 'string' ? body.childNameAge.trim() : '';
  const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const phone = normalizeIndianPhone(rawPhone);
  const attending =
    typeof body.attending === 'string' ? body.attending.trim() : '';
  const paediatricianQuestion =
    typeof body.paediatricianQuestion === 'string'
      ? body.paediatricianQuestion.trim()
      : '';
  const coffeeOrder =
    typeof body.coffeeOrder === 'string' ? body.coffeeOrder.trim() : '';

  if (momName.length < 2 || momName.length > 120) {
    return { error: "Please enter Mom's name (at least 2 characters)." };
  }
  if (childNameAge.length < 2 || childNameAge.length > 120) {
    return { error: "Please enter your child's name and age." };
  }
  if (!/^\d{10}$/.test(phone)) {
    return { error: 'Please enter a valid 10-digit mobile number.' };
  }
  if (
    !ATTENDING_OPTIONS.includes(
      attending as (typeof ATTENDING_OPTIONS)[number],
    )
  ) {
    return { error: 'Please select whether you will be attending.' };
  }
  if (paediatricianQuestion.length > 1000) {
    return { error: 'Your question must be under 1,000 characters.' };
  }
  if (coffeeOrder.length < 1 || coffeeOrder.length > 160) {
    return { error: 'Please choose or enter your coffee order.' };
  }

  return {
    data: {
      momName,
      childNameAge,
      phone,
      attending,
      paediatricianQuestion,
      coffeeOrder,
    },
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/event', async (_req, res) => {
  try {
    const summary = await getPublicEventSummary();
    res.json(summary);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to load event details.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/rsvps', async (req, res) => {
  const parsed = validateRsvpBody((req.body ?? {}) as Record<string, unknown>);
  if ('error' in parsed) {
    return res.status(400).json({ error: parsed.error });
  }

  try {
    const joinWaitlist = Boolean(req.body?.joinWaitlist);
    const result = await submitRsvpAtomic({
      ...parsed.data,
      mode: 'create',
      joinWaitlist,
    });
    void forwardToGoogleSheets(result.rsvp);
    return res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof DuplicatePhoneError) {
      return res.status(409).json({
        code: 'DUPLICATE_PHONE',
        error: error.message,
        existing: error.existing,
      });
    }
    if (error instanceof SeatsFullError) {
      return res.status(409).json({
        code: 'SEATS_FULL',
        error: 'Seats full – join waitlist',
        seatLimit: error.seatLimit,
      });
    }
    const message =
      error instanceof Error ? error.message : 'Failed to submit RSVP.';
    return res.status(500).json({ error: message });
  }
});

app.put('/api/rsvps', async (req, res) => {
  const parsed = validateRsvpBody((req.body ?? {}) as Record<string, unknown>);
  if ('error' in parsed) {
    return res.status(400).json({ error: parsed.error });
  }

  try {
    const result = await submitRsvpAtomic({
      ...parsed.data,
      mode: 'update',
    });
    void forwardToGoogleSheets(result.rsvp);
    return res.json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to update RSVP.';
    return res.status(500).json({ error: message });
  }
});

app.post('/api/admin/login', (req, res) => {
  const username =
    typeof req.body?.username === 'string' ? req.body.username : '';
  const password =
    typeof req.body?.password === 'string' ? req.body.password : '';

  if (!username || !password || !verifyAdminCredentials(username, password)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = createAdminSessionToken(username.trim());
  const isSecure =
    req.secure || req.headers['x-forwarded-proto'] === 'https';

  res.cookie('alpha_moms_admin', token, {
    httpOnly: true,
    sameSite: isSecure ? 'none' : 'lax',
    secure: isSecure,
    maxAge: 1000 * 60 * 60 * 12,
    path: '/',
  });

  return res.json({
    authenticated: true,
    token,
    email: username.trim(),
  });
});

app.post('/api/admin/logout', (req, res) => {
  const isSecure =
    req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.clearCookie('alpha_moms_admin', {
    httpOnly: true,
    sameSite: isSecure ? 'none' : 'lax',
    secure: isSecure,
    path: '/',
  });
  res.json({ ok: true });
});

app.get('/api/admin/session', requireAdmin, (req: AuthRequest, res) => {
  res.json({ authenticated: true, admin: req.admin });
});

app.get('/api/admin/rsvps', requireAdmin, async (_req, res) => {
  try {
    const [rows, summary] = await Promise.all([
      listRsvpsAdmin(),
      getPublicEventSummary(),
    ]);
    res.json({ rsvps: rows, summary });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch RSVPs.';
    res.status(500).json({ error: message });
  }
});

app.patch('/api/admin/rsvps/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid RSVP id.' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const momName = typeof body.momName === 'string' ? body.momName.trim() : '';
  const childNameAge =
    typeof body.childNameAge === 'string' ? body.childNameAge.trim() : '';
  const phone = normalizeIndianPhone(
    typeof body.phone === 'string' ? body.phone.trim() : '',
  );
  const attending =
    typeof body.attending === 'string' ? body.attending.trim() : '';
  const paediatricianQuestion =
    typeof body.paediatricianQuestion === 'string'
      ? body.paediatricianQuestion.trim()
      : '';
  const coffeeOrder =
    typeof body.coffeeOrder === 'string' ? body.coffeeOrder.trim() : '';
  const isWaitlist = Boolean(body.isWaitlist);

  if (
    !momName ||
    !childNameAge ||
    !/^\d{10}$/.test(phone) ||
    !attending ||
    !coffeeOrder
  ) {
    return res.status(400).json({
      error: 'All required fields (including 10-digit phone) must be valid.',
    });
  }

  try {
    const updated = await updateRsvpAdmin(id, {
      momName,
      childNameAge,
      phone,
      attending,
      paediatricianQuestion,
      coffeeOrder,
      isWaitlist,
    });
    if (!updated) {
      return res.status(404).json({ error: 'RSVP not found.' });
    }
    res.json({ rsvp: updated });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to update RSVP.';
    res.status(500).json({ error: message });
  }
});

app.delete('/api/admin/rsvps/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid RSVP id.' });
  }
  try {
    const deleted = await deleteRsvpAdmin(id);
    if (!deleted) {
      return res.status(404).json({ error: 'RSVP not found.' });
    }
    res.json({ deleted });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to delete RSVP.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/admin/rsvps/import', requireAdmin, async (req, res) => {
  const rawRows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rawRows || rawRows.length === 0) {
    return res.status(400).json({ error: 'No rows provided for import.' });
  }

  const validRows: Array<{
    momName: string;
    childNameAge: string;
    phone: string;
    attending: string;
    paediatricianQuestion: string;
    coffeeOrder: string;
    isWaitlist?: boolean;
  }> = [];
  const skipped: Array<{ row: number; reason: string }> = [];

  rawRows.forEach((raw: Record<string, unknown>, idx: number) => {
    const momName =
      typeof raw.momName === 'string' ? raw.momName.trim() : '';
    const childNameAge =
      typeof raw.childNameAge === 'string' ? raw.childNameAge.trim() : '';
    const phone = normalizeIndianPhone(
      typeof raw.phone === 'string' || typeof raw.phone === 'number'
        ? String(raw.phone).trim()
        : '',
    );
    const attending =
      typeof raw.attending === 'string' && raw.attending.trim()
        ? raw.attending.trim()
        : ATTENDING_OPTIONS[0];
    const paediatricianQuestion =
      typeof raw.paediatricianQuestion === 'string'
        ? raw.paediatricianQuestion.trim()
        : '';
    const coffeeOrder =
      typeof raw.coffeeOrder === 'string' && raw.coffeeOrder.trim()
        ? raw.coffeeOrder.trim()
        : 'Cappuccino';

    if (!momName || !childNameAge || !/^\d{10}$/.test(phone)) {
      skipped.push({
        row: idx + 1,
        reason: 'Missing mom name, child details, or valid 10-digit phone',
      });
      return;
    }

    validRows.push({
      momName,
      childNameAge,
      phone,
      attending: attending.replace(/\s*\(Waitlist\)\s*$/i, ''),
      paediatricianQuestion,
      coffeeOrder,
      isWaitlist: /\(Waitlist\)/i.test(attending) ? true : undefined,
    });
  });

  if (validRows.length === 0) {
    return res.status(400).json({
      error: 'No valid RSVP rows found in the uploaded sheet.',
      skipped,
    });
  }

  try {
    const stats = await bulkImportRsvpsAdmin(validRows);
    res.json({ ...stats, skipped });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to import Excel rows.';
    res.status(500).json({ error: message });
  }
});

app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const seatLimit = Number(b.seatLimit);
  if (!Number.isInteger(seatLimit) || seatLimit < 1 || seatLimit > 1000) {
    return res
      .status(400)
      .json({ error: 'Seat limit must be an integer between 1 and 1000.' });
  }

  const fields = {
    title: typeof b.title === 'string' ? b.title.trim() : '',
    eventDate: typeof b.eventDate === 'string' ? b.eventDate.trim() : '',
    eventTime: typeof b.eventTime === 'string' ? b.eventTime.trim() : '',
    startIso: typeof b.startIso === 'string' ? b.startIso.trim() : '',
    endIso: typeof b.endIso === 'string' ? b.endIso.trim() : '',
    venueName: typeof b.venueName === 'string' ? b.venueName.trim() : '',
    venueAddress:
      typeof b.venueAddress === 'string' ? b.venueAddress.trim() : '',
    mapsUrl: typeof b.mapsUrl === 'string' ? b.mapsUrl.trim() : '',
    specialGuest:
      typeof b.specialGuest === 'string' ? b.specialGuest.trim() : '',
    rsvpByDate: typeof b.rsvpByDate === 'string' ? b.rsvpByDate.trim() : '',
    seatLimit,
  };

  if (
    !fields.title ||
    !fields.eventDate ||
    !fields.eventTime ||
    !fields.venueName ||
    !fields.specialGuest ||
    !fields.rsvpByDate
  ) {
    return res
      .status(400)
      .json({ error: 'Please complete all required event settings fields.' });
  }

  try {
    const updated = await updateEventSettingsAdmin(fields);
    res.json({ settings: updated });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to save event settings.';
    res.status(500).json({ error: message });
  }
});
