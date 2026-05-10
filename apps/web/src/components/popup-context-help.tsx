import { useEffect, useState } from "react";

const HELP_BUTTON_SELECTOR = "[data-context-help-button='true']";
const HELP_CANDIDATE_SELECTOR =
  "button[aria-label='Aide'], button[aria-label='Help'], a[aria-label='Aide'], a[aria-label='Help'], button[aria-label='Aide contextuelle'], a[aria-label='Aide contextuelle'], button:has(svg.lucide-circle-help), a:has(svg.lucide-circle-help)";
const CLOSE_BUTTON_SELECTOR =
  "button[aria-label='Fermer'], button[aria-label='Close']";
const HEADER_CLOSE_BUTTON_SELECTOR =
  `${CLOSE_BUTTON_SELECTOR}, button:has(svg.lucide-x)`;
const SUPPORT_BUTTON_TEXT = "contacter le support";
const PATIENT_DIALOG_CLASS_MARKER = "modal";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function resolveHelpHref(dialog: Element) {
  const explicitHref = dialog
    .querySelector<HTMLElement>("[data-context-help-href]")
    ?.dataset.contextHelpHref;
  if (explicitHref) {
    return explicitHref;
  }

  const context = normalizeText(
    `${window.location.pathname} ${dialog.textContent ?? ""}`,
  );

  if (
    context.includes("parametre") ||
    context.includes("mot de passe") ||
    context.includes("profil")
  ) {
    return "/aide/parametres#securite";
  }

  if (
    context.includes("template ordonnance") ||
    context.includes("template pdf") ||
    context.includes("mapping") ||
    context.includes("champs a imprimer")
  ) {
    return "/aide/ordonnances#template-pdf";
  }

  if (context.includes("medicament")) {
    if (context.includes("ajouter") || context.includes("nouveau")) {
      return "/aide/medicaments#ajout";
    }
    return "/aide/medicaments#base";
  }

  if (context.includes("antecedent")) {
    return "/aide/patients#antecedents";
  }

  if (context.includes("suivi")) {
    return "/aide/patients#suivis";
  }

  if (context.includes("consultation")) {
    return "/aide/patients#consultations";
  }

  if (
    context.includes("rendez-vous") ||
    context.includes("rdv") ||
    context.includes("agenda") ||
    context.includes("creneau")
  ) {
    return "/aide/agenda-rendez-vous#creation";
  }

  if (context.includes("vaccination")) {
    return "/aide/patients#vaccinations";
  }

  if (context.includes("voyage")) {
    return "/aide/patients#voyages";
  }

  if (
    context.includes("lettre") ||
    context.includes("certificat") ||
    context.includes("document")
  ) {
    return "/aide/patients#documents";
  }

  if (context.includes("traitement")) {
    return "/aide/patients#traitements";
  }

  if (context.includes("ordonnance") || context.includes("template")) {
    return "/aide/ordonnances#actions";
  }

  if (
    context.includes("patient") ||
    context.includes("creation")
  ) {
    return "/aide/patients#creation";
  }

  return "/aide";
}

function styleDialogIconButton(button: HTMLElement) {
  Object.assign(button.style, {
    alignItems: "center",
    background: "transparent",
    border: "0",
    borderRadius: "999px",
    color: "#052ca0",
    cursor: "pointer",
    display: "inline-flex",
    flexShrink: "0",
    height: "32px",
    justifyContent: "center",
    lineHeight: "1",
    minWidth: "32px",
    padding: "0",
    textDecoration: "none",
    transition:
      "background-color 0.16s ease, color 0.16s ease, opacity 0.16s ease, transform 0.16s ease",
    width: "32px",
  });
}

function styleHelpButton(button: HTMLElement) {
  button.dataset.contextHelpButton = "true";
  button.setAttribute("aria-label", "Aide contextuelle");
  button.setAttribute("title", "Aide contextuelle");
  styleDialogIconButton(button);
}

function setHelpIcon(button: HTMLElement) {
  button.innerHTML = `
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      viewBox="0 0 24 24"
      width="20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
      <path d="M12 17h.01"></path>
    </svg>
  `;
}

function attachIconButtonHover(button: HTMLElement) {
  if (button.dataset.contextIconHoverBound === "true") {
    return;
  }

  button.dataset.contextIconHoverBound = "true";
  button.style.cursor = "pointer";
  button.style.transition =
    button.style.transition ||
    "background-color 0.16s ease, color 0.16s ease, opacity 0.16s ease, transform 0.16s ease";

  button.addEventListener("mouseenter", () => {
    button.style.backgroundColor = "#eaf3fb";
    button.style.opacity = "1";
    button.style.transform = "translateY(-1px)";
  });
  button.addEventListener("mouseleave", () => {
    button.style.backgroundColor = "";
    button.style.opacity = "";
    button.style.transform = "";
  });
}

