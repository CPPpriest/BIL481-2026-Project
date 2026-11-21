# Y-10: Responsive layout and accessibility checks (NFR-07)

**Owner:** Yunus · **Date:** 21 Nov 2026 · **Build:** `feat/pa3-web-chat-ui` (PR #32) + the route-selector fix in this branch

## Setup

- `npm run dev -w @campus-orchestrator/web` on port 3002, fixture mode (`NEXT_PUBLIC_WEB_DATA_SOURCE=fixtures` in `apps/web/.env.local`).
- Browser: Chromium (built-in browser pane of the Claude desktop app) with viewport emulation. Values were read from the DOM (`getBoundingClientRect`, `scrollWidth`, `getComputedStyle`), not estimated from screenshots.
- Date of the run is a Saturday, so the menu card shows the weekend notice. That is expected.

## 1. Viewports (Chromium)

"No horizontal scroll" means `document.documentElement.scrollWidth <= innerWidth` and no element's right edge is past the viewport.

| Page | 375 × 812 | 768 × 1024 | 1440 × 900 | 1920 × 1080 |
|---|---|---|---|---|
| `/` Kampüs Özeti | PASS: one column, scrollWidth 375 | PASS: two columns (cards at x = 32 / 385, width 337), scrollWidth 753 | PASS: three columns (x = 144 / 528 / 912, width 368); all three cards end above the fold (bottoms 751 / 851 / 870 px < 900) | PASS: content stays centred at max 1200 px (cards at x = 392 / 776 / 1160), scrollWidth 1920 |
| `/giris` | PASS: scrollWidth 375, persona choices and button fit | PASS: scrollWidth 768 | PASS | PASS: scrollWidth 1916 |
| `/asistan` (logged in, one UC-04 answer) | PASS: scrollWidth 375; tool badges end at 241–275 px | PASS: scrollWidth 768; question bubble 220–715 px, answer 53–657 px, composer 33–735 px | PASS (screenshot checked) | PASS: scrollWidth 1917 |

On 375 px the header navigation wraps to its own row (`SiteHeader.module.css`, `max-width: 480px`), as designed.

## 2. Keyboard

| Check | Result |
|---|---|
| First Tab focuses the skip link "İçeriğe geç"; its target `#main-content` exists and has `tabindex="-1"` | PASS |
| Tab order on `/` (guest): skip link → brand → Kampüs Özeti → Asistan → Giriş yap → query input → Sor → 4 example questions → menu date input → Yenile → route buttons → … | PASS: follows the visual order |
| Every focused element shows a visible focus ring (`:focus-visible`, solid 2.4 px `rgb(47, 111, 224)`) | PASS: 15 of 15 stops checked |
| Login with the keyboard only: focus the selected persona, press Enter → redirected to `/asistan` | PASS |
| Chat composer: Shift+Enter adds a new line; Enter sends; the draft is cleared and focus stays in the text box | PASS |
| Route selector on the shuttle card | **FIXED**, see §4 |

## 3. Semantics and contrast

| Check | Result |
|---|---|
| `<html lang="tr">`, one `<main>`, page titles "Giriş · Kampüs Asistanı" etc. | PASS |
| Headings: one `h1` per page; the three cards are `h2` (Yemekhane Menüsü, Ring Seferleri, Kütüphane Doluluğu) | PASS |
| Every input, select, textarea and button has an accessible name (label, `aria-label` or text) | PASS: 0 unnamed controls on `/`, `/giris`, `/asistan` |
| Chat history is `role="log"` with `aria-live="polite"` and the label "Sohbet geçmişi"; the composer is a form labelled "Mesaj gönder", its text box is labelled "Mesajın" | PASS |
| Text contrast (WCAG AA: 4.5:1, 3:1 for large text), computed for every text node on `/` | PASS in light and dark scheme: 0 nodes below the limit |

## 4. Finding and fix

**Route selector (ShuttleCard).** The three route buttons were marked as `role="radiogroup"` / `role="radio"` with `aria-checked`. The ARIA radio pattern promises one Tab stop and arrow-key movement, which the buttons did not have: each button was its own Tab stop and the arrow keys did nothing. A screen reader user would be told to use arrows that do not work.

Fix in `apps/web/src/components/cards/ShuttleCard.tsx`: the container is now `role="group"` (label "Hat seçimi"), and each route is a normal toggle button with `aria-pressed`. Behaviour and look are unchanged; Tab and Enter/Space work as announced. Checked after the change: Ana Ring = `aria-pressed="true"`, Metro and Yurtlar = `"false"`. Web tests: 120 / 120 passed, `tsc --noEmit` clean.

## 5. Other browsers

| Browser | Who | Status |
|---|---|---|
| Chromium (Chrome / Edge engine) | Yunus | Done (this file) |
| Firefox (Windows) | Yunus | PASS, visual check only: pages looked at in narrow and wide windows, nothing broken. The full step list below was not run. |
| Safari (macOS) | Arda | Not run yet (NFR-07 names Safari, so a short visual check is still needed) |

Full step list (about 10 minutes, fixture mode is enough). For a quick visual check, steps 1–3 and 5 are enough:

1. Open `/`. Open the responsive design mode (Firefox: Ctrl+Shift+M; Safari: Develop → Enter Responsive Design Mode; enable the Develop menu in Settings → Advanced first).
2. At 375, 768 and 1440 px wide: no horizontal scroll bar; 1 / 2 / 3 card columns; at 1440 × 900 all three cards are visible without scrolling.
3. Repeat the width check on `/giris` and, after logging in, on `/asistan` with one question asked.
4. Reload `/` and press Tab: the first stop is "İçeriğe geç"; every stop shows a blue focus ring. In Safari, turn on Settings → Advanced → "Press Tab to highlight each item on a webpage" first.
5. On the shuttle card, switch between Ana Ring / Metro / Yurtlar with Tab + Enter: the departures change.
6. Change the menu date and the library floor; press "Yenile" on a card.
7. On `/asistan`: Shift+Enter makes a new line, Enter sends, "Durdur" appears while the answer streams.
8. Write the result (PASS / FAIL + a note or screenshot for any FAIL) into the table above.
