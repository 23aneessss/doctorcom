# FRONTEND.md

This document captures frontend best practices we agreed on while iterating in this codebase.

## Design and Figma Fidelity

- Treat Figma MCP output as source of truth when node IDs are provided.
- Prefer exact token matching (spacing, typography, borders, radii, shadows, icon placement) over approximation.
- Keep existing design language consistent unless explicitly asked to redesign.

## Typography and Inputs

- Use the requested font weight exactly (for current consultation value text: `font-normal` = 400).
- Do not change text color unless requested.
- Keep labels and entered values visually distinct but consistent with Figma hierarchy.
- Ensure loaded fonts/weights in `apps/web/index.html` match used classes.

## Forms and Error Handling

- Use TanStack Form + Zod validators for all editable forms.
- Show inline field errors for invalid fields (required, format, numeric).
- Show toast errors for mutation failures and toast success on completion.
- Block no-op edits with an informational message.
- Disable submit while mutation is pending.
- For update payloads, send only changed fields.
- For clearable optional fields, send `null` when user clears input.

## Popup Standards

- Support close by Escape, backdrop click, and close button.
- Keep popup headers consistent (title + right action group with stable spacing).
- Help button can be present without click implementation when requested.
- For long popups, header must stay reachable and body must scroll.
- Style scrollbars subtly and keep them unobtrusive.

## Data and State Refresh

- After mutations, invalidate all impacted queries (patient record, suivis, consultations).
- Keep create/edit flows in shared popup components when possible.
- Prefill contextual values (for example selected suivi when opening consultation popup).

## Interaction Behavior

- Clickable elements should use pointer affordance.
- Keep state-aware actions accurate:
  - active suivi -> `Cloturer`
  - closed suivi -> `Reactiver`
- If a suivi is closed, consultation edit actions should be blocked in UI and validated in backend.

## Loading UX

- Prefer subview skeletons over global spinner-only experience.
- Route pending should appear immediately for subview switches.
- Keep skeleton tones light and aligned with current UI style.

## Responsive Rules

- Desktop parity first unless user asks for additional breakpoints.
- Add practical responsive fallbacks:
  - dense rows can split into multiple rows on smaller screens
  - tab bars should remain usable on small screens (horizontal scroll if needed)

## Current Runtime Caveat (Monorepo)

- In this setup, `apps/server` watch mode may not watch `packages/*` changes reliably.
- After backend validation/router changes in `packages/api` or `packages/shared`, do a full restart (and rebuild if needed) before validating behavior.
