# ShiftPe — Product Requirements Document

## Vision
A Tinder/Hinge-style swipe-to-match mobile app that connects **students looking for part-time gigs** with **small shop owners who need short-term help** (a few hours, a few days, or contract).

## MVP Scope (this build)

### Authentication
- **Phone OTP** (mocked — magic code `123456` for any number; ready to swap with Twilio/MSG91 later).
- **Emergent-managed Google OAuth** (live) — primary path on web; mobile uses `openAuthSessionAsync` + secure store token storage.

### Onboarding
- Role selection: **Student** or **Shop Owner**.
- Profile setup form tailored to role:
  - **Student**: name, age, gender, city, photo, qualification, experience, multi-select skills, available hours, expected pay (₹/hr), bio.
  - **Shop owner**: shop name, name, age, gender, city, photo, help needed, duration, no. of days, pay offered, required gender, required qualification, required experience, message, bio.
- **AI bio suggest** powered by Emergent LLM key + Claude Sonnet 4.6.

### Swipe deck
- Reanimated + Gesture Handler card stack.
- Edge-to-edge photo with dark scrim, name/role/pay/city chips.
- Scrollable details (bio, skills/help-needed, schedule, message).
- Pass / Like FABs + drag gestures (heavy haptic on like, medium on pass).
- Deck excludes already-swiped + own profile, returns opposite role.

### Matching
- Mutual right-swipe creates a `match` document and routes both users to an "It's a Match!" celebration screen.

### Matches & Real-time Chat
- Matches tab: horizontal "new matches" row + vertical chat list with last message preview.
- 1-on-1 chat screen with WebSocket-based real-time messages (`/api/ws/chat/{match_id}?token=...`) + REST fallback.

### AI features
- `/api/ai/bio-suggestion` — Claude generates short authentic bios from role + skills + qualification.
- `/api/ai/match-recommendations` — Claude re-ranks the deck based on the user's own profile.

### Seed data
- 6 sample students + 6 sample shop owners (Indian-context names, Unsplash photos) auto-seeded so the deck is never empty.

## Tech Stack
- **Frontend**: Expo SDK 54, expo-router, Reanimated, Gesture Handler, expo-image-picker, expo-haptics, expo-blur, expo-linear-gradient, expo-secure-store.
- **Backend**: FastAPI, motor (MongoDB), httpx, emergentintegrations (Claude Sonnet 4.6), starlette WebSockets.
- **DB**: MongoDB collections — `users`, `user_sessions`, `profiles`, `swipes`, `matches`, `messages`, `phone_otps`.

## Out of scope (future)
- Real SMS provider for phone OTP.
- Multi-photo carousel, location-based filters, push notifications.
- Payment escrow once a shift is confirmed.
- Verification badges (ID/Aadhaar) for trust.
- Reviews & ratings post-shift.

## Smart business enhancement (next obvious revenue)
Charge shop owners a small fee (₹49–₹99) per confirmed hire (post-chat handshake) — Stripe/Razorpay integration with a "confirm hire" CTA in chat.