function configureCloseButton(button: HTMLButtonElement) {
  button.setAttribute("aria-label", "Fermer");
  button.setAttribute("title", "Fermer");
  styleDialogIconButton(button);
  attachIconButtonHover(button);
}

function configureHelpButton(
  button: HTMLButtonElement | HTMLAnchorElement,
  dialog: Element,
  options: { preserveStyle?: boolean } = {},
) {
  const href = button.dataset.contextHelpHref || resolveHelpHref(dialog);
  styleHelpButton(button);
  button.dataset.contextHelpHref = href;
  attachIconButtonHover(button);

  if (button instanceof HTMLAnchorElement) {
    button.href = href;
  } else {
    button.type = "button";
  }

  if (!options.preserveStyle) {
    setHelpIcon(button);
  }
}

function createHelpButton(dialog: Element) {
  const button = document.createElement("button");
  configureHelpButton(button, dialog);
  return button;
}

function findContextRoot(element: Element) {
  let current: Element | null = element;

  while (current) {
    if (
      current.getAttribute("role") === "dialog" ||
      current.className.toString().includes("fixed inset-0")
    ) {
      return current;
    }

    current = current.parentElement;
  }

  return element;
}

function findDialogHeader(dialog: Element) {
  return (
    dialog.querySelector("header") ??
    dialog.querySelector("[class*='header' i]") ??
    dialog.firstElementChild
  );
}

function isPatientFormDialog(dialog: Element) {
  return (
    dialog.getAttribute("aria-labelledby") === "nouveau-patient-title" ||
    dialog.getAttribute("aria-labelledby") === "modifier-patient-title" ||
    dialog.className.toString().includes(PATIENT_DIALOG_CLASS_MARKER)
  );
}

function enhanceDialog(dialog: Element) {
  if (dialog.getAttribute("data-context-help-ignore") === "true") {
    return;
  }

  const existingHelpButton = dialog.querySelector<HTMLButtonElement | HTMLAnchorElement>(
    `${HELP_BUTTON_SELECTOR}, ${HELP_CANDIDATE_SELECTOR}`,
  );
  const header = findDialogHeader(dialog);
  const closeButton = header?.querySelector<HTMLButtonElement>(
    HEADER_CLOSE_BUTTON_SELECTOR,
  );

  if (closeButton) {
    configureCloseButton(closeButton);
  }

  if (existingHelpButton) {
    configureHelpButton(existingHelpButton, dialog, { preserveStyle: true });
    return;
  }

  const helpButton = createHelpButton(dialog);

  if (!header) {
    dialog.prepend(helpButton);
    return;
  }

  if (isPatientFormDialog(dialog) && closeButton) {
    const actions = document.createElement("div");
    Object.assign(actions.style, {
      alignItems: "center",
      display: "inline-flex",
      flexShrink: "0",
      gap: "8px",
      marginLeft: "auto",
    });
    closeButton.parentElement?.insertBefore(actions, closeButton);
    actions.append(helpButton, closeButton);
    return;
  }

  if (closeButton?.parentElement && closeButton.parentElement !== header) {
    closeButton.parentElement.insertBefore(helpButton, closeButton);
    return;
  }

  if (closeButton && closeButton.parentElement === header) {
    const actions = document.createElement("div");
    Object.assign(actions.style, {
      alignItems: "center",
      display: "inline-flex",
      flexShrink: "0",
      gap: "8px",
      marginLeft: "auto",
    });
    header.insertBefore(actions, closeButton);
    actions.append(helpButton, closeButton);
    return;
  }

  header.append(helpButton);
}

function enhanceDialogs(root: ParentNode = document) {
  const dialogs = Array.from(root.querySelectorAll("[role='dialog']"));
  if (root instanceof Element && root.getAttribute("role") === "dialog") {
    dialogs.unshift(root);
  }

  for (const dialog of dialogs) {
    enhanceDialog(dialog);
  }

  const helpButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>(
      HELP_CANDIDATE_SELECTOR,
    ),
  );
  if (
    root instanceof HTMLButtonElement ||
    root instanceof HTMLAnchorElement
  ) {
    if (root.matches(HELP_CANDIDATE_SELECTOR)) {
      helpButtons.unshift(root);
    }
  }

  for (const helpButton of helpButtons) {
    configureHelpButton(helpButton, findContextRoot(helpButton), {
      preserveStyle: true,
    });
  }

  const closeButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>(CLOSE_BUTTON_SELECTOR),
  );
  if (root instanceof HTMLButtonElement && root.matches(CLOSE_BUTTON_SELECTOR)) {
    closeButtons.unshift(root);
  }

  for (const closeButton of closeButtons) {
    configureCloseButton(closeButton);
  }
}

