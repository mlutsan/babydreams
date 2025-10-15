# G-Finance Implementation Plan

## Architecture Overview
- **Frontend**: TanStack Router + React Query + Tailwind + Shadcn UI
- **Backend**: Cloudflare Pages Functions (API routes in `/functions` directory)
- **Google Sheets**: Direct API calls with OAuth2 (backend flow to keep secrets secure)
- **AI Processing**: Anthropic Claude + OpenAI Whisper via backend API

---

## Phase 1: Project Setup & Basic UI
**Goal**: Set up shadcn/ui, create basic expense entry form with manual data entry only

**Tasks**:
- Install and configure shadcn/ui components
- Create new file-based routing structure (replace example routes)
- Build main expense entry page with form fields:
  - Amount (number input)
  - Date picker (default: today)
  - Category selector (hardcoded options initially)
  - Description (textarea)
- Add basic form validation
- Create simple navigation layout with tabs (Add Expense / History)
- Create a Settings page: a gear button on top
- Add mobile-first responsive styling with top navbar, project title and settings

**Testable outcome**: Can navigate between pages, see responsive form, client-side validation works

---

## Phase 2: Google Sheets Integration - OAuth Flow
**Goal**: Set up OAuth and connect to user's Google Sheet

**Tasks**:
- Create Settings page with:
  - User name input
  - Google Sheet URL input
  - "Connect to Google" button
- Set up Cloudflare Pages Functions structure (`/functions` directory)
- Create backend OAuth endpoints:
  - `/api/auth/google/authorize` - initiate OAuth
  - `/api/auth/google/callback` - handle callback
  - `/api/auth/google/status` - check auth status
- Store OAuth tokens securely (consider Cloudflare KV or encrypted localStorage with short-lived tokens)
- Create Google Sheets API client utility
- Test connection by fetching sheet metadata

**Testable outcome**: Can connect to Google account, see confirmation of successful sheet access

---

## Phase 3: Manual Expense Saving
**Goal**: Save manually entered expenses to Google Sheets

**Tasks**:
- Fetch categories from Google Sheet "Settings" sheet, "Categories" column
- Update Category selector to use real categories from sheet
- Create backend API endpoint: `POST /api/expenses/create`
- Implement expense creation logic:
  - Validate data
  - Format according to schema: Date | Amount | Category | Description | Author
  - Append to "Expenses" sheet
- Add loading states and success/error messages
- Implement "Save" button functionality
- Implement "Add more" button (saves + resets form)

**Testable outcome**: Can manually add expenses, see them appear in Google Sheet immediately

---

## Phase 4: Expense History Page
**Goal**: View, edit, and delete recent expenses

**Tasks**:
- Create History page component
- Create backend API endpoint: `GET /api/expenses/list?since=YYYY-MM-DD`
- Fetch last 2 weeks of expenses on page load
- Display expenses in a list/table format
- Implement inline edit functionality
- Implement delete functionality with confirmation
- Add backend endpoints:
  - `PUT /api/expenses/update`
  - `DELETE /api/expenses/delete`
- Add loading skeletons and error handling

**Testable outcome**: Can view recent expenses, edit amounts/descriptions, delete expenses

---

## Phase 5: Image Processing
**Goal**: Upload receipt photos, extract expense data via AI

**Tasks**:
- Add image upload component with camera/gallery options (optimized for mobile)
- Add image preview and compression (keep under 1MB)
- Create backend API endpoint: `POST /api/ai/process-image`
- Integrate Anthropic Claude (using structured output):
  - Extract: amount, date, description, potential category
  - Handle multiple items on single receipt
- Return extracted data to frontend
- Pre-fill form with extracted data
- If multiple expenses detected:
  - Create tabs/pagination UI for multiple entries
  - Allow navigation between entries
- Add manual correction flow before saving
- Handle errors gracefully (bad image, no data found, etc.)

**Testable outcome**: Can take photo of receipt, see extracted data populate form, edit if needed, save to sheet

---

## Phase 6: Voice Memo Processing
**Goal**: Record voice expense descriptions, extract data via AI

**Tasks**:
- Add voice recording component (browser MediaRecorder API)
- Add recording UI with visual feedback
- Implement audio file compression
- Create backend API endpoint: `POST /api/ai/process-voice`
- Integrate OpenAI Whisper for transcription
- Feed transcription to Claude for structured extraction:
  - Extract: amount, date, category, description
  - Handle natural language ("spent twenty dollars on groceries")
- Pre-fill form with extracted data
- Allow manual correction before saving

**Testable outcome**: Can record voice memo, see transcription, see extracted expense data, save to sheet

---

## Phase 7: PWA Features & Polish
**Goal**: Enable "Add to Home Screen" and optimize mobile experience

**Tasks**:
- Create `manifest.json` with app metadata, icons
- Add required meta tags for iOS/Android PWA support
- Generate app icons (multiple sizes)
- Add splash screens for iOS
- Optimize loading performance:
  - Code splitting
  - Image lazy loading
  - Preload critical resources
- Add offline detection and user feedback
- Implement proper error boundaries
- Add loading states throughout
- Polish UI/UX:
  - Touch-friendly tap targets
  - Smooth transitions
  - Haptic feedback (where supported)
  - Pull-to-refresh on History page

**Testable outcome**: Can add app to home screen, launches like native app, performs well on mobile

---

## Phase 8: Environment Setup & Deployment
**Goal**: Deploy to Cloudflare Pages with Workers

**Tasks**:
- Create `.env.example` with required variables:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `ANTHROPIC_API_KEY`
  - `OPENAI_API_KEY`
- Set up `wrangler.toml` for Cloudflare Pages
- Configure build settings for Pages deployment
- Set up environment variables in Cloudflare dashboard
- Test full OAuth flow in production
- Test AI processing in production
- Add proper CORS configuration
- Set up custom domain (if needed)

**Testable outcome**: App is live, fully functional on Cloudflare Pages with all features working

---

## Technical Decisions to Note:
1. **OAuth Tokens**: Backend flow with tokens stored in HTTP-only cookies for security
2. **AI Provider**: Anthropic Claude for image/text → structured data (excellent structured output)
3. **Voice**: OpenAI Whisper (transcription) → Claude (extraction)
4. **Image Handling**: Client-side compression → backend AI processing
5. **State Management**: React Query for server state, local state for UI
6. **Error Handling**: Graceful degradation, clear user feedback throughout

---

## Current Status
- **Current Phase**: Phase 1 - Project Setup & Basic UI
- **Started**: 2025-10-12

Each phase builds on the previous one and delivers testable functionality!
