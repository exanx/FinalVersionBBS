# Implementation Plan — CPDV Default, Discrete Offline Indicator & PWA/Quote Studio Fixes

Biblia Sacra will be upgraded so that the Catholic Public Domain Version (CPDV) is the primary default translation across both active reading and the Offline Bible Storage cache manager. The intrusive top notification banner is replaced by a refined, non-distracting floating offline status badge anchored in the bottom-right corner with a fast shortcut to offline settings, the Quote Studio is decluttered by removing the inspiration chips, and the Service Worker precaching is repaired to prevent install failures.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed during interactive clarification and will guide the build:

- **Confirmed Decision 1**: The new offline mode indicator will be positioned in the **bottom-right corner** as a small, elegant floating icon badge that is completely hidden when internet connectivity is active.
- **Confirmed Decision 2**: When tapped (mobile) or hovered (desktop), the offline icon reveals a compact, glassmorphic popover displaying offline state details with a one-tap shortcut to **Open Offline Storage**.
- **Confirmed Decision 3**: The **CPDV** is configured as the default translation for all new sessions and initial storage caches, while existing users with stored custom preferences in local storage retain their chosen settings without data loss.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. Sets the Catholic Public Domain Version (CPDV, 73-book Catholic Canon) as the primary initial translation across all selectors, header displays, Quote Studio, and the Offline Storage downloader.
  2. Replaces the top-center connectivity banner with a subtle, non-intrusive floating indicator at the bottom-right that appears only when the device is disconnected and gracefully dismisses when reconnected.
  3. Repairs `sw.js` by correcting invalid asset references (such as nonexistent screenshot filenames) and resilient precaching so the Service Worker installs and caches app shells seamlessly.
  4. Removes the "Quick Scripture Inspiration" section and its random verse chips from the Quote Studio modal to provide a cleaner, focused verse creation workflow.
  5. Resolves translation fallback bugs and optimizes offline lookup handlers.

- **Target Audience / Persona**: Readers, students, and clergy who use Biblia Sacra for distraction-free liturgical and personal study on mobile, tablet, and desktop devices, including in low-connectivity or airplane mode environments.

- **Key Value**: Immediate, reliable offline access to the CPDV Catholic Bible without distracting banners or broken Service Worker installations.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **First-Time App Launch / Default Experience**:
   - The user opens Biblia Sacra. The app immediately presents the **Catholic Public Domain Version (CPDV)** in the top headers, sidebar selectors, and scripture display.
   - Opening **Settings > Offline Bible Storage** immediately preselects CPDV (73 Books) with its download button ready to cache all 73 books into IndexedDB.

2. **Offline Experience & Discrete Bottom-Right Indicator**:
   - When the user loses internet connection or switches to airplane mode, a quiet, amber/slate floating pill badge appears at `bottom-5 right-5` (above the bottom safe zone and out of the way of reading text).
   - Tapping or hovering the badge reveals a sleek mini-popover:
     - Clear status: *"Offline Mode — Reading from device cache"*
     - Action button: *"Manage Offline Storage"* (opens Settings directly scrolled to the offline caching manager).
   - When the device goes back online, the indicator momentarily shifts to emerald with a brief *"Back Online"* check before smoothly fading out.

3. **Streamlined Quote Studio**:
   - Opening Quote Studio presents the clean 2-column layout without the quick inspiration chips taking up vertical space above the Scripture passage selectors.
   - Verse selection (Book, Chapter, From, To) is immediately accessible and prominent, defaulting to CPDV for quotation rendering.

### Visual Identity & Theme Tokens

- **Positioning**: Fixed anchor `bottom-5 right-5` with `z-40`, high enough to avoid overlapping mobile thumb controls while remaining accessible.
- **Micro-Interaction**: Soft spring enter (`scale-95 opacity-0` $\rightarrow$ `scale-100 opacity-100`) via `transition-all duration-300`.
- **Surface**: Translucent frosted backdrop blur (`glass-panel backdrop-blur-xl bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300`).
- **Typography**: Retains the app's clean typography matching active theme tokens with `tabular-nums` for verse counts and book stats.

---

## 3. Key Product Decisions & Trade-Offs

- **CPDV Default Ordering**:
  - *Chosen Approach*: Move CPDV to the top of the translation list and make `'cpdv'` the default identifier across state initialization, DOM template options, header labels, and the offline downloader.
  - *Why*: Ensures consistent Catholic canon reading from first launch while keeping DRB and other translations fully accessible in the dropdown.
  - *Alternatives Considered*: Wiping existing user storage was rejected to prevent data loss of user highlights and notes.

- **Discrete Indicator vs. Top Banner**:
  - *Chosen Approach*: Replace the `top-14` banner with a floating bottom-right icon button + status popover.
  - *Why*: The previous banner occluded the top chapter title and reader controls. The bottom-right floating icon complies with mobile thumb ergonomics and anti-slop guidelines without obscuring sacred text.

- **Service Worker Asset Manifest Audit**:
  - *Chosen Approach*: Fix broken asset URLs in `sw.js` (correcting `screenshot-mobile-theme2.png` to the existing `screenshot-mobile-theme1.png` and wrapping precache calls with resilient fallbacks).
  - *Why*: A single 404 in `cache.addAll()` causes the entire service worker installation to abort, breaking offline support for the entire PWA.

---

## 4. Technical Architecture & Data Strategy

### System Flow & Connectivity Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                      Browser / PWA Runtime                      │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
       [Network Online/Offline]        [User Action / Read]
                 │                               │
        ┌────────┴────────┐                      ▼
        │                 │            [Translation Engine]
 [online event]    [offline event]     (Default: 'cpdv')
        │                 │                      │
        ▼                 ▼              ┌───────┴───────┐
  [Fade Out &      [Show Floating        ▼               ▼
   Dismiss]         Bottom-Right]   [Local IndexedDB] [Remote API]
                          │         (73 Books CPDV)   (Fallback)
                          ▼
                  [Mini-Popover &
                   Offline Storage
                      Shortcut]
```

### Component & Event Wiring

1. **State Initialization (`app.js`)**:
   - Initial translation key set to `'cpdv'` (with `'Catholic Public Domain Version'` as display name).
   - `loadDataFromLocalDB()` falls back to `'cpdv'` if no existing settings exist.
   - `updateTranslationDropdowns()` and `updateOfflineSectionUI()` place CPDV first and preselect it.

2. **Offline Floating Indicator Component (`index.html` + `app.js`)**:
   - Element `#offline-floating-indicator`:
     - Inner icon: Wi-Fi with slash / cloud-offline SVG.
     - Pulsing amber status point.
     - Popover card `#offline-status-popover` containing status text and a direct button triggering `openSettingsModal()` with smooth scroll to `#offline-cache-section`.
   - Event listeners for `window.online` and `window.offline` toggle visibility and animate transitions smoothly.

3. **Service Worker (`sw.js`)**:
   - Update `CORE_ASSETS` array to remove missing files and include all verified static assets.
   - Increment `CACHE_VERSION` to ensure all clients receive the updated service worker and cache manifest.
   - Provide safe fallback for individual asset caching during `install`.

4. **Quote Studio Cleanup**:
   - Remove HTML element `#quote-inspiration-chips` and container from `index.html`.
   - Remove `renderRandomQuoteInspirationChips` execution from `openQuoteModal` in `app.js`.
