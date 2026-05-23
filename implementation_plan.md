# Full Stack End-to-End Review & Fix Plan

## Goal
Make the entire user flow seamless — Google OAuth sign-in → MongoDB user creation → notebook creation → document ingestion → AI chat — with no broken routes, no auth failures, and no type mismatches. Stripe excluded.

---

## Critical Bugs Found (Will 100% Break at Runtime)

> [!CAUTION]
> These issues mean the app **cannot work at all** in its current state. Every single API call from the frontend will fail with 401 Unauthorized, and the login flow will crash on redirect.

### Bug 1 — `makeHttpReq.ts` sends NO Authorization header
The backend's `requireAuth` middleware reads `Authorization: Bearer <token>` from request headers. The frontend's `makeHttpReq.ts` sends `credentials: "include"` (cookie-based) but **never attaches the JWT token as a header**. This means **every single protected API call returns 401**.

**Fix:** Update `makeHttpReq.ts` to read `accessToken` from `localStorage` and attach it as `Authorization: Bearer <token>`.

---

### Bug 2 — `GET /api/v1/auth/me` route is MISSING
After Google OAuth, the backend redirects the user to `frontendUrl?accessToken=...&refreshToken=...`. The `AuthCallbackPage.tsx` ignores these URL params entirely and immediately calls `getAuthUserData()` → `GET /api/v1/auth/me`. This route **does not exist** in the backend. The page will crash and the user never gets stored in `localStorage`.

**Fix:** 
- Add `GET /api/v1/auth/me` backend route — uses `requireAuth` + returns user data.
- Update `AuthCallbackPage.tsx` to first read `accessToken`/`refreshToken` from URL params, store them in `localStorage`, then call `getAuthUserData()` (which will now have the token to send).

---

### Bug 3 — `GET /api/v1/logout` route is MISSING
The frontend's `logoutUser()` calls `GET /api/v1/logout`. This route doesn't exist. Logout silently fails and localStorage is cleared anyway, which is partially OK, but it's broken.

**Fix:** Add `GET /api/v1/logout` route to the backend.

---

### Bug 4 — Express route conflict: `/notes/source/results` shadowed by `/notes/:noteId`
In `notesRoutes.ts`, the routes are registered in this order:
```
router.get("/notes/:noteId", ...)       ← registered FIRST
router.get("/notes/source/results", ...)  ← registered AFTER
```
Express matches routes in order. `/notes/source/results` will **never be reached** because Express will match `source` as the `:noteId` param and call `getNoteById`. The frontend's `getSourceResults()` will always get a 404.

**Fix:** Move all specific static routes **above** parameterized routes in `notesRoutes.ts`.

---

### Bug 5 — `qa-overdoc.ts` imports non-existent `./prompt` module
After fixing the `.ts` extension issue, `qa-overdoc.ts` still imports `from "./prompt"`. The file in the repo is at `@/prompts/prompts.ts`, not `./prompt`. This will crash the backend on startup.

**Fix:** Update import to `from "@/prompts/prompts"` (already done for prompts but `response_generator_promt` is imported from `"./prompt"` which doesn't exist locally in the pipeline folder).

---

### Bug 6 — `getAllNotes` ignores `page` and `search` params
Frontend calls `GET /api/v1/notes?page=1&search=...` and expects back `{ notes, pagination }`. Backend returns only `{ notes }` without pagination metadata. The Redux store expects `pagination` too.

**Fix:** Update `getAllNotes.ts` to handle `page` and `search` query params and return `{ notes, pagination: { totalPages, currentPage, total } }`.

---

### Bug 7 — `createMindMap` has a TypeScript error in `notes.ts` (frontend)
```ts
export const createMindMap = async (noteId?: string, docIds: string[]) => {
```
A required parameter (`docIds`) cannot follow an optional parameter (`noteId?`). This is a compile error that will prevent the frontend from building.

**Fix:** Change to `(noteId: string | undefined, docIds: string[])`.

---

## Proposed Changes

### Component 1 — Backend: Auth Routes

#### [NEW] `src/app/http/controllers/auth/authController.ts`
- `getMe`: protected by `requireAuth`, returns `req.user` data + new JWT tokens.
- `logout`: clears server session, returns success message.

#### [NEW] `src/app/http/controllers/auth/routes/authRoutes.ts`
```
GET /api/v1/auth/me   → requireAuth → getMe
GET /api/v1/logout    → logout
```

#### [MODIFY] `src/routes/apiV1.ts`
Import and call `authRoutes(router)`.

---

### Component 2 — Backend: Fix Route Ordering

#### [MODIFY] `src/app/http/controllers/notes/routes/notesRoutes.ts`
Re-order routes: all static-path routes (`/notes/source/results`, `/notes/search/web`, `/notes/docs/overview`) must come **before** `/notes/:noteId`.

---

### Component 3 — Backend: Fix `qa-overdoc.ts` import

#### [MODIFY] `src/app/pipeline/qa-overdoc.ts`
Change `from "./prompt"` → `from "@/prompts/prompts"`.

---

### Component 4 — Backend: Fix `getAllNotes` Pagination

#### [MODIFY] `src/app/http/controllers/notes/getAllNotes.ts`
Add `page`, `search`, `limit` query param handling. Return:
```json
{ "notes": [...], "pagination": { "total": 10, "totalPages": 2, "currentPage": 1 } }
```

#### [MODIFY] `src/app/http/controllers/notes/repository/Notesrepository.ts`
Add `findByUserPaginated(userId, { page, search, limit })` method.

---

### Component 5 — Frontend: Fix Auth Flow

#### [MODIFY] `src/pages/auth/AuthCallbackPage.tsx`
1. On mount, read `?accessToken=...&refreshToken=...` from `window.location.search`.
2. Store both in `localStorage` immediately.
3. Then call `getAuthUserData()` to fetch and store the full user profile.

#### [MODIFY] `src/helper/makeHttpReq.ts`
Read `accessToken` from `localStorage` and add `Authorization: Bearer <token>` to every request header.

---

### Component 6 — Frontend: Fix TypeScript Error

#### [MODIFY] `src/api/notes.ts`
Fix `createMindMap(noteId?: string, docIds: string[])` → `createMindMap(noteId: string | undefined, docIds: string[])`.

---

## Verification Plan

### After implementation:
1. Kill the server and run `npx tsc --noEmit` — should have zero errors.
2. Run `npm run dev` — server should start cleanly.
3. Hit `GET /` — should respond `{ message: "express server is up" }`.
4. Go to `http://localhost:5173` → click Sign in with Google → complete OAuth → should redirect to `/notes` with user stored in localStorage.
5. Create a blank notebook → should create a `Note` in MongoDB.
6. Add a web link source → should scrape + store as a `Doc` in MongoDB.
7. Open the note → send a chat message → should get an AI response via the RAG pipeline.