function isSupportTrigger(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  const control = target.closest("button, a");
  if (!control) {
    return false;
  }

  return normalizeText(control.textContent ?? "") === SUPPORT_BUTTON_TEXT;
}

function getContextHelpHref(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  const control = target.closest<HTMLElement>(HELP_BUTTON_SELECTOR);
  return control?.dataset.contextHelpHref ?? null;
}

export function PopupContextHelpProvider() {
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  useEffect(() => {
    enhanceDialogs();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            enhanceDialogs(node);
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const handleHelpActivation = (event: MouseEvent | PointerEvent) => {
      const helpHref = getContextHelpHref(event.target);
      if (!helpHref) {
        return false;
      }

      event.preventDefault();
      event.stopPropagation();
      window.location.assign(helpHref);
      return true;
    };

    const handlePointerDown = (event: PointerEvent) => {
      handleHelpActivation(event);
    };

    const handleClick = (event: MouseEvent) => {
      if (handleHelpActivation(event)) {
        return;
      }

      if (!isSupportTrigger(event.target)) {
        return;
      }

      event.preventDefault();
      setIsSupportOpen(true);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("click", handleClick, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return (
    <SupportContactDialog
      open={isSupportOpen}
      onClose={() => setIsSupportOpen(false)}
    />
  );
}

function SupportContactDialog({
  onClose,
  open,
}: {
  onClose: () => void;
  open: boolean;
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
      style={{
        alignItems: "center",
        background: "rgba(15, 52, 96, 0.28)",
        backdropFilter: "blur(4px)",
        display: "flex",
        inset: 0,
        justifyContent: "center",
        padding: "20px",
        position: "fixed",
        zIndex: 220,
      }}
    >
      <section
        aria-labelledby="global-support-contact-title"
        aria-modal="true"
        data-context-help-ignore="true"
        role="dialog"
        style={{
          background: "#fff",
          border: "1px solid #d8edf7",
          borderRadius: "18px",
          boxShadow: "0 24px 60px -34px rgba(15,52,96,0.45)",
          padding: "20px",
          width: "min(440px, 100%)",
        }}
      >
        <div
          style={{
            alignItems: "flex-start",
            display: "flex",
            gap: "16px",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2
              id="global-support-contact-title"
              style={{
                color: "#0f3460",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: "18px",
                lineHeight: 1.3,
                margin: 0,
              }}
            >
              Contacter le support
            </h2>
            <p
              style={{
                color: "#6b7e99",
                fontFamily: "Inter, sans-serif",
                fontSize: "14px",
                lineHeight: 1.5,
                margin: "6px 0 0",
              }}
            >
              Notre equipe est disponible pour vous aider.
            </p>
          </div>
          <button
            aria-label="Fermer"
            onClick={onClose}
            style={{
              alignItems: "center",
              background: "#f8fbff",
              border: "1px solid #d8edf7",
              borderRadius: "10px",
              color: "#0f3460",
              cursor: "pointer",
              display: "inline-flex",
              flexShrink: 0,
              fontSize: "18px",
              height: "32px",
              justifyContent: "center",
              lineHeight: 1,
              width: "32px",
            }}
            type="button"
          >
            x
          </button>
        </div>

        <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
          <ContactLink label="Telephone" value="0776202361" href="tel:0776202361" />
          <ContactLink label="Telephone" value="0782594339" href="tel:0782594339" />
          <ContactLink label="Email" value="ok_amara@esi.dz" href="mailto:ok_amara@esi.dz" />
          <ContactLink label="Email" value="oa_bouziani@esi.dz" href="mailto:oa_bouziani@esi.dz" />
        </div>
      </section>
    </div>
  );
}

function ContactLink({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: string;
}) {
  return (
    <a
      href={href}
      style={{
        alignItems: "center",
        background: "#f8fbff",
        border: "1px solid #d8edf7",
        borderRadius: "14px",
        color: "#0f3460",
        display: "flex",
        gap: "12px",
        minHeight: "52px",
        padding: "12px",
        textDecoration: "none",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          alignItems: "center",
          background: "#fff7ed",
          borderRadius: "10px",
          color: "#f77a21",
          display: "inline-flex",
          flexShrink: 0,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: "13px",
          fontWeight: 800,
          height: "32px",
          justifyContent: "center",
          width: "32px",
        }}
      >
        {label === "Email" ? "@" : "T"}
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            color: "#6b7e99",
            display: "block",
            fontFamily: "Inter, sans-serif",
            fontSize: "11px",
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <span
          style={{
            color: "#0f3460",
            display: "block",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: "15px",
            fontWeight: 800,
            marginTop: "2px",
            overflowWrap: "anywhere",
          }}
        >
          {value}
        </span>
      </span>
    </a>
  );
}
