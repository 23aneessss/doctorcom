import type { CSSProperties, ComponentPropsWithoutRef, ReactNode } from "react";
import { useState } from "react";

import { useLocation, useNavigate } from "@tanstack/react-router";

import doctorLogo from "@/assets/doctor-logo.svg";

function HomeGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M11.19 4.35L4.38 9.9a1.31 1.31 0 00-.48 1.03v7.14c0 .86.7 1.56 1.56 1.56h4.18c.39 0 .7-.31.7-.7v-3.8c0-.26.2-.47.47-.47h2.38c.26 0 .47.21.47.47v3.8c0 .39.31.7.7.7h4.18c.86 0 1.56-.7 1.56-1.56v-7.14c0-.4-.18-.78-.48-1.03l-6.81-5.55a1.39 1.39 0 00-1.75 0z" />
    </svg>
  );
}

function PatientsGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="9" r="2.2" />
      <circle cx="16" cy="9.6" r="1.8" />
      <path d="M4.9 17c.4-2 2.1-3.4 4.3-3.4h0c2.2 0 3.9 1.4 4.3 3.4" />
      <path d="M13.6 16.8c.3-1.4 1.4-2.3 2.9-2.3h0c1.4 0 2.5.8 2.8 2.1" />
    </svg>
  );
}

function AgendaGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M8 4v3M16 4v3M4 9h16" />
      <circle cx="9" cy="12.7" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12.7" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12.7" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function OrdonnancesGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.3 3.8h6.2L18.8 8V19c0 .83-.67 1.5-1.5 1.5h-9c-.83 0-1.5-.67-1.5-1.5V5.3c0-.83.67-1.5 1.5-1.5z" />
      <path d="M14.4 3.9V8h4.2" />
      <path d="M10 11.2h5M10 14.2h5M10 17.2h3.2" />
    </svg>
  );
}

function MedicamentsGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 3.8h6" />
      <path d="M10 3.8v1.8M14 3.8v1.8" />
      <rect x="7.5" y="5.6" width="9" height="14.4" rx="2" />
      <path d="M9.4 12.1h5.2M12 9.5v5.2" />
      <rect x="9.2" y="15" width="5.6" height="2.8" rx="0.7" />
    </svg>
  );
}

function ParametresGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4.8v2.1M12 17.1v2.1M19.2 12h-2.1M6.9 12H4.8M17.1 17.1l-1.5-1.5M8.4 8.4 6.9 6.9M6.9 17.1l1.5-1.5M17.1 6.9l-1.5 1.5" />
      <circle cx="12" cy="12" r="3.1" />
    </svg>
  );
}

function AideGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M10.6 9.6a1.8 1.8 0 113 1.4c-.85.6-1.35 1.08-1.35 2.1" />
      <circle cx="12" cy="16.3" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

const SIDEBAR_COLORS = {
  gradientFrom: "#0f3460",
  gradientVia: "#123865",
  gradientTo: "#285487",
  activeItemBg: "rgba(118, 187, 221, 0.4)",
  hoverItemBg: "rgba(118, 187, 221, 0.18)",
  textDefault: "rgba(255, 255, 255, 0.7)",
  textActive: "#fffdfb",
  divider: "rgba(255, 255, 255, 0.7)",
} as const;

interface SidebarProps extends Omit<
  ComponentPropsWithoutRef<"aside">,
  "children"
