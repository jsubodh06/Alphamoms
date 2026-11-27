# Alpha Moms – Coffee Meet RSVP Security Spec

## Data Invariants
1. **PII Isolation**: `/rsvps/{phoneHash}` contains guest PII (`momName`, `childNameAge`, `phone`). Only verified organizer admins (`email_verified == true` and allowlisted email or `/admins/{uid}` document) may `get`, `list`, or `delete` `/rsvps`.
2. **Public Seat Counter Integrity**: `/event_meta/current` is publicly readable via `get` (never `list`). Non-admin creates require `seatLimit == 50`. Non-admin updates may ONLY increment `confirmedCount` by `+1` (strictly while `confirmedCount < seatLimit`) or `waitlistCount` by `+1`, and must set `updatedAt == request.time` (with a strictly bounded one-time legacy migration from `seatLimit == 25`, `30`, or `40` to `seatLimit == 50, seatLimitVersion == 4` only when `seatLimitVersion` is absent or `< 4`).
3. **Atomicity & Duplicate Prevention**: Every public RSVP creation must atomically create `/rsvp_locks/{phoneHash}` and `/rsvps/{phoneHash}` together (`existsAfter`), keyed by the 64-char hex SHA-256 hash of the normalized 10-digit phone number.
4. **Immutability**: `createdAt` is immutable on all `/rsvps` updates. For public self-updates, `phone` and `isWaitlist` are also immutable so a guest cannot hijack another number or bypass the waitlist.
5. **Strict Bounds & Keys**: Every document write validates exact allowed keys (`hasAll` + `hasOnly`), exact types, regex patterns (`^[0-9]{10}$` for phone, `^[a-f0-9]{64}$` for `phoneHash`), and `maxLength` bounds matching `firebase-blueprint.json`.

## Dirty Dozen Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated PII Read**: `get(/rsvps/{phoneHash})` or `list(/rsvps)` by anonymous/non-admin user.
2. **Email Spoofing**: `get(/rsvps/{phoneHash})` with `token.email == 'subodhjain2007777@gmail.com'` but `token.email_verified == false`.
3. **Shadow Field Injection on RSVP**: `create(/rsvps/{phoneHash})` including extra ghost key `isAdmin: true` or `vip: true`.
4. **Shadow Field Injection on EventMeta**: `update(/event_meta/current)` by guest attempting to change `seatLimit: 999` or `title`.
5. **Seat Limit Bypass**: `update(/event_meta/current)` incrementing `confirmedCount` when `existing().confirmedCount >= existing().seatLimit`.
6. **Negative / Bulk Counter Tampering**: `update(/event_meta/current)` decrementing `confirmedCount` or incrementing by `+5`.
7. **Waitlist Self-Promotion**: Public `update(/rsvps/{phoneHash})` changing `isWaitlist` from `true` to `false`.
8. **Immutable Field Overwrite**: Public `update(/rsvps/{phoneHash})` modifying `createdAt` or `phone`.
9. **Orphaned Lock / Unatomic RSVP**: Creating `/rsvps/{phoneHash}` without creating `/rsvp_locks/{phoneHash}` in the same transaction/batch.
10. **ID Poisoning**: Creating `/rsvps/../../../etc/passwd` or a 1.5KB junk document ID.
11. **Value Poisoning / DoW**: Submitting a 50KB `paediatricianQuestion` or non-string `momName: 12345` or invalid phone `"abc"`.
12. **Client-Spoofed Timestamp**: Creating `/rsvps/{phoneHash}` with a forged `createdAt` not equal to `request.time`.
