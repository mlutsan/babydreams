# G-Finance Implementation Plan

## Architecture Overview
- **Frontend**: TanStack Router + React Query + Tailwind + Shadcn UI
- **Backend**: TanStack Start server functions (compile to Cloudflare-compatible endpoints)
- **Google Sheets**: Client-side GSI OAuth2 tokens passed to server functions for API calls
- **Token Storage**: Jotai atoms with localStorage (client-side, 1-hour expiry)
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

## Phase 2: Google Sheets Integration - OAuth Flow ✅ COMPLETE
**Goal**: Set up OAuth and connect to user's Google Sheet

**Implementation** (Completed):
- ✅ Created `useGoogleAuth` hook with Google Identity Services (GSI)
  - Single-roundtrip auth: sign-in + Sheets API access in one flow
  - Returns: `authState`, `user`, `requestSheetsAccess()`, `renderButton()`, `logout()`
  - Auto-requests Sheets access after sign-in for seamless UX
- ✅ Created Settings page (`src/routes/settings.tsx`):
  - Account card showing Google profile (name, email, picture)
  - Sign Out button
  - Google Sheet URL input
  - "Save & Test Connection" button with metadata validation
- ✅ Jotai atoms for state management (`src/lib/atoms.ts`):
  - `authStateAtom`: "signed-out" | "signed-in" | "error"
  - `googleUserAtom`: name, email, picture
  - `googleTokenAtom`: accessToken, expiresAt (1-hour expiry)
  - `sheetUrlAtom`: persistent sheet URL
  - Helper: `getValidAccessToken()` with expiration checking
- ✅ Created `GoogleSheetsClient` class (`src/lib/google-sheets.ts`):
  - Methods: `getSpreadsheetMetadata()`, `getValues()`, `appendValues()`, `updateValues()`, `clearValues()`
  - Accepts access token directly from GSI
- ✅ Server function for validation (`src/server/auth.ts`):
  - `getMetadata`: Fetches sheet metadata to verify access
  - `checkGoogleAuthStatus`: Validates access token
  - `verifyAccessToken`: Helper for token verification
- ✅ Toast notifications using Sonner for user feedback
- ✅ Root layout integration with `GoogleSignInButton` component

**Testable outcome**: Can sign in with Google, connect to sheet, see profile, validate sheet access, sign out

---

## Phase 3: Manual Expense Saving
**Goal**: Save manually entered expenses to Google Sheets

**Tasks**:
- Create `src/server/expenses.ts` with TanStack Start server functions
- Implement `createExpense` server function:
  - Input validator for: `{ amount, date, category, description, authorName, accessToken, sheetUrl }`
  - Server-side validation:
    - Required: amount, date, category, description, authorName
    - Amount must be > 0
    - Date must be valid ISO string
    - Category must not be empty
  - Verify access token
  - Extract spreadsheet ID from sheetUrl
  - Create GoogleSheetsClient instance
  - Use `appendValues("Expenses!A:E", [[date, amount, category, description, authorName]])`
  - Return `{ success: true, rowIndex: number }` or error
- Update expense form UI:
  - Get authorName from `googleUserAtom` (Jotai)
  - Get accessToken from `googleTokenAtom` using `getValidAccessToken()`
  - Get sheetUrl from `sheetUrlAtom`
  - Add form validation (client-side)
  - Disable form during submission
  - Add loading spinner on submit button
- Implement "Save" button:
  - Call `createExpense` with form data + tokens
  - Show success toast with expense details
  - Clear form after success
  - Show error toast on failure
- Implement "Save & Add Another" button:
  - Same as "Save" but keeps form enabled
  - Optionally keep category/description for quick entries
- Handle edge cases:
  - Token expired: show message to re-authenticate
  - Sheet not found: create it and retry
  - Network errors: show retry option
- Implement `getCategories` server function (LATER):
  - Input: `{ accessToken: string, sheetUrl: string }`
  - Validate access token using `verifyAccessToken()`
  - Use `GoogleSheetsClient.getValues("Settings!A:A")` to fetch categories
  - Parse and return array of category strings
  - Error handling for missing "Settings" sheet
- Update Category selector component:
  - Fetch categories on mount using `getCategories`
  - Add loading state and error handling
  - Fallback to default categories if fetch fails

**Google Sheet Schema**:
- **Expenses Sheet**: Columns A-E
  - A: Date (YYYY-MM-DD)
  - B: Category (string)
  - C: Amount (number)
  - D: Description (string)
  - E: Author (string, from Google profile)
- **Settings Sheet**: Column A
  - A: Categories (one per row, starting A2)

**Server Function Pattern**:
```typescript
export const createExpense = createServerFn({ method: "POST" })
  .inputValidator((data: ExpenseInput) => {
    // Validation logic
    return data;
  })
  .handler(async ({ data }) => {
    await verifyAccessToken(data.accessToken);
    const spreadsheetId = extractSpreadsheetId(data.sheetUrl);
    const client = new GoogleSheetsClient(data.accessToken, spreadsheetId);

    const result = await client.appendValues("Expenses!A:E", [[
      data.date,
      data.amount,
      data.category,
      data.description,
      data.authorName,
    ]]);

    return { success: true };
  });
```

**Testable outcome**: Can manually add expenses, see them appear in Google Sheet immediately, categories load from sheet

---

## Phase 4: Expense History Page
**Goal**: View, edit, and delete recent expenses

