# BuildFlow V2 Design System (foundation)

**Status:** this file did not exist when V2 implementation started; it records the tokens and components the foundation actually ships, so later screens build on the same parts. Visual redesign is out of scope (`UX_ARCHITECTURE_V2.md` covers flows, not styling).
**Source of truth:** `tailwind.config.ts` (tokens) and `src/components/ui/*` (components). If this document and the code disagree, the code wins and this document is wrong.

---

## 1. Principles

1. **Readable outdoors, one-handed.** Text contrast meets WCAG AA (4.5:1 body, 3:1 large). Touch targets are at least 44 px (`min-h-11`).
2. **One primary action per screen** (`UX_ARCHITECTURE_V2.md` §4). Everything else is secondary (outline/ghost) or in an overflow.
3. **Every state is designed:** loading, empty, error and offline all have a component; no screen is ever blank.
4. **Brand orange is for emphasis, not for text on white.** See §2.

---

## 2. Colour tokens

| Token | Value | Use | Contrast |
|---|---|---|---|
| `action` | `#c2410c` | Primary buttons, active tab, badges with white text, brand wordmark on light backgrounds | White on it 5.2:1 (AA) |
| `action-hover` / `action-active` | `#a8420d` / `#8a360b` | Hover and pressed states | higher |
| `safety-500` | `#f26b1d` | Decoration only: icons, progress bars, dots, logo mark | White on it 3.04:1: **never use for text** |
| `safety-400` | `#ff8a3d` | Accents on dark (`ink`) backgrounds | High on ink |
| `safety-50/100` | tints | Highlight backgrounds (attention cards, icon wells) | n/a |
| `ink` (`#1c2127`), `ink-500…900` | | Text. `ink-500` (`#59626d`) is the lightest allowed for body text | ≥ 4.5:1 on white |
| `concrete-50…400` | | Surfaces, borders, skeletons | n/a |
| `site.green/red/blue/yellow` | | Status (done, overdue/destructive, info, warning) | Use with text, not alone |

**Why the change:** the audit found white text on `#f26b1d` at 3.04:1 across about 25 page instances (`V2_AUDIT.md` E.1). The fix keeps the brand colour but moves text-bearing uses to `action`.

---

## 3. Components

| Component | File | Notes |
|---|---|---|
| `Button`, `ButtonLink`, `buttonClasses` | `ui/button.tsx` | Variants: `primary` (action), `dark`, `secondary`, `outline`, `outlineLight`, `ghost`, `danger`. Sizes `sm` (36 px, dense lists only), `md` (44 px), `lg` (48 px). Focus ring uses `action`. |
| `Field`, `Input`, `Select`, `Textarea`, `FormError`, `FormSuccess` | `ui/input.tsx` | Errors appear under the field; inputs keep their values on failure. |
| `SubmitButton` | `ui/submit-button.tsx` | Shows pending text; disabled while submitting. |
| `Card`, `CardHeader`, `CardBody` | `ui/card.tsx` | |
| `Badge`, `StatusBadge` | `ui/badge.tsx` | Status labels from `src/lib/constants.ts`, one source for colours. |
| `Tabs` | `ui/tabs.tsx` | Link-based segmented filter with counts. |
| `Modal` | `ui/modal.tsx` | Native `<dialog>`; a **bottom sheet on phones**, centred dialog from `sm` up. Used for the Create sheet and quick forms. |
| `ConfirmationDialog` | `ui/confirmation-dialog.tsx` | For destructive actions; states the consequence. |
| `Toast` (`useToast`, `useActionToast`) | `ui/toast.tsx` | Success 3.5 s; **errors 7 s** so they can be read. |
| `EmptyState` | `ui/empty-state.tsx` | Icon, what this is, why it's empty, one action (or two in a row). |
| `ErrorState` | `ui/error-state.tsx` | Used by every error boundary. Switches to an **offline** message when the device is offline; shows the reference code (error digest) that matches the server log. |
| Skeletons: `Skeleton`, `LoadingState`, `ListSkeleton`, `DetailSkeleton`, `FeedSkeleton` | `ui/loading-state.tsx` | Shaped like the screen they replace; announced to screen readers. |
| `BottomNavigation`, `SideNavigation` | `nav/bottom-navigation.tsx` | Phone tab bar with optional centre action and unread badges; desktop sidebar with grouped sections. |
| `VerifyEmailBanner` | `auth/verify-email-banner.tsx` | Amber banner with a resend button. |
| `LogoutButton` | `auth/logout-button.tsx` | Full page load after sign-out so cached state can't show a signed-in header. |

### Action hooks (behaviour, not visuals)
`useFormAction` and `useServerAction` (`ui/use-form-action.ts`) turn a thrown or offline server action into an inline error or error toast. The form keeps the user's input. Next's redirect and not-found signals pass through.

---

## 4. Navigation patterns
- **Phone:** bottom bar, max five slots. The centre slot is the Create button (48 px, `action`, white ring). Labels are always visible; active = `action` colour and a heavier icon stroke.
- **Desktop (≥ md):** left sidebar with the same destinations, a "Business" group and a "Create" group.
- **Badges:** `action` background, white text, "9+" cap; the count is also spoken ("Inbox, 3 unread").

---

## 5. Layout rules
- Page gutter 16 px (`px-4`), max widths `max-w-5xl` (app) / `max-w-6xl` (public).
- **Grid children get `min-w-0`** (`[&>*]:min-w-0` on the grid). Without it, a long `truncate` row can widen the page past the phone screen and push the fixed bottom bar out of view (this happened on the dashboard).
- Safe areas: bottom bar pads `env(safe-area-inset-bottom)`; content uses `pb-safe-nav` so it never sits under the bar.

---

## 6. Accessibility checklist (per screen)
- One `<h1>`; `<main id="main">` (target of the skip link in the root layout).
- Icon-only buttons have an `aria-label`. When a control shows visible text (e.g. a count), the accessible name contains it ("Like 3").
- Never colour alone for status: badges carry text.
- Automated axe checks are a floor, not proof; screen-reader and keyboard passes are still owed (`V2_AUDIT.md` E.1).
