import { signInWithPopup, signOut } from 'firebase/auth';
import {
  ArrowLeft,
  Check,
  Coffee,
  Download,
  Edit3,
  LogOut,
  Search,
  Settings,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import alphaMomsLogo from '../assets/alpha-moms-logo.png';
import {
  ATTENDING_OPTIONS,
  DOCTOR_TOPIC_OPTIONS,
  type EventConfig,
} from '../config/eventConfig';
import { auth, googleAuthProvider } from '../lib/firebase';
import {
  ALLOWED_ADMIN_EMAIL,
  bulkImportAdminRsvps,
  checkAdminSessionClient,
  deleteAdminRsvp,
  fetchAdminRsvps,
  logoutAdminClient,
  updateAdminEventSettings,
  updateAdminRsvp,
  verifyAdminGoogleUser,
} from '../lib/rsvpClient';

interface AdminRsvp {
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

interface AdminSummary {
  settings: EventConfig;
  confirmedCount: number;
  waitlistCount: number;
  seatsLeft: number;
  isFull: boolean;
}

type AttendingFilter = 'all' | 'count_me_in' | 'will_try' | 'waitlist';
type AdminTab = 'rsvps' | 'settings';

export function AdminDashboard({
  onBackToRsvp,
}: {
  onBackToRsvp: () => void;
}) {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Login state
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Data state
  const [rsvps, setRsvps] = useState<AdminRsvp[]>([]);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Filters & tabs
  const [activeTab, setActiveTab] = useState<AdminTab>('rsvps');
  const [searchQuery, setSearchQuery] = useState('');
  const [attendingFilter, setAttendingFilter] = useState<AttendingFilter>('all');

  // Edit modal & delete confirmation
  const [editingRow, setEditingRow] = useState<AdminRsvp | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Settings form
  const [settingsForm, setSettingsForm] = useState<EventConfig | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAdminData = useCallback(async () => {
    setLoadingData(true);
    setDataError(null);
    try {
      const data = await fetchAdminRsvps();
      if (data.unauthorized) {
        setAdminEmail(null);
        return;
      }
      setRsvps(data.rsvps);
      setSummary(data.summary);
      setSettingsForm(data.summary.settings);
    } catch (err: unknown) {
      setDataError(
        err instanceof Error ? err.message : 'Failed to fetch dashboard data.',
      );
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Check existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await checkAdminSessionClient();
        if (session.authenticated && session.email) {
          setAdminEmail(session.email);
          await fetchAdminData();
        }
      } catch {
        // Not signed in
      } finally {
        setCheckingSession(false);
      }
    };
    void checkSession();
  }, [fetchAdminData]);

  const handleGoogleLogin = async () => {
    if (loggingIn) return;
    setLoggingIn(true);
    setLoginError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const verified = await verifyAdminGoogleUser(cred.user);
      if (!verified.ok) {
        await signOut(auth);
        setLoginError(
          verified.error || 'This Google account is not authorized for admin.',
        );
        return;
      }
      setAdminEmail(verified.email || cred.user.email || 'Admin');
      await fetchAdminData();
    } catch (err: unknown) {
      const authCode =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (authCode === 'auth/unauthorized-domain') {
        const host = window.location.hostname;
        setLoginError(
          `Add "${host}" under Firebase Console → Authentication → Settings → Authorized domains (console.firebase.google.com/project/substantial-medium-b2w8r/authentication/settings) to enable Admin sign-in on this domain.`,
        );
      } else if (authCode === 'auth/popup-closed-by-user') {
        setLoginError('Google sign-in popup was closed. Please try again.');
      } else {
        setLoginError(
          err instanceof Error ? err.message : 'Google sign-in was cancelled.',
        );
      }
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logoutAdminClient();
    await signOut(auth).catch(() => undefined);
    setAdminEmail(null);
    setRsvps([]);
  };

  const counts = useMemo(() => {
    let countMeIn = 0;
    let willTry = 0;
    let waitlist = 0;
    const coffeeMap = new Map<string, number>();

    for (const row of rsvps) {
      if (row.isWaitlist) waitlist++;
      if (row.attending === ATTENDING_OPTIONS[0]) countMeIn++;
      else if (row.attending === ATTENDING_OPTIONS[1]) willTry++;

      const drink = row.coffeeOrder.trim() || 'Unspecified';
      coffeeMap.set(drink, (coffeeMap.get(drink) ?? 0) + 1);
    }

    const coffeeBreakdown = Array.from(coffeeMap.entries()).sort(
      (a, b) => b[1] - a[1],
    );

    return {
      total: rsvps.length,
      countMeIn,
      willTry,
      waitlist,
      coffeeBreakdown,
    };
  }, [rsvps]);

  const filteredRsvps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rsvps.filter((row) => {
      if (attendingFilter === 'count_me_in' && row.attending !== ATTENDING_OPTIONS[0]) {
        return false;
      }
      if (attendingFilter === 'will_try' && row.attending !== ATTENDING_OPTIONS[1]) {
        return false;
      }
      if (attendingFilter === 'waitlist' && !row.isWaitlist) {
        return false;
      }
      if (!q) return true;
      return (
        row.momName.toLowerCase().includes(q) ||
        row.childNameAge.toLowerCase().includes(q) ||
        row.phone.toLowerCase().includes(q) ||
        (row.doctorTopic || '').toLowerCase().includes(q) ||
        row.paediatricianQuestion.toLowerCase().includes(q) ||
        row.coffeeOrder.toLowerCase().includes(q)
      );
    });
  }, [attendingFilter, rsvps, searchQuery]);

  const handleExportExcel = () => {
    const headers = [
      'Date',
      "Alpha Mom's Name",
      "Child's Name & Age",
      'Contact Number',
      'Attending',
      'Topic for Doctor',
      '2am Questions / Worries',
      'Coffee Order',
    ];

    const rowsData = filteredRsvps.map((r) => [
      new Date(r.createdAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      r.momName,
      r.childNameAge,
      r.phone,
      r.isWaitlist ? `${r.attending} (Waitlist)` : r.attending,
      r.doctorTopic || '—',
      r.paediatricianQuestion || '—',
      r.coffeeOrder,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rowsData]);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 20 }, // Date
      { wch: 22 }, // Alpha Mom's Name
      { wch: 22 }, // Child's Name & Age
      { wch: 16 }, // Contact Number
      { wch: 28 }, // Attending
      { wch: 34 }, // Topic for Doctor
      { wch: 46 }, // 2am Questions / Worries
      { wch: 20 }, // Coffee Order
    ];

    // Format header row and wrap Question column
    worksheet['!rows'] = [
      { hpt: 26 },
      ...filteredRsvps.map((r) => {
        const lines = Math.max(
          1,
          Math.ceil((r.paediatricianQuestion?.length || 10) / 42),
        );
        return { hpt: Math.min(120, Math.max(20, lines * 16)) };
      }),
    ];

    for (let col = 0; col < headers.length; col++) {
      const headerRef = XLSX.utils.encode_cell({ r: 0, c: col });
      if (worksheet[headerRef]) {
        worksheet[headerRef].s = {
          font: { bold: true, color: { rgb: 'F7ECDC' } },
          fill: { fgColor: { rgb: '4A2A1A' } },
          alignment: { vertical: 'center', horizontal: 'left' },
        };
      }
    }

    // Wrap text on Topic for Doctor (col 5) and 2am Questions (col 6)
    for (let row = 1; row <= filteredRsvps.length; row++) {
      for (const col of [5, 6]) {
        const ref = XLSX.utils.encode_cell({ r: row, c: col });
        if (worksheet[ref]) {
          worksheet[ref].s = {
            alignment: { wrapText: true, vertical: 'top' },
          };
        }
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RSVPs');

    const dateStamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `alpha-moms-coffee-meet-rsvps-${dateStamp}.xlsx`);
    setStatusNotice(`Exported ${filteredRsvps.length} RSVP rows to Excel.`);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setStatusNotice(null);
    setDataError(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawObjects = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        firstSheet,
        { defval: '' },
      );

      if (rawObjects.length === 0) {
        setDataError('The selected Excel sheet is empty.');
        return;
      }

      const pickField = (obj: Record<string, unknown>, candidates: string[]) => {
        const entries = Object.entries(obj);
        for (const candidate of candidates) {
          const found = entries.find(
            ([k]) => k.trim().toLowerCase() === candidate.toLowerCase(),
          );
          if (found && String(found[1]).trim() !== '') {
            return String(found[1]).trim();
          }
        }
        return '';
      };

      const mappedRows = rawObjects.map((obj) => ({
        momName: pickField(obj, [
          "alpha mom's name",
          'alpha mom name',
          "mom's name",
          'mom name',
          'mom_name',
          'name',
        ]),
        childNameAge: pickField(obj, [
          "child's name & age",
          'child name & age',
          'child_name_age',
          'child',
        ]),
        phone: pickField(obj, [
          'contact number',
          'phone',
          'mobile',
          'phone number',
        ]),
        attending: pickField(obj, ['attending', 'status']),
        doctorTopic: pickField(obj, [
          'topic for doctor',
          'doctor topic',
          'doctor_topic',
          'topic',
          'what would you like to ask the doctor?',
        ]),
        paediatricianQuestion: pickField(obj, [
          '2am questions / worries',
          'question for paediatrician',
          'paediatrician question',
          'paediatrician_question',
          'question',
        ]),
        coffeeOrder: pickField(obj, [
          'coffee order',
          'coffee_order',
          'coffee',
          'drink',
        ]),
      }));

      const result = await bulkImportAdminRsvps(mappedRows);

      const skippedMsg =
        result.skipped && result.skipped.length > 0
          ? ` (${result.skipped.length} skipped)`
          : '';
      setStatusNotice(
        `Excel import complete: ${result.importedCount} added, ${result.updatedCount} updated${skippedMsg}.`,
      );
      await fetchAdminData();
    } catch (err: unknown) {
      setDataError(
        err instanceof Error
          ? err.message
          : 'Could not read the Excel file. Please verify the format.',
      );
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow || savingEdit) return;
    setSavingEdit(true);
    setDataError(null);
    try {
      await updateAdminRsvp(editingRow.id, {
        momName: editingRow.momName,
        childNameAge: editingRow.childNameAge,
        phone: editingRow.phone,
        attending: editingRow.attending,
        doctorTopic: editingRow.doctorTopic || '',
        paediatricianQuestion: editingRow.paediatricianQuestion,
        coffeeOrder: editingRow.coffeeOrder,
        isWaitlist: editingRow.isWaitlist,
      });
      setEditingRow(null);
      setStatusNotice('RSVP updated.');
      await fetchAdminData();
    } catch (err: unknown) {
      setDataError(
        err instanceof Error ? err.message : 'Failed to update RSVP.',
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteRow = async (id: string) => {
    if (deletingId !== null) return;
    setDeletingId(id);
    setDataError(null);
    try {
      await deleteAdminRsvp(id);
      setConfirmDeleteId(null);
      setStatusNotice('RSVP removed.');
      await fetchAdminData();
    } catch (err: unknown) {
      setDataError(
        err instanceof Error ? err.message : 'Failed to delete RSVP.',
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm || savingSettings) return;
    setSavingSettings(true);
    setDataError(null);
    setStatusNotice(null);
    try {
      const updated = await updateAdminEventSettings(settingsForm);
      setSettingsForm(updated);
      setStatusNotice('Event settings updated.');
      await fetchAdminData();
    } catch (err: unknown) {
      setDataError(
        err instanceof Error ? err.message : 'Failed to save event settings.',
      );
    } finally {
      setSavingSettings(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <div className="rounded-2xl border border-[#d9b99b]/25 bg-[#2d170c]/90 px-6 py-4 text-sm text-[#f7ecdc]">
          Loading organizer portal…
        </div>
      </div>
    );
  }

  if (!adminEmail) {
    return (
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-md overflow-hidden rounded-[24px] foam-paper text-[#241209] shadow-2xl border border-[#e4c29b]">
          <div className="h-4 w-full coffee-sleeve-band" />
          <div className="p-6 sm:p-8">
            <button
              type="button"
              onClick={onBackToRsvp}
              className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-[#6b3f24] hover:text-[#241209]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to RSVP Form</span>
            </button>

            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-[#241209]">
                  Organizer Admin
                </h1>
                <p className="mt-1 text-sm text-[#6b3f24]">
                  Sign in to manage Alpha Moms RSVPs, seats, and Excel exports.
                </p>
              </div>
              <img
                src={alphaMomsLogo}
                alt="Alpha Moms"
                className="h-11 w-auto shrink-0 object-contain mix-blend-multiply"
              />
            </div>

            <div className="mt-6 space-y-4">
              {loginError && (
                <p
                  role="alert"
                  className="rounded-xl border border-[#9f2c20]/30 bg-[#9f2c20]/10 px-3.5 py-2.5 text-xs leading-relaxed font-medium text-[#9f2c20] break-words"
                >
                  {loginError}
                </p>
              )}

              <button
                type="button"
                disabled={loggingIn}
                onClick={handleGoogleLogin}
                className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl bg-[#4a2a1a] px-4 py-3 text-sm font-semibold text-[#f7ecdc] hover:bg-[#361c10] disabled:opacity-60 transition-colors"
              >
                <span>{loggingIn ? 'Signing in…' : 'Sign in with Google'}</span>
              </button>

              <p className="text-center text-xs text-[#6b3f24]">
                Authorized organizer account:{' '}
                <span className="font-medium text-[#4a2a1a]">
                  {ALLOWED_ADMIN_EMAIL}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 min-h-screen text-[#f7ecdc]">
      {/* Clean 3-Zone Top Bar */}
      <header className="border-b border-[#d9b99b]/15 bg-[#1b0d06]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab('rsvps')}
            className="inline-flex items-center gap-2.5 text-lg font-semibold tracking-tight text-[#f7ecdc] whitespace-nowrap shrink-0"
          >
            <span className="inline-flex items-center rounded-lg bg-white px-2 py-0.5 shadow-sm">
              <img
                src={alphaMomsLogo}
                alt="Alpha Moms"
                className="h-6 w-auto object-contain"
              />
            </span>
            <span>Admin</span>
          </button>

          <nav className="flex items-center gap-4 sm:gap-6 text-sm">
            <button
              type="button"
              onClick={() => setActiveTab('rsvps')}
              className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors ${
                activeTab === 'rsvps'
                  ? 'border-b-2 border-[#e9a9a0] font-medium text-[#f7ecdc]'
                  : 'text-[#d9b99b]/75 hover:text-[#f7ecdc]'
              }`}
            >
              RSVPs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 pb-0.5 transition-colors ${
                activeTab === 'settings'
                  ? 'border-b-2 border-[#e9a9a0] font-medium text-[#f7ecdc]'
                  : 'text-[#d9b99b]/75 hover:text-[#f7ecdc]'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Event Settings</span>
            </button>
            <button
              type="button"
              onClick={onBackToRsvp}
              className="hidden sm:inline-block whitespace-nowrap shrink-0 text-[#d9b99b]/75 hover:text-[#f7ecdc]"
            >
              Public Form
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#d9b99b]/30 px-3 py-1.5 text-xs font-medium text-[#f7ecdc] hover:bg-[#4a2a1a] whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {statusNotice && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#c98a4b]/45 bg-[#361d10] px-4 py-3 text-sm text-[#f7ecdc]">
            <span>{statusNotice}</span>
            <button
              type="button"
              onClick={() => setStatusNotice(null)}
              aria-label="Dismiss message"
              className="p-1 text-[#d9b99b] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {dataError && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e9a9a0]/50 bg-[#521e17] px-4 py-3 text-sm text-[#f7ecdc]">
            <span>{dataError}</span>
            <button
              type="button"
              onClick={() => setDataError(null)}
              aria-label="Dismiss error"
              className="p-1 text-[#e9a9a0] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {activeTab === 'rsvps' ? (
          <>
            {/* Summary Counts & Coffee Orders */}
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              <div className="rounded-2xl border border-[#d9b99b]/20 bg-[#2e180d]/90 p-4">
                <p className="text-xs text-[#d9b99b]/80">Total RSVPs</p>
                <p className="mt-1 text-2xl font-semibold text-[#f7ecdc] tabular-nums">
                  {counts.total}
                </p>
              </div>
              <div className="rounded-2xl border border-[#d9b99b]/20 bg-[#2e180d]/90 p-4">
                <p className="text-xs text-[#d9b99b]/80">Count me in</p>
                <p className="mt-1 text-2xl font-semibold text-[#e9a9a0] tabular-nums">
                  {counts.countMeIn}
                </p>
              </div>
              <div className="rounded-2xl border border-[#d9b99b]/20 bg-[#2e180d]/90 p-4">
                <p className="text-xs text-[#d9b99b]/80">Will try</p>
                <p className="mt-1 text-2xl font-semibold text-[#f7ecdc] tabular-nums">
                  {counts.willTry}
                </p>
              </div>
              <div className="rounded-2xl border border-[#d9b99b]/20 bg-[#2e180d]/90 p-4">
                <p className="text-xs text-[#d9b99b]/80">Confirmed / Limit</p>
                <p className="mt-1 text-2xl font-semibold text-[#f7ecdc] tabular-nums">
                  {summary?.confirmedCount ?? 0} / {summary?.settings.seatLimit ?? 40}
                </p>
              </div>
              <div className="col-span-2 sm:col-span-4 lg:col-span-1 rounded-2xl border border-[#d9b99b]/20 bg-[#2e180d]/90 p-4">
                <p className="flex items-center gap-1.5 text-xs text-[#d9b99b]/80">
                  <Coffee className="h-3.5 w-3.5 text-[#c98a4b]" />
                  <span>Waitlist</span>
                </p>
                <p className="mt-1 text-2xl font-semibold text-[#f7ecdc] tabular-nums">
                  {counts.waitlist}
                </p>
              </div>
            </section>

            {/* Coffee Order Breakdown */}
            <section className="rounded-2xl border border-[#d9b99b]/20 bg-[#2e180d]/80 px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <span className="flex items-center gap-1.5 font-medium text-[#e4c29b]">
                  <Users className="h-4 w-4 text-[#c98a4b]" />
                  <span>Coffee orders:</span>
                </span>
                {counts.coffeeBreakdown.length === 0 ? (
                  <span className="text-[#d9b99b]/60">No orders yet</span>
                ) : (
                  counts.coffeeBreakdown.map(([drink, count]) => (
                    <span
                      key={drink}
                      className="text-[#f7ecdc] tabular-nums"
                    >
                      {drink}{' '}
                      <span className="font-mono-tabular text-[#e9a9a0]">
                        ({count})
                      </span>
                    </span>
                  ))
                )}
              </div>
            </section>

            {/* Search, Filter & Excel Actions */}
            <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#d9b99b]/60" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search alpha mom, child, phone, topic, question, coffee…"
                    className="w-full rounded-xl border border-[#d9b99b]/25 bg-[#1b0d06]/70 py-2.5 pl-9 pr-3.5 text-sm text-[#f7ecdc] placeholder:text-[#d9b99b]/45 focus:border-[#c98a4b] focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#1b0d06]/70 p-1 border border-[#d9b99b]/15">
                  {(
                    [
                      ['all', 'All'],
                      ['count_me_in', 'Count me in'],
                      ['will_try', 'Will try'],
                      ['waitlist', 'Waitlist'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAttendingFilter(key)}
                      className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        attendingFilter === key
                          ? 'bg-[#c98a4b] text-[#241209]'
                          : 'text-[#d9b99b]/80 hover:text-[#f7ecdc]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportExcel}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-[#d9b99b]/35 bg-[#361b0e] px-4 py-2 text-sm font-medium text-[#f7ecdc] hover:bg-[#4a2a1a] whitespace-nowrap shrink-0"
                >
                  <Upload className="h-4 w-4 text-[#e9a9a0]" />
                  <span>Import from Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={filteredRsvps.length === 0}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#c98a4b] px-4 py-2 text-sm font-semibold text-[#241209] hover:bg-[#d6995a] disabled:opacity-45 whitespace-nowrap shrink-0"
                >
                  <Download className="h-4 w-4" />
                  <span>Export to Excel</span>
                </button>
              </div>
            </section>

            {/* RSVPs Table (Desktop) & Cards (Mobile 360px) */}
            <section className="overflow-hidden rounded-2xl border border-[#d9b99b]/20 bg-[#221108]/90">
              {loadingData ? (
                <div className="p-8 text-center text-sm text-[#d9b99b]">
                  Loading RSVPs…
                </div>
              ) : filteredRsvps.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#d9b99b]/75">
                  No matching RSVPs found.
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#d9b99b]/20 bg-[#190c05] text-xs font-medium text-[#e4c29b]">
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Alpha Mom&apos;s Name</th>
                          <th className="px-4 py-3">Child&apos;s Name &amp; Age</th>
                          <th className="px-4 py-3">Contact</th>
                          <th className="px-4 py-3">Attending</th>
                          <th className="px-4 py-3">Topic for Doctor</th>
                          <th className="px-4 py-3">2am Questions / Worries</th>
                          <th className="px-4 py-3">Coffee Order</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#d9b99b]/12">
                        {filteredRsvps.map((row) => (
                          <tr
                            key={row.id}
                            className="hover:bg-[#341a0d]/60 transition-colors"
                          >
                            <td className="px-4 py-3 text-xs text-[#d9b99b]/80 font-mono-tabular whitespace-nowrap">
                              {new Date(row.createdAt).toLocaleDateString(
                                'en-IN',
                                {
                                  day: '2-digit',
                                  month: 'short',
                                },
                              )}
                            </td>
                            <td className="px-4 py-3 font-medium text-[#f7ecdc]">
                              {row.momName}
                            </td>
                            <td className="px-4 py-3 text-[#e4c29b]">
                              {row.childNameAge}
                            </td>
                            <td className="px-4 py-3 font-mono-tabular text-[#f7ecdc]">
                              {row.phone}
                            </td>
                            <td className="px-4 py-3 text-xs text-[#f7ecdc]">
                              {row.attending}
                              {row.isWaitlist && (
                                <span className="ml-1.5 text-[#e9a9a0]">
                                  · Waitlist
                                </span>
                              )}
                            </td>
                            <td className="max-w-[210px] px-4 py-3 text-xs text-[#e4c29b] break-words">
                              {row.doctorTopic || '—'}
                            </td>
                            <td className="max-w-xs px-4 py-3 text-xs text-[#d9b99b] break-words">
                              {row.paediatricianQuestion || '—'}
                            </td>
                            <td className="px-4 py-3 text-[#f7ecdc]">
                              {row.coffeeOrder}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              {confirmDeleteId === row.id ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={deletingId === row.id}
                                    onClick={() => void handleDeleteRow(row.id)}
                                    className="rounded-lg bg-[#9f2c20] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#b83426]"
                                  >
                                    {deletingId === row.id ? '…' : 'Confirm'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="rounded-lg border border-[#d9b99b]/30 px-2 py-1 text-xs text-[#d9b99b]"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setEditingRow({ ...row })}
                                    aria-label={`Edit ${row.momName}`}
                                    className="rounded-lg p-2 text-[#d9b99b] hover:bg-[#4a2a1a] hover:text-[#f7ecdc]"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(row.id)}
                                    aria-label={`Delete ${row.momName}`}
                                    className="rounded-lg p-2 text-[#e9a9a0]/80 hover:bg-[#521e17] hover:text-[#e9a9a0]"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Stacked Rows */}
                  <div className="divide-y divide-[#d9b99b]/15 md:hidden">
                    {filteredRsvps.map((row) => (
                      <div key={row.id} className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-[#f7ecdc]">
                              {row.momName}
                            </p>
                            <p className="text-xs text-[#e4c29b]">
                              {row.childNameAge} ·{' '}
                              <span className="font-mono-tabular">
                                {row.phone}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingRow({ ...row })}
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#d9b99b] hover:bg-[#4a2a1a]"
                              aria-label={`Edit ${row.momName}`}
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            {confirmDeleteId === row.id ? (
                              <button
                                type="button"
                                onClick={() => void handleDeleteRow(row.id)}
                                className="min-h-[38px] rounded-lg bg-[#9f2c20] px-2.5 text-xs font-medium text-white"
                              >
                                Confirm
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(row.id)}
                                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#e9a9a0] hover:bg-[#521e17]"
                                aria-label={`Delete ${row.momName}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-[#f7ecdc]">
                          {row.attending}
                          {row.isWaitlist ? ' · Waitlist' : ''} ·{' '}
                          <span className="text-[#c98a4b]">
                            {row.coffeeOrder}
                          </span>
                        </p>
                        {row.doctorTopic && (
                          <p className="text-xs text-[#e4c29b]">
                            Topic: {row.doctorTopic}
                          </p>
                        )}
                        {row.paediatricianQuestion && (
                          <p className="text-xs text-[#d9b99b]/85 leading-relaxed">
                            2am Q: {row.paediatricianQuestion}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </>
        ) : (
          /* Event Settings Form */
          settingsForm && (
            <section className="mx-auto max-w-2xl rounded-2xl border border-[#d9b99b]/20 bg-[#221108]/95 p-5 sm:p-7">
              <h2 className="text-xl font-semibold text-[#f7ecdc]">
                Event Details &amp; Seat Limit
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#d9b99b]/80">
                Updates reflect immediately on the public RSVP page, calendar
                links, and capacity checks.
              </p>

              <form onSubmit={handleSaveSettings} className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-[#e4c29b]">
                      Event Title
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.title}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, title: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-[#d9b99b]/25 bg-[#190c05] px-3.5 py-2.5 text-sm text-[#f7ecdc]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#e4c29b]">
                      Display Date
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.eventDate}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          eventDate: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-[#d9b99b]/25 bg-[#190c05] px-3.5 py-2.5 text-sm text-[#f7ecdc]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#e4c29b]">
                      Display Time
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.eventTime}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          eventTime: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-[#d9b99b]/25 bg-[#190c05] px-3.5 py-2.5 text-sm text-[#f7ecdc]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#e4c29b]">
                      Calendar Start (ISO)
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.startIso}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          startIso: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-[#d9b99b]/25 bg-[#190c05] px-3.5 py-2.5 font-mono-tabular text-sm text-[#f7ecdc]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#e4c29b]">
                      Calendar End (ISO)
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.endIso}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          endIso: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-[#d9b99b]/25 bg-[#190c05] px-3.5 py-2.5 font-mono-tabular text-sm text-[#f7ecdc]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs text-[#e4c29b]">
                      Venue Name
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.venueName}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          venueName: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-[#d9b99b]/25 bg-[#190c05] px-3.5 py-2.5 text-sm text-[#f7ecdc]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs text-[#e4c29b]">
                      Venue Address
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.venueAddress}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          venueAddress: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-[#d9b99b]/25 bg-[#190c05] px-3.5 py-2.5 text-sm text-[#f7ecdc]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs text-[#e4c29b]">
                      Google Maps Link
                    </label>
                    <input
                      type="url"
                      required
                      value={settingsForm.mapsUrl}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          mapsUrl: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-[#d9b99b]/25 bg-[#190c05] px-3.5 py-2.5 text-sm text-[#f7ecdc]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#e4c29b]">
                      Special Guest
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.specialGuest}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          specialGuest: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-[#d9b99b]/25 bg-[#190c05] px-3.5 py-2.5 text-sm text-[#f7ecdc]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#e4c29b]">
                      RSVP-by Date
                    </label>
                    <input
                      type="text"
                      required
                      value={settingsForm.rsvpByDate}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          rsvpByDate: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-[#d9b99b]/25 bg-[#190c05] px-3.5 py-2.5 text-sm text-[#f7ecdc]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#e4c29b]">
                      Seat Limit
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      required
                      value={settingsForm.seatLimit}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          seatLimit: Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-[#d9b99b]/25 bg-[#190c05] px-3.5 py-2.5 font-mono-tabular text-sm text-[#f7ecdc]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#c98a4b] px-5 py-2.5 text-sm font-semibold text-[#241209] hover:bg-[#d6995a] disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" />
                    <span>{savingSettings ? 'Saving…' : 'Save Settings'}</span>
                  </button>
                </div>
              </form>
            </section>
          )
        )}
      </main>

      {/* Edit Row Modal */}
      {editingRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Edit RSVP"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#e4c29b]/40 foam-paper p-6 text-[#241209] shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit RSVP</h3>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-[#6b3f24] hover:bg-[#e4c29b]/40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#4a2a1a]">
                    Alpha Mom&apos;s Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editingRow.momName}
                    onChange={(e) =>
                      setEditingRow({ ...editingRow, momName: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-[#c98a4b]/60 bg-white/90 px-3 py-2 text-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4a2a1a]">
                    Child&apos;s Name &amp; Age
                  </label>
                  <input
                    type="text"
                    required
                    value={editingRow.childNameAge}
                    onChange={(e) =>
                      setEditingRow({
                        ...editingRow,
                        childNameAge: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-[#c98a4b]/60 bg-white/90 px-3 py-2 text-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4a2a1a]">
                    Phone (10 digits)
                  </label>
                  <input
                    type="tel"
                    required
                    value={editingRow.phone}
                    onChange={(e) =>
                      setEditingRow({ ...editingRow, phone: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-[#c98a4b]/60 bg-white/90 px-3 py-2 font-mono-tabular text-base"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#4a2a1a]">
                    Coffee Order
                  </label>
                  <input
                    type="text"
                    required
                    value={editingRow.coffeeOrder}
                    onChange={(e) =>
                      setEditingRow({
                        ...editingRow,
                        coffeeOrder: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-[#c98a4b]/60 bg-white/90 px-3 py-2 text-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4a2a1a]">
                  Attending
                </label>
                <select
                  value={editingRow.attending}
                  onChange={(e) =>
                    setEditingRow({ ...editingRow, attending: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-[#c98a4b]/60 bg-white/90 px-3 py-2 text-base"
                >
                  {ATTENDING_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4a2a1a]">
                  Topic for Doctor
                </label>
                <select
                  value={editingRow.doctorTopic || ''}
                  onChange={(e) =>
                    setEditingRow({ ...editingRow, doctorTopic: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-[#c98a4b]/60 bg-white/90 px-3 py-2 text-base"
                >
                  <option value="">Not specified</option>
                  {DOCTOR_TOPIC_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.value}>
                      {opt.value}
                    </option>
                  ))}
                  {editingRow.doctorTopic &&
                    !DOCTOR_TOPIC_OPTIONS.some(
                      (opt) => opt.value === editingRow.doctorTopic,
                    ) && (
                      <option value={editingRow.doctorTopic}>
                        {editingRow.doctorTopic}
                      </option>
                    )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4a2a1a]">
                  2am Questions / Constant Worries
                </label>
                <textarea
                  rows={3}
                  value={editingRow.paediatricianQuestion}
                  onChange={(e) =>
                    setEditingRow({
                      ...editingRow,
                      paediatricianQuestion: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-[#c98a4b]/60 bg-white/90 px-3 py-2 text-base"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-[#4a2a1a]">
                <input
                  type="checkbox"
                  checked={editingRow.isWaitlist}
                  onChange={(e) =>
                    setEditingRow({
                      ...editingRow,
                      isWaitlist: e.target.checked,
                    })
                  }
                  className="h-4 w-4 accent-[#4a2a1a]"
                />
                <span>On Waitlist</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="min-h-[42px] rounded-xl border border-[#c98a4b]/60 px-4 py-2 text-sm font-medium text-[#4a2a1a]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="min-h-[42px] rounded-xl bg-[#4a2a1a] px-5 py-2 text-sm font-semibold text-[#f7ecdc] hover:bg-[#361c10]"
                >
                  {savingEdit ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
