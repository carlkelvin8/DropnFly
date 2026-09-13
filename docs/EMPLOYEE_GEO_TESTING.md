# Employee geolocation verification

Implemented: assigned employee map access from started task cards, continued booking-scoped GPS publishing on the map, customer call/chat overlay, Mapbox route instructions, external navigation fallback, clearer sequential arrival/completion controls, all-date admin task visibility, explicit staff/customer chat context, and no generic-location fallback for a booking without GPS pings.

## Deployment requirements

- Use HTTPS and allow phone location permissions.
- Set `NEXT_PUBLIC_MAPBOX_TOKEN` before building for in-app turn-by-turn directions. Without it, use Open Navigation; never treat the approximate map ETA as a measured road ETA.
- Keep the map foregrounded: the existing GPS publisher pauses when the document is hidden. External navigation may therefore pause browser GPS sharing.

## Manual acceptance tests (not yet executed)

1. Assign a booking, sign in as that employee, start its leg, and open View Map & Chat. Check that Back returns to employee Logistics.
2. Allow GPS on a phone. Confirm booking-scoped coordinates update in customer and admin maps. Block GPS and confirm the UI does not describe waiting GPS as connected.
3. Open chat on the employee map and send a message. In a separate customer session, reply. Confirm both identities and bubble alignment. Repeat with staff and customer cookies coexisting: the public chat must still require customer access and record the customer identity.
4. Verify an unassigned employee cannot access the task/chat via a guessed reference.
5. Verify an ongoing booking with an older check-in is visible under admin All dates. Confirm Today only deliberately filters it.
6. Arrive, then complete the leg. Confirm publishing stops and the task leaves the active list. Repeat completion in another tab while the map is open.
7. Check destination coordinates, road directions, route distance, and estimated travel time against the actual route. Do not claim measured location accuracy before a field test.

Automated verification: existing 16 tests pass, TypeScript passes, targeted lint passes, and production build passes. These checks do not replace the cross-account/phone tests above.
