# Prompt Log

This file records user prompts and the resulting actions so other agents can continue with full context.

## 2026-04-21

1. Prompt: "fix this error, update the agents folder with each prompt"
- Issue: Vite css-analysis ENOENT on missing SVG under routes/patients/popups.
- Action: Restored compatibility SVG files in apps/web/src/routes/patients/popups by copying from apps/web/src/assets/icons/patients-popup.
- Action: Cleared Vite cache folder apps/web/node_modules/.vite.
- Outcome: Missing-file path now exists again; dev overlay should clear after server restart/reload.

2. Prompt: "make the green bar move exactly with the step circle just like in figma"
- File: apps/web/src/components/patients/popups/nouveau-patient-dialog.tsx
- Action: Replaced percentage-based progress width with DOM-measured pixel width tied to active step dot center.
- Outcome: Progress bar tracks step circle position accurately.

3. Prompt: "reactivate the backend integration ... readd the obligated fields"
- Files: apps/web/src/routes/patients/index.tsx, apps/web/src/components/patients/popups/nouveau-patient-dialog.tsx
- Action: Removed backend test gate and restored strict validation checks for step transitions.
- Outcome: Real backend create flow active; required fields gate step movement.

4. Prompt: "this is the second step ... common for both genders, add the missing fields"
- File: apps/web/src/components/patients/popups/nouveau-patient-dialog.tsx
- Action: Added Step 2 antecedents sections (personal/family), add/remove rows, required validation.
- Outcome: Missing Step 2 medical history fields are now implemented.
