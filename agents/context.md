# Doctor.com Web Handoff Context

Updated: 2026-04-21

## Current objective area

This session focused on the web patients flow, specifically the Nouveau patient multi-step popup and related runtime fixes.

## Most recent completed changes

0. ENOENT css-analysis fix for popup SVG paths
- Error seen: missing file under apps/web/src/routes/patients/popups/*.svg
- Action: restored compatibility SVG copies in apps/web/src/routes/patients/popups from apps/web/src/assets/icons/patients-popup
- Action: cleared Vite cache at apps/web/node_modules/.vite
- Note: if overlay persists, restart dev server and hard refresh

1. Backend integration reactivated for patient creation
- File: apps/web/src/routes/patients/index.tsx
- Temporary test gate was removed from create flow.
- Add-now action now executes real mutation path again.

2. Required-field progression restored
- File: apps/web/src/components/patients/popups/nouveau-patient-dialog.tsx
- Preview bypass disabled:
  - ALLOW_STEP_PREVIEW_NAVIGATION = false
- Continue now blocks when required fields are missing.

3. Step 2 missing fields implemented (Figma node 2213:50080)
- File: apps/web/src/components/patients/popups/nouveau-patient-dialog.tsx
- Added common Step 2 antecedent sections for both genders:
  - ANTECEDENTS PERSONNELS:
    - Type (required)
    - Details (required)
    - Maladie active checkbox
    - Add/remove rows
  - ANTECEDENTS FAMILIAUX:
    - Lien de parente (required)
    - Pathologie (required)
    - Add/remove rows
- Step 2 validation now checks these required fields.

4. Route/component separation to avoid white page
- Route file kept as stub route only:
  - apps/web/src/routes/patients/popups/nouveau-patient.tsx
- Dialog UI component moved/used from components path:
  - apps/web/src/components/patients/popups/nouveau-patient-dialog.tsx
- Patients page imports dialog from components path.

5. SVG assets moved from popup route folder
- Source moved to:
  - apps/web/src/assets/icons/patients-popup
- Popup route folder now intended to hold code files only.

Compatibility note:
- For dev-server stability, legacy SVG copies may be temporarily present in route popup folder when Vite still references old paths.

## Current architecture notes

1. TanStack route scanning constraint
- Anything under apps/web/src/routes is treated as route files.
- Non-route UI modules should not live under routes unless intentionally stubbed.

2. Popup styling location
- Dialog component currently imports popup CSS from:
  - apps/web/src/routes/patients/popups/nouveau-patient.module.css
- This still works, but is a cleanup candidate to colocate under components.

## Known warnings / technical debt

1. Route generator warnings persist for many popup files under routes/*/popups that do not export Route.
- Build and route generation output warnings (not all are blockers).
- Recommended future cleanup:
  - rename non-route popup files with routeFileIgnorePrefix (-)
  - or configure routeFileIgnorePattern

2. Asset duplication history
- During ENOENT troubleshooting, compatibility copies were temporarily restored under routes popups.
- Current requested action moved SVGs back to assets/icons/patients-popup.
- Verify no stale dev-server cache references remain.

## Verification status from this session

- Type diagnostics were clean for edited popup + patients route files after latest changes.
- Build command previously progressed with many route warnings; primary popup/export blocker was addressed.

## Suggested next checks for the next agent

1. Open /patients and verify popup opens and renders all step-2 antecedent fields.
2. Confirm step transitions:
- Step 1 blocks until required fields are completed.
- Step 2 blocks until required antecedent fields are completed.
3. Confirm add-now uses backend mutation and persists patient.
4. Confirm no ENOENT overlay for popup SVG files.
5. Optionally migrate popup CSS file to components path and update import.

## Prompt history

Prompt-by-prompt log is maintained in:

- agents/prompts.md
