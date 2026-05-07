import type { CSSProperties, ComponentPropsWithoutRef, ReactNode } from "react";
import { useState } from "react";

import {
  CalendarDots,
  GearSix,
  House,
  NotePencil,
  Pill,
  Question,
  UsersThree,
} from "@phosphor-icons/react";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

import doctorLogo from "@/assets/doctor-logo.svg";

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
  state?: NavItemProps["state"];
};

const PRIMARY_NAV_ITEMS: SidebarRouteItem[] = [
  {
    href: "/dashboard",
    label: SIDEBAR_TEXT.accueil,
    icon: <House size={24} weight="regular" />,
  },
  {
    href: "/patients",
    label: SIDEBAR_TEXT.patients,
    icon: <UsersThree size={24} weight="fill" />,
  },
  {
    href: "/agenda",
    label: SIDEBAR_TEXT.agenda,
    icon: <CalendarDots size={24} weight="fill" />,
  },
  {
    href: "/ordonnance",
    label: SIDEBAR_TEXT.ordonnances,
    icon: <NotePencil size={24} weight="fill" />,
  },
  {
    href: "/medicament",
    label: SIDEBAR_TEXT.medicaments,
    icon: <Pill size={24} weight="fill" />,
  },
];

const SECONDARY_NAV_ITEMS: SidebarRouteItem[] = [
  {
    href: "/parametres",
    label: SIDEBAR_TEXT.parametres,
    icon: <GearSix size={24} weight="fill" />,
  },
  {
    href: "/aide",
    label: SIDEBAR_TEXT.aide,
    icon: <Question size={24} weight="fill" />,
  },
];

const DEFAULT_USER: NonNullable<SidebarProps["currentUser"]> = {
  name: "Dr. Ballerina Cappucina",
  email: "BallerinaCappuc@gmail.com",
};

const SIDEBAR_STYLE_MAP = {
  sidebar: {
    position: "sticky",
    top: 0,
    alignSelf: "flex-start",
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
  navList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  } satisfies CSSProperties,
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
    width: 24,
    height: 24,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: SIDEBAR_COLORS.textActive,
  } satisfies CSSProperties,
  iconGlyph: {
    width: 24,
    height: 24,
    display: "block",
  } satisfies CSSProperties,
  navLabel: {
    margin: 0,
    color: SIDEBAR_COLORS.textDefault,
    fontSize: 16,
    fontWeight: 600,
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
  opacity = 1,
}: {
  icon: ReactNode;
  opacity?: number;
}) {
  return (
    <span
      aria-hidden="true"
      style={mergeStyles(SIDEBAR_STYLE_MAP.iconSlot, { opacity })}
    >
      <span style={SIDEBAR_STYLE_MAP.iconGlyph}>{icon}</span>
    </span>
  );
}

function SidebarNavItem({
  icon,
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
          gap: 18,
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
      ? { color: SIDEBAR_COLORS.textActive }
      : visualState === "hover"
        ? { color: SIDEBAR_COLORS.textActive }
        : undefined,
  );

  const iconOpacity = visualState === "default" ? 0.88 : 1;

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
      <SidebarIcon icon={icon} opacity={iconOpacity} />
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
  currentUser: propUser,
}: {
  currentUser?: NonNullable<SidebarProps["currentUser"]>;
}) {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();

  const sessionUser = session?.user;
  const currentUser: NonNullable<SidebarProps["currentUser"]> = sessionUser
    ? {
        name:
          sessionUser.name?.trim() ||
          (typeof sessionUser.email === "string" ? sessionUser.email : "Médecin"),
        email: typeof sessionUser.email === "string" ? sessionUser.email : "",
        avatarUrl: sessionUser.image ?? undefined,
      }
    : (propUser ?? DEFAULT_USER);

  const handleLogout = () => {
    void authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          void navigate({ to: "/login" as never });
        },
      },
    });
  };

  return (
    <div
      style={SIDEBAR_STYLE_MAP.userCard}
      aria-label="Current user profile"
      data-node-id="1:1050"
    >
      <div style={SIDEBAR_STYLE_MAP.userRow}>
        <div style={SIDEBAR_STYLE_MAP.userText}>
          <p style={SIDEBAR_STYLE_MAP.userName}>{currentUser.name}</p>
          <p style={SIDEBAR_STYLE_MAP.userEmail}>{currentUser.email}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Se déconnecter"
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
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
        </button>
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
