# Changelog — June 13, 2026

## Features Added

### 1. Export Reports (`/dashboard/reports`)
- CSV download for **Bookings** (reference, customer, status, price, dates)
- CSV download for **Revenue** (paid payments with customer & method)
- CSV download for **Analytics Summary** (total bookings, completed, cancelled, revenue, avg rating, customers)
- Optional date range filter for all reports
- Endpoints: `/api/reports/bookings`, `/api/reports/revenue`, `/api/reports/analytics`

### 2. Booking Extensions
- **Customer**: "Extend" button on booking detail → pick new date + reason → staff approves
- **Staff**: Extension requests card on booking detail with Approve/Reject buttons
- Auto-updates `checkOut` on the booking when approved
- Model: `BookingExtension` (bookingId, requestedCheckOut, reason, status[PENDING/APPROVED/REJECTED], reviewedBy, reviewedAt)
- Endpoints: `POST /api/bookings/[id]/extensions`, `PUT /api/extensions/[id]/review`

### 3. Customer Support Chat
- **Staff**: `/dashboard/chat` — list of bookings with messages, search by reference/customer
- **Staff**: `/dashboard/chat/[bookingId]` — chat room with send/reply via Enter key
- **Customer**: Inline chat panel on booking detail page (toggled via Chat button)
- Messages tracked as staff vs customer, auto-mark as read
- Model: `ChatMessage` (bookingId, senderId, customerId, message, isFromCustomer, isRead)
- Endpoints: `GET/POST /api/bookings/[id]/chat`, `GET/POST /api/customer/bookings/[id]/chat`

### 4. Ratings & Reviews
- **Customer**: 1-5 star rating + optional comment after booking is DELIVERED
- **Staff**: All reviews visible via `/api/reviews`
- One review per booking (unique constraint on bookingId)
- Model: `BookingReview` (bookingId, customerId, rating 1-5, comment)
- Endpoints: `GET/POST /api/bookings/[id]/review`, `GET /api/reviews`

### 5. Loyalty Points Program
- **Auto-earn**: 1 point per ₱10 spent, credited when booking status changes to DELIVERED
- **Redeem**: 100 points = ₱50 discount (redeem via `/api/loyalty/redeem`)
- **Customer**: `/my-account/loyalty` — points balance + transaction history
- **Customer Dashboard**: Points card with link to loyalty page
- **Staff**: `/dashboard/loyalty` — leaderboard by points, total points stats
- Model: `PointsTransaction` (customerId, points, type[EARNED/REDEEMED], reference, description)
- Endpoints: `GET /api/loyalty`, `GET /api/customer/loyalty`, `POST /api/loyalty/redeem`

### 6. Luggage Tagging (Per-Bag Tracking)
- **Staff**: "Add Bag" button on booking detail → auto-generates tag number (BAG-XXXXXX)
- Per-bag status tracking: Checked In → In Storage → Out for Delivery → Delivered
- Track physical location (shelf/bin) per bag
- Model: `LuggageItem` (bookingId, tagNumber[unique], description, status, location, checkInAt, checkOutAt)
- Endpoints: `GET/POST /api/bookings/[id]/luggage`, `PATCH /api/luggage/[id]`

### 7. Real-time Customer Tracking (Enhanced)
- Existing live map at `/track/map/[reference]` shows employee location with 5s polling
- Customer portal booking detail has Track + Live Map buttons
- Integrated into customer dashboard for logged-in users

## Database Migrations

| Migration | Tables Added |
|---|---|
| `20260613025633_add_extensions_chat_reviews` | BookingExtension, ChatMessage, BookingReview + ExtensionStatus enum |
| `20260613030653_add_loyalty_and_luggage` | PointsTransaction, LuggageItem + Customer.points column |

## Seed Data

| Data | Details |
|---|---|
| Booking Extensions | 1 approved (booking#1), 1 pending (booking#2) |
| Chat Messages | 3 messages between John Doe & staff on booking#1 |
| Booking Reviews | 5-star review on booking#1 |
| Luggage Items | 6 items across 3 bookings (various statuses) |
| Loyalty Points | John: 250pts (200 earned + 50 bonus), Jane: 100pts (welcome) |

## Stats

- Pages: 76 (was 65)
- Lint errors: 0
- API routes: ~55
- Database models: 17 (was 15)
- Enums: 6