**Tasks**:
- Create History page component (`src/routes/history.tsx`)
- Implement `getExpenses` server function in `src/server/expenses.ts`:
  - Input: `{ accessToken, sheetUrl, since?: string }`
  - Default `since` to 2 weeks ago if not provided
  - Use `GoogleSheetsClient.getValues("Expenses!A:E")` to fetch all expenses
  - Parse rows into expense objects with structure: `{ date, amount, category, description, author, rowIndex }`
  - Filter by `date >= since`
  - Sort by date descending (most recent first)
  - Return array of expense objects
- Fetch expenses on page load:
  - Use `getExpenses` with last 2 weeks
  - Store in React Query for caching
  - Add pull-to-refresh functionality
- Display expenses in a card/list format:
  - Show: date, amount, category, description, author
  - Group by date for better readability
  - Add loading skeletons during fetch
  - Empty state when no expenses found
- Implement `updateExpense` server function:
  - Input: `{ rowIndex, date, amount, category, description, authorName, accessToken, sheetUrl }`
  - Server-side validation (same as create)
  - Use `GoogleSheetsClient.updateValues("Expenses!A{rowIndex}:E{rowIndex}", [[...]])`
  - Return success/error
- Implement inline edit functionality:
  - Click expense card to enter edit mode
  - Show editable form fields inline
  - "Save" and "Cancel" buttons
  - Call `updateExpense` on save
  - Optimistic updates with React Query
  - Toast notification on success/error
- Implement `deleteExpense` server function:
  - Input: `{ rowIndex, accessToken, sheetUrl }`
  - Use `GoogleSheetsClient.clearValues("Expenses!A{rowIndex}:E{rowIndex}")`
  - Alternatively: shift rows up (more complex but cleaner)
  - Return success/error
- Implement delete functionality:
  - Swipe-to-delete gesture (mobile-friendly)
  - Or delete button on each card
  - Confirmation dialog before deletion
  - Call `deleteExpense` on confirm
  - Remove from UI immediately (optimistic update)
  - Toast notification on success/error
- Add error handling:
  - Token expired: prompt to re-authenticate
  - Network errors: show retry button
  - Sheet not found: redirect to settings
- Add filters/search (optional):
  - Filter by category
  - Search by description
  - Date range picker

**Testable outcome**: Can view recent expenses, edit amounts/descriptions inline, delete expenses with confirmation

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
**Goal**: Deploy to Cloudflare Pages with TanStack Start

**Tasks**:
- Create `.env.example` with required variables:
  - `VITE_GOOGLE_CLIENT_ID` (client-side, for GSI)
  - `ANTHROPIC_API_KEY` (server-side only)
  - `OPENAI_API_KEY` (server-side only)
  - Note: No `GOOGLE_CLIENT_SECRET` needed with GSI approach
- Update `package.json` build script if needed for TanStack Start
- Note: TanStack Start server functions automatically compile to Cloudflare Workers-compatible format
- Configure Cloudflare Pages:
  - Build command: `npm run build`
  - Output directory: `.vinxi/output`
  - Node version: 18+
- Set up environment variables in Cloudflare Pages dashboard:
  - `VITE_GOOGLE_CLIENT_ID` for client build
  - `ANTHROPIC_API_KEY` for server functions
  - `OPENAI_API_KEY` for server functions
- Update Google Cloud Console:
  - Add production URLs to authorized JavaScript origins
  - Add production redirect URIs for GSI
- Test in production:
  - GSI authentication flow (sign-in + Sheets access)
  - Token expiration and renewal
  - Google Sheets CRUD operations
  - AI processing (Phases 5-6)
- Performance optimization:
  - Enable Cloudflare caching for static assets
  - Monitor serverless function cold starts
  - Set up error tracking (Sentry or similar)
- Set up custom domain (optional):
  - Configure DNS in Cloudflare
  - Enable SSL/TLS

**Deployment Notes**:
- TanStack Start builds to static assets + server functions
- Server functions become Cloudflare Workers automatically
- No need for separate `/functions` directory
- Environment variables are split: `VITE_*` for client, others for server

**Testable outcome**: App is live on Cloudflare Pages, fully functional with auth, Sheets integration, and AI processing working

---

## Technical Decisions to Note:
1. **OAuth & Tokens**: Google Identity Services (GSI) for client-side authentication. Access tokens stored in Jotai atoms with localStorage (1-hour expiry). Tokens passed to TanStack Start server functions for Google Sheets API calls. Server functions compile to Cloudflare Workers-compatible endpoints.
2. **Server Functions**: TanStack Start `createServerFn()` pattern for all backend operations (CRUD, AI processing). Automatically become Cloudflare Workers on deployment.
3. **AI Provider**: Anthropic Claude for image/text → structured data (excellent structured output)
4. **Voice**: OpenAI Whisper (transcription) → Claude (extraction)
5. **Image Handling**: Client-side compression → backend AI processing
6. **State Management**: Jotai for auth/config state (with localStorage persistence), React Query for server data caching
7. **Error Handling**: Graceful degradation, clear user feedback throughout with toast notifications (Sonner)

---

## Current Status
- **Current Phase**: Phase 3 - Manual Expense Saving (In Progress)
- **Phase 1**: ✅ Complete - Basic UI with shadcn/ui, routing, responsive layout
- **Phase 2**: ✅ Complete - GSI integration, useGoogleAuth hook, settings page, logout functionality
- **Started**: 2025-10-12
- **Last Updated**: 2025-10-18

Each phase builds on the previous one and delivers testable functionality!
