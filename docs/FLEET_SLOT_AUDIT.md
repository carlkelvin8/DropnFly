# Fleet hourly booking capacity audit

Date: September 13, 2026

## Business rules implemented

- Capacity is the sum of positive whole-number vehicle quantities registered in Settings → Fleet (`fleet_data`). Employee profile vehicles are not an additional independent pool.
- Two vehicles permit two concurrent logistics movements; after the second reservation, the slot is FULL for a third request. Three vehicles permit a third reservation.
- Pick-ups and drop-offs compete for the same fleet. Storage between those movements does not occupy a vehicle continuously.
- Scheduling intervals and reserved movement duration are fixed at 60 minutes, anchored to operating start. Midnight-ending slots are included for 24-hour operation.
- Empty, absent or malformed fleet data produces zero capacity, not legacy fallback capacity.
- Pending/confirmed/active bookings reserve capacity. Cancelled, no-show and delivered bookings release it.
- Full slots cannot become the selected booking time. Clicking one explains FULL and offers up to two nearest available slots; equal-distance alternatives prefer the earlier time. Past or closed slots are not recommended.
- Capacity increases after fleet registration is saved. Availability responses are uncached; the public picker refreshes every 30 seconds. Submission checks fresh fleet data inside the booking transaction.

## Audit findings and fixes

| Finding | Resolution |
| --- | --- |
| Empty fleet silently used legacy concurrency | Removed fallback; zero vehicles means zero reservations |
| Configurable phase durations broke hourly example | Picker and booking APIs use a shared 60-minute constant; settings show fixed duration |
| Forged off-grid timestamps could bypass picker | Creation and schedule edits reject timestamps outside the generated hourly grid, including nonzero seconds |
| No-shows continued consuming slots | Excluded from availability and reservation checks |
| Customer had no nearest available suggestions | Added FULL interaction with nearest selectable alternatives and optional API `time` query |
| Stale date responses could replace current picker data | Aborted outdated pickup/delivery requests |
| Final submission could conflict with a newly full slot | Conflict returns customer to scheduling and refreshes slots immediately |
| Admin schedule edits bypassed fleet checks | Added transaction-scoped shared day locks and capacity checks, excluding the edited booking |
| Extension approval could overfill delivery slots | Extension and checkout update now commit together only after capacity validation |
| Prior-day legacy movements crossing midnight were invisible | Availability/creation include a preceding-hour window with day-relative coordinates |
| Malformed fleet quantities could affect capacity | Fleet settings reject non-positive/non-integer quantities and invalid JSON |

## Concurrency design

Public and staff creation acquire PostgreSQL transaction advisory locks keyed by Manila calendar date (`fleet-slot:YYYY-MM-DD`), in sorted order. Counts are queried after acquiring locks; the booking is inserted before releasing them. Schedule changes and extension approvals use the same lock namespace. This prevents two booking requests using the supported APIs from both claiming the final vehicle slot.

Availability is a preview, never a reservation. A customer who leaves a slot selected while another customer books it can receive HTTP 409 at submission. They must select another time; the system does not silently change their booking.

## Verification and release testing

Production build, TypeScript and targeted API/helper/picker lint checks pass (two pre-existing unused-variable warnings in the staff booking route). The automated library suite passes 16 tests, including capacity 2→3, exact adjacency, shared movements, midnight overlap, alternative ordering, zero fleet, off-grid schedule rejection, self-exclusion, and lock-key acquisition. Schedule tests use mocked database calls, not live PostgreSQL reservation traffic.

Before production sign-off, run these staging tests against an isolated test database:

1. Save two fleet units. Reserve the same future 20:00 slot twice; a third reservation must receive 409. Confirm no third booking record exists.
2. Submit three simultaneous public/staff requests into an empty two-vehicle slot. Exactly two should commit.
3. Save a third vehicle; confirm slot capacity becomes three and the next reservation succeeds.
4. Attempt a full-slot schedule edit/extension approval. Confirm neither the booking schedule nor extension approval changes.
5. Compare pickup and delivery occupation of the same slot; verify they share capacity.
6. Verify customer FULL selection offers 19:00/21:00 where available; check closed days, past times and midnight.

No live customer bookings or notification emails were created during this audit. Authenticated UI click-through and live concurrent database requests remain staging verification steps, not claimed as completed tests.

## Operational notes

- Register and save Fleet inventory before rollout; deployments previously relying only on legacy concurrency settings will now show zero capacity.
- Existing reservations are preserved when the fleet is reduced; over-capacity slots remain FULL for new requests rather than cancelling customers automatically.
- Existing off-grid reservations remain counted conservatively; new reservations must follow the hourly grid.
- Only supported application APIs are covered. Direct database writes/imports must apply equivalent checks.
