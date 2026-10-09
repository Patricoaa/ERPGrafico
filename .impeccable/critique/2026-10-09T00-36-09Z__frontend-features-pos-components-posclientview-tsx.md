---
target: POS / mostrador (frontend/features/pos)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
p2_count: 3
target_identity: "file:/home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico/frontend/features/pos/components/POSClientView.tsx"
target_fingerprint: "sha256:7bb9dbc4170f1e8a24db1f261d9323a2a2072b2879c253102610c191615e2c33"
target_path: /home/pato/Nextcloud/Pato/Aplicaciones/ERPGrafico/frontend/features/pos/components/POSClientView.tsx
timestamp: 2026-10-09T00-36-09Z
slug: frontend-features-pos-components-posclientview-tsx
closed: true
---
Method: dual-agent (A: general/design-review · B: general/detector+browser)

# Critique — POS / Mostrador (`frontend/features/pos`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Stepper + toasts + waiting-payment pulse; stepper text near-illegible (`POSCheckoutHeader.tsx:89,107`) |
| 2 | Match System / Real World | 3 | Strong domain nouns (Boleta/Factura/Folio/DTE) but leaks "M. Pago", "T. Crédito", "items", "LdM" |
| 3 | User Control and Freedom | 3 | Back/Cancel/Esc/drafts exist; no undo for line removal, "Volver al Carrito" vs "Atrás" compete |
| 4 | Consistency and Standards | 2 | Same yellow = "Confirmar Venta" (`Cart.tsx:249`) and "Atrás" (`Cart.tsx:301`); color semantics unstable |
| 5 | Error Prevention | 3 | Stock limits, folio/period validation, credit checks; failures surface as toasts, not inline |
| 6 | Recognition Rather Than Recall | 3 | Tooltips/MAX chip/step meta; but draft tabs render only `d.id` (`POSClientView.tsx:478-488`) |
| 7 | Flexibility and Efficiency | 4 | Scanner Enter-to-add, Quick Sale, long-press steppers, favorites, keyboard numpad |
| 8 | Aesthetic and Minimalist Design | 2 | High density + stacked product overlays; "Mini Boletín" footer competes with actions |
| 9 | Error Recovery | 2 | Red flash + low beep good; transient toasts, no persistent field-level messages |
| 10 | Help and Documentation | 2 | Inline hints/tooltips only; no discoverable help |
| **Total** | | **27/40** | **Good (address weak areas)** |

## Design Specificity Verdict

**Domain-specific in structure, generic in surface.** The IA is unmistakably this product — DTE/SII vocabulary, folio validation, cash-session movements, BOM-aware manufacturing, "Retiro de Socio" (`Cart.tsx:231`, `POSClientView.tsx:750`). The visual language is mostly off-the-shelf shadcn/Tailwind assembled around brand accents rather than a designed action system. Specificity ≈ **6/10**: the product is bespoke, the paint is not yet.

**Deterministic scan**: `impeccable detect frontend/features/pos frontend/app/pos` → exit 2, **1 finding** (`bounce-easing` @ `POSReport.tsx:103`, `importedBy: SessionCloseModal.tsx`). Verified in context: three staggered `animate-bounce` dots inside a loading overlay — benign, a **false positive** for the rule's intent (page/element transitions). Whole-frontend baseline: **8 findings / 1421 files**, 0 errors; the other 7 live outside POS (`ActionDock.tsx:55` and `StatementImportModal.tsx:525` are genuine `bounce-easing` true positives; three `side-tab` and one `border-accent-on-rounded` verified intentional/benign). **POS itself is detector-clean of genuine slop.**

**Visual overlays**: browser automation IS available and mutation/injection works (gstack browse daemon; preflight set `document.title` and appended a script; `live-server --background` ran on port 8400 and was stopped). But the real POS client was **not reachable** — localhost:3000 refused, and the app requires the backend API + Postgres/Redis, out of scope here. So **no reliable overlay exists on the real POS surface**; the injection pipeline was proven only on a synthetic probe page. No POS overlay is claimed.

## Overall Impression
A fast, domain-faithful counter tool with genuinely good throughput affordances (scanner-first, Quick Sale, stock-aware cart) — held back by an unstable action-color language and micro-typography that a print-shop operator can't read at counter distance. Biggest opportunity: give the surface one deliberate, legible action system.

## What's Working
- **Deep domain fidelity**: DTE/SII, folios, session cash control, manufacturing-aware delivery — reads as this product, not a retail template.
- **Scanner-first flow**: exact-code match then auto-clear (`POSClientView.tsx:276-283`).
- **Real touch adaptations**: long-press steppers, read-only inputs + numpad, `MIN_MOBILE_FONT_SIZE`, `Max {qty}` chip with over-limit red (`CartItem.tsx:69-95,331-341`).
- **Robust draft model**: autosave + cross-terminal locking + waiting-payment signal (`POSClientView.tsx:248-252,456-497`).

## Priority Issues