> {
  className?: string;
  currentUser?: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

interface NavItemProps {
  icon: ReactNode;
  assetName?: string;
  label: string;
  href: string;
  isActive?: boolean;
  state?: "active" | "default" | "hover";
  onNavigate?: (href: string) => void;
}

const SIDEBAR_TEXT = {
  accueil: "Accueil",
  patients: "Patients",
  agenda: "Agenda",
  ordonnances: "Ordonnances",
  medicaments: "Médicaments",
  parametres: "Paramètres",
  aide: "Aide et Assistance",
} as const;

type SidebarRouteItem = {
  href: string;
  label: string;
  icon: ReactNode;
  assetName?: string;
  state?: NavItemProps["state"];
};

const SIDEBAR_ICON_ASSET_MODULES = {
  ...import.meta.glob<{ default: string }>("../assets/icons/sidebar/*.svg", {
    eager: true,
  }),
  ...import.meta.glob<{ default: string }>("../assets/icons/sidebar/*.png", {
    eager: true,
  }),
};

const SIDEBAR_ICON_URLS = Object.entries(SIDEBAR_ICON_ASSET_MODULES).reduce<
  Record<string, string>
>((acc, [path, mod]) => {
  const fileName = path.split("/").pop();
  if (!fileName) {
    return acc;
  }
  const key = fileName.replace(/\.(svg|png)$/i, "");
  acc[key] = mod.default;
  return acc;
}, {});

const PRIMARY_NAV_ITEMS: SidebarRouteItem[] = [
  {
    href: "/",
    label: SIDEBAR_TEXT.accueil,
    icon: <HomeGlyph />,
    assetName: "home",
  },
  {
    href: "/patients",
    label: SIDEBAR_TEXT.patients,
    icon: <PatientsGlyph />,
    assetName: "patients",
  },
  {
    href: "/agenda",
    label: SIDEBAR_TEXT.agenda,
    icon: <AgendaGlyph />,
    assetName: "agenda",
  },
  {
    href: "/ordonnance",
    label: SIDEBAR_TEXT.ordonnances,
    icon: <OrdonnancesGlyph />,
    assetName: "ordonnances",
  },
  {
    href: "/medicament",
    label: SIDEBAR_TEXT.medicaments,
    icon: <MedicamentsGlyph />,
    assetName: "medicaments",
  },
];

const SECONDARY_NAV_ITEMS: SidebarRouteItem[] = [
  {
    href: "/parametres",
    label: SIDEBAR_TEXT.parametres,
    icon: <ParametresGlyph />,
    assetName: "parametres",
  },
  {
    href: "/aide",
    label: SIDEBAR_TEXT.aide,
    icon: <AideGlyph />,
    assetName: "aide",
  },
];

const DEFAULT_USER: NonNullable<SidebarProps["currentUser"]> = {
  name: "Dr. Ballerina Cappucina",
  email: "BallerinaCappuc@gmail.com",
};

const SIDEBAR_STYLE_MAP = {
  sidebar: {
    position: "relative",
    width: 250,
    minWidth: 250,
    flexShrink: 0,
    height: "100vh",
    minHeight: "100svh",
    overflow: "hidden",
    boxSizing: "border-box",
    background: `linear-gradient(180deg, ${SIDEBAR_COLORS.gradientFrom} 30%, ${SIDEBAR_COLORS.gradientVia} 65%, ${SIDEBAR_COLORS.gradientTo} 100%)`,
    fontFamily: '"Plus Jakarta Sans", "Inter Variable", sans-serif',
    color: SIDEBAR_COLORS.textActive,
    display: "flex",
    flexDirection: "column",
  } satisfies CSSProperties,
  logoWrap: {
    width: 176,
    height: 72,
    margin: "34px auto 0",
  } satisfies CSSProperties,
  logoImage: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "contain",
  } satisfies CSSProperties,
  navBase: {
    marginLeft: "auto",
    marginRight: "auto",
  } satisfies CSSProperties,
  primaryNav: {
    width: 213,
    marginTop: 54,
  } satisfies CSSProperties,
  secondaryNav: {
    width: 203,
    marginTop: 34,
  } satisfies CSSProperties,
  navList: { margin: 0, padding: 0, listStyle: "none" } satisfies CSSProperties,
  navButton: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    height: 48,
    padding: "11px 12px",
    border: 0,
    borderRadius: 15,
    textAlign: "left",
    cursor: "pointer",
    background: "transparent",
    outlineOffset: 2,
    transition:
      "background-color 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease",
  } satisfies CSSProperties,
  iconSlot: {
    width: 20,
    height: 20,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: SIDEBAR_COLORS.textActive,
  } satisfies CSSProperties,
  iconGlyph: {
    width: 20,
    height: 20,
    display: "block",
  } satisfies CSSProperties,
  iconImage: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "contain",
  } satisfies CSSProperties,
  navLabel: {
    margin: 0,
    lineHeight: "22px",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  divider: {
    alignSelf: "stretch",
    height: 0,
    borderTop: `1px solid ${SIDEBAR_COLORS.divider}`,
    opacity: 0.9,
    marginTop: 34,
  } satisfies CSSProperties,
  userCard: {
    width: "100%",
    padding: 10,
    borderRadius: 12,
    background: "#0f3460",
    boxShadow: "none",
  } satisfies CSSProperties,
  userCardWrap: {
    marginTop: "auto",
    width: 239,
    marginLeft: "auto",
    marginRight: "auto",
    padding: "0 0 calc(19px + env(safe-area-inset-bottom, 0px))",
    flexShrink: 0,
  } satisfies CSSProperties,
  userRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  } satisfies CSSProperties,
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    objectFit: "cover",
    display: "block",
    flexShrink: 0,
    background: "#d9d9d9",
  } satisfies CSSProperties,
  userText: { minWidth: 0, flex: 1 } satisfies CSSProperties,
  userName: {
    margin: 0,
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: "20px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  userEmail: {
    margin: 0,
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 10,
    fontWeight: 400,
    lineHeight: "16px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } satisfies CSSProperties,
  logoutIcon: {
    width: 20,
    height: 20,
    color: "#fffdfb",
    flexShrink: 0,
    opacity: 0.95,
  } satisfies CSSProperties,
} as const;

function mergeClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function mergeStyles(...styles: Array<CSSProperties | undefined>) {
  return Object.assign({}, ...styles);
}

function isRouteActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarIcon({
  icon,
  assetName,
  opacity = 1,
}: {
  icon: ReactNode;
  assetName?: string;
  opacity?: number;
}) {
  const [assetFailed, setAssetFailed] = useState(false);
  const iconAssetUrl = assetName ? SIDEBAR_ICON_URLS[assetName] : undefined;
  const useAsset = Boolean(iconAssetUrl && !assetFailed);

  return (
    <span
      aria-hidden="true"
      style={mergeStyles(SIDEBAR_STYLE_MAP.iconSlot, { opacity })}
    >
      {useAsset ? (
        <img
          src={iconAssetUrl}
          alt=""
          style={SIDEBAR_STYLE_MAP.iconImage}
          onError={() => setAssetFailed(true)}
        />
      ) : (
        <span style={SIDEBAR_STYLE_MAP.iconGlyph}>{icon}</span>
      )}
    </span>
  );
}

function SidebarNavItem({
  icon,
  assetName,
  label,
  href,
  isActive = false,
  state = "default",
  onNavigate,
}: NavItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const visualState = isActive ? "active" : isHovered ? "hover" : state;

  const buttonStyle = mergeStyles(
    SIDEBAR_STYLE_MAP.navButton,
    visualState === "active"
      ? {
          gap: 12,
          background: SIDEBAR_COLORS.activeItemBg,
          boxShadow: "0px 10px 3.9px -4px rgba(0, 0, 0, 0.15)",
        }
      : visualState === "hover"
        ? {
            gap: 18,
            background: SIDEBAR_COLORS.hoverItemBg,
            boxShadow: "0px 10px 3.9px -4px rgba(0, 0, 0, 0.15)",
            opacity: 0.88,
          }
        : { gap: 18 },
  );

  const labelStyle = mergeStyles(
    SIDEBAR_STYLE_MAP.navLabel,
    visualState === "active"
      ? { color: SIDEBAR_COLORS.textActive, fontSize: 14, fontWeight: 500 }
      : visualState === "hover"
        ? { color: SIDEBAR_COLORS.textActive, fontSize: 16, fontWeight: 600 }
        : { color: SIDEBAR_COLORS.textDefault, fontSize: 16, fontWeight: 600 },
  );

  const iconOpacity = visualState === "default" ? 0.7 : 1;

  return (
    <button
      type="button"
      style={buttonStyle}
      onClick={() => onNavigate?.(href)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
    >
      <SidebarIcon icon={icon} assetName={assetName} opacity={iconOpacity} />
      <span style={labelStyle}>{label}</span>
    </button>
  );
}

function SidebarLogo() {
  return (
    <div
      style={SIDEBAR_STYLE_MAP.logoWrap}
      aria-label="doctor.com"
      data-node-id="1:1015"
    >
      <img
        src={doctorLogo}
        alt="doctor.com"
        style={SIDEBAR_STYLE_MAP.logoImage}
      />
    </div>
  );
}

function SidebarUserCard({
  currentUser,
}: {
  currentUser: NonNullable<SidebarProps["currentUser"]>;
}) {
  const avatar = currentUser.avatarUrl ? (
    <img
      style={SIDEBAR_STYLE_MAP.avatar}
      src={currentUser.avatarUrl}
      alt={currentUser.name}
    />
  ) : (
    <span style={SIDEBAR_STYLE_MAP.avatar} aria-hidden="true" />
  );

  return (
    <div
      style={SIDEBAR_STYLE_MAP.userCard}
      aria-label="Current user profile"
      data-node-id="1:1050"
    >
      <div style={SIDEBAR_STYLE_MAP.userRow}>
        {avatar}
        <div style={SIDEBAR_STYLE_MAP.userText}>
          <p style={SIDEBAR_STYLE_MAP.userName}>{currentUser.name}</p>
          <p style={SIDEBAR_STYLE_MAP.userEmail}>{currentUser.email}</p>
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={SIDEBAR_STYLE_MAP.logoutIcon}
          aria-hidden="true"
        >
          <path d="M9 21H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3H9" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      </div>
    </div>
  );
}

function Sidebar({
  className,
  currentUser = DEFAULT_USER,
  ...props
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { style, ...asideProps } = props;

  const handleNavigate = (href: string) => {
    void navigate({ to: href as never });
  };

  return (
    <aside
      className={mergeClassNames(className)}
      style={mergeStyles(SIDEBAR_STYLE_MAP.sidebar, style)}
      data-node-id="1:1014"
      {...asideProps}
    >
      <SidebarLogo />

      <nav
        style={mergeStyles(
          SIDEBAR_STYLE_MAP.navBase,
          SIDEBAR_STYLE_MAP.primaryNav,
        )}
        aria-label="Primary sidebar navigation"
      >
        <ul style={SIDEBAR_STYLE_MAP.navList}>
          {PRIMARY_NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <SidebarNavItem
                icon={item.icon}
                assetName={item.assetName}
                label={item.label}
                href={item.href}
                isActive={isRouteActive(location.pathname, item.href)}
                state={item.state}
                onNavigate={handleNavigate}
              />
            </li>
          ))}
        </ul>
      </nav>

      <div style={SIDEBAR_STYLE_MAP.divider} data-node-id="1:1046" />

      <nav
        style={mergeStyles(
          SIDEBAR_STYLE_MAP.navBase,
          SIDEBAR_STYLE_MAP.secondaryNav,
        )}
        aria-label="Secondary sidebar navigation"
      >
        <ul style={SIDEBAR_STYLE_MAP.navList}>
          {SECONDARY_NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <SidebarNavItem
                icon={item.icon}
                assetName={item.assetName}
                label={item.label}
                href={item.href}
                isActive={isRouteActive(location.pathname, item.href)}
                state={item.state}
                onNavigate={handleNavigate}
              />
            </li>
          ))}
        </ul>
      </nav>

      <div style={SIDEBAR_STYLE_MAP.userCardWrap}>
        <SidebarUserCard currentUser={currentUser} />
      </div>
    </aside>
  );
}

export { Sidebar };
export default Sidebar;