**[P1] Action colors carry no consistent meaning**
- **What**: Same accent used for opposite intents — yellow = "Confirmar Venta" (`Cart.tsx:249`) yet yellow = "Atrás" (`Cart.tsx:301`); brand `bg-cyan`/`bg-magenta` have no stable role.
- **Why it matters**: Operators navigate by color/shape under speed; unstable semantics force reading — the one thing a POS can't afford.
- **Fix**: Define semantic action tokens (advance = primary, back/alt = neutral outline, destructive = red) and stop using brand accents as action state.
- **Suggested command**: `/impeccable colorize`

**[P1] Stepper micro-typography is unreadable at counter distance**
- **What**: `POSCheckoutHeader.tsx:89,107` clamp minimums to `0.3rem`/`0.4rem`.
- **Why it matters**: The primary progress affordance is effectively decorative on a tablet ~1m away.
- **Fix**: Raise minimums (~0.7rem label / 0.6rem meta), weight the active step, make metadata optional.
- **Suggested command**: `/impeccable typeset`

**[P1] Draft quick-tabs force recall**
- **What**: Buttons render bare `d.id` (`POSClientView.tsx:478-488`); names/amounts only in tooltips.
- **Why it matters**: "Which draft is #37?" is a memory tax and error source at high throughput.
- **Fix**: Show customer name or total on the tab; keep the ID as secondary.
- **Suggested command**: `/impeccable clarify`

**[P2] Successful scan gives no positive feedback**
- **What**: `ScannerFeedback` exposes `triggerSuccess` (`ScannerFeedback.tsx:38`) but `handleSearchEnter` only calls `triggerError` on failure (`POSClientView.tsx:282`).
- **Why it matters**: No reliable "it registered" signal for the most frequent action.
- **Fix**: Fire `triggerSuccess()` on every scan-path `addProductToCart`.
- **Suggested command**: `/impeccable delight`

**[P2] Discount/delete hidden on hover (desktop)**
- **What**: `opacity-0 group-hover:opacity-100` (`CartItem.tsx:168,181`); touch shows them always.
- **Why it matters**: Inconsistent discoverability defeats cross-device muscle memory.
- **Fix**: Always show, dimmed until hover/active.
- **Suggested command**: `/impeccable polish`

**[P2] Errors are transient toasts, not field-anchored**
- **What**: DTE/delivery/payment validation routes to `toast.error` (`SalesCheckoutWizardView.tsx:364,395,403,465`), detached from the field.
- **Why it matters**: Toasts vanish before the operator locates the field; recovery becomes trial-and-error.
- **Fix**: Persistent inline error text tied to the field; keep the toast as a secondary cue.
- **Suggested command**: `/impeccable harden`

## Persona Red Flags (find → add → discount → checkout → pay → print)
- **find product**: `SearchBar` autofocus force-disabled on touch (`SearchBar.tsx:38`) → operator must tap the field before a scanner wedge lands; no global barcode listener.
- **add to cart**: variant products divert to `POSVariantSelectorModal` (`POSClientView.tsx:270-274`) mid-scan.
- **apply discount**: hidden on desktop (`CartItem.tsx:168`); global discount buried under ⋮ (`Cart.tsx:122-135`).
- **checkout**: duplicated step lists — header `'Carrito'` vs wizard `'Cliente'` (`POSCheckoutHeader.tsx:60-71`, `SalesCheckoutWizardView.tsx:151-161`) risk drift.
- **pay**: abbreviated methods (`POSCheckoutHeader.tsx:10-20`) + `PINPadModal`/`ManualTerminalNotice` gates add hesitation.
- **Sam (Accessibility)**: only 3 `aria-label`/`role` usages in POS tsx; icon-only close (`DetailPanel.tsx:88`, h-6 w-6) unlabeled; `prefers-reduced-motion` detected (`useDeviceContext.ts:108`) but **never consumed** — 0 `motion-reduce` guards against 22 `animate-*` utilities; tinier `text-3xs/4xs` at contrast risk.
- **Alex (Power User)**: no global scan capture, no undo for line removal, hover-gated discount.
- **Project persona — counter operator (fast, touch, scanner-heavy)**: bottlenecked by numeric-only draft tabs, ~5–6px stepper labels, hover-gated discounts, and no positive scan feedback.

## Minor Observations
- Delivery-status label mismatch: `getDeliveryLabel` handles `IMMEDIATE/PARTIAL/LATER` (`POSCheckoutHeader.tsx:22-28`) but the flow emits `SCHEDULED` (`Step3_Delivery.tsx:131`) → raw enum shown; `LATER` is dead.
- "items" untranslated in step metadata (`POSCheckoutHeader.tsx:46`).
- `CartItem` memo omits `onUomChange`/`onRemove`/`onOpenNumpad` (`CartItem.tsx:375-382`) — stale-handler risk.
- `Numpad` global `window` keydown clears on `c` from anywhere (`Numpad.tsx:83-113`).
- Fixed `text-white`/`text-black` on brand-accent buttons won't adapt in dark mode.

## Questions to Consider
1. Should scanning be a **global** input capture so the operator never has to focus a field?
2. What is the intended action-color language — and can it be enforced as tokens rather than per-button utilities?
3. Is "Quick Sale → payment" enough for rush hours, or does void/refund also need a one-gesture entry?
