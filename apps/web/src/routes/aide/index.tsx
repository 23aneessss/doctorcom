import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CaretDown,
  GearSix,
  House,
  Note,
  Pill,
  Question,
  User,
} from "@phosphor-icons/react";
import { useState } from "react";
import headerTexture from "@/assets/figma/patients/fc145d0d9403ead31e8bc198dd8335751de59305.svg";
import patientsStyles from "@/components/patients/patients-page.module.css";

import { Sidebar } from "@/components/sidebar";
import { requireSession } from "@/lib/require-session";
import styles from "../parametres.module.css";

function CalendarAgendaIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="18.75"
      viewBox="0 0 22 20.625"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M17.875 1.375H22V20.625H0V1.375H4.125V0H5.5V1.375H16.5V0H17.875V1.375ZM4.125 2.75H1.375V5.5H20.625V2.75H17.875V4.125H16.5V2.75H5.5V4.125H4.125V2.75ZM1.375 19.25H20.625V6.875H1.375V19.25ZM4.125 11V9.625H17.875V11H4.125ZM4.125 15.125V13.75H17.875V15.125H4.125Z"
        fill="currentColor"
      />
    </svg>
  );
}

export const Route = createFileRoute("/aide/")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await requireSession();
    return { session };
  },
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const sessionUser = session?.data?.user;
  const sidebarUser =
    sessionUser && typeof sessionUser.email === "string"
      ? {
          name: sessionUser.name?.trim() || sessionUser.email,
          email: sessionUser.email,
          avatarUrl: sessionUser.image ?? undefined,
        }
      : undefined;

  const sectionCards = [
    {
      id: "accueil",
      title: "Accueil",
      description: "Statistiques, KPIs et actions rapides.",
      icon: <House size={20} weight="fill" />,
      href: "/aide/accueil",
    },
    {
      id: "parametres",
      title: "Paramètres",
      description: "Connexion, mot de passe et récupération de compte.",
      icon: <GearSix size={20} weight="fill" />,
      href: "/aide/parametres",
    },
    {
      id: "patients",
      title: "Patients",
      description: "Dossiers, fiches et assistant IA médical.",
      icon: <User size={20} weight="fill" />,
      href: "/aide/patients",
    },
    {
      id: "agenda",
      title: "Agenda & Rendez-vous",
      description: "Planification, modification et statuts.",
      icon: <CalendarAgendaIcon />,
      href: "/aide/agenda-rendez-vous",
    },
    {
      id: "ordonnances",
      title: "Ordonnances",
      description: "Création, impression et suivi des prescriptions.",
      icon: <Note size={20} weight="fill" />,
      href: "/aide/ordonnances",
    },
    {
      id: "medicaments",
      title: "Médicaments",
      description: "Catalogue, prescriptions et statistiques.",
      icon: <Pill size={20} weight="fill" />,
      href: "/aide/medicaments",
    },
  ] as const;

  const frequentQuestions = [
    {
      id: "aide-home-1",
      question: "Je n'arrive pas à me connecter, que faire ?",
      answer:
        "Sur la page de connexion, cliquez sur \"Mot de passe oublié ?\", saisissez votre e-mail professionnelle puis suivez le lien de réinitialisation reçu par e-mail.",
    },
    {
      id: "aide-home-2",
      question: "Comment modifier mon mot de passe ?",
      answer:
        "Allez dans Paramètres > Sécurité, cliquez sur \"Changer le mot de passe\", puis validez votre nouveau mot de passe (minimum 8 caractères).",
    },
    {
      id: "aide-home-3",
      question: "Comment récupérer mon compte ?",
      answer:
        "Utilisez l'option \"Mot de passe oublié ?\" sur l'écran de connexion. Si vous n'avez plus accès à votre e-mail, contactez le support pour vérification.",
    },
    {
      id: "aide-home-4",
      question: "Comment contacter le support rapidement ?",
      answer:
        "Utilisez le bouton \"Contacter le support\" en bas de la page Aide pour joindre rapidement l'équipe d'assistance.",
    },
  ] as const;

  const [openQuestionId, setOpenQuestionId] = useState<string>(frequentQuestions[0]?.id ?? "");

  return (
    <div className={styles.pageShell}>
      <Sidebar currentUser={sidebarUser} />

      <main className={styles.pageMain}>
        <div className={styles.pageContent}>

          {/* ── Hero header — identical pattern to all aide sub-pages ── */}
          <section
            className={patientsStyles.hero}
            style={{
              "--patients-hero-texture": `url(${headerTexture})`,
              marginLeft: "clamp(0.9rem, 2vw, 1.8rem)",
              marginRight: "clamp(0.9rem, 2vw, 1.8rem)",
              padding: "clamp(1.2rem, 2.5vw, 1.8rem) clamp(1rem, 2vw, 1.5rem)",
            } as any}
            aria-labelledby="aide-page-title"
          >
            <div className={patientsStyles.heroInner}>
              <div className={patientsStyles.heroText}>
                <h1
                  className={patientsStyles.heroTitle}
                  id="aide-page-title"
                  style={{ fontSize: "clamp(1.15rem, 1.9vw, 1.6rem)" }}
                >
                  Aide &amp; Assistance
                </h1>
                <p
                  className={patientsStyles.heroSubtitle}
                  style={{ marginTop: "0.8rem", fontSize: "clamp(0.8rem, 1.1vw, 1rem)" }}
                >
                  Guides, FAQ et support technique
                </p>
              </div>
            </div>
          </section>

          {/* ── 6 section cards ── */}
          <section
            aria-label="Rubriques d'aide"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "1.1rem",
              marginInline: "clamp(0.9rem, 2vw, 1.8rem)",
            }}
          >
            {sectionCards.map((card) => (
              <article
                key={card.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  borderRadius: "18px",
                  border: "1px solid #cfe6f3",
                  background: "#ffffff",
                  boxShadow: "0px 4px 16px -8px rgba(15,52,96,0.12)",
                  transition: "transform 200ms ease-out, box-shadow 200ms ease-out, border-color 200ms ease-out",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                  (e.currentTarget as HTMLElement).style.borderColor = "#afd4ea";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0px 12px 28px -12px rgba(15,52,96,0.2)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLElement).style.borderColor = "#cfe6f3";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0px 4px 16px -8px rgba(15,52,96,0.12)";
                }}
              >
                {/* Card body */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px", padding: "20px 20px 16px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "40px",
                        height: "40px",
                        flexShrink: 0,
                        borderRadius: "11px",
                        background: "#052CA0",
                        color: "#ffffff",
                        boxShadow: "0px 4px 12px rgba(5,44,160,0.25)",
                      }}
                    >
                      {card.icon}
                    </span>
                  </div>
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontSize: "15px",
                        fontWeight: 700,
                        lineHeight: 1.3,
                        color: "#0f3460",
                      }}
                    >
                      {card.title}
                    </h2>
                    <p
                      style={{
                        margin: "5px 0 0",
                        fontFamily: "Inter, sans-serif",
                        fontSize: "12.5px",
                        fontWeight: 400,
                        lineHeight: 1.5,
                        color: "#6b7e99",
                      }}
                    >
                      {card.description}
                    </p>
                  </div>
                </div>

                {/* Card footer */}
                <div style={{ display: "flex", alignItems: "center", borderTop: "1px solid #e8f3fb", padding: "10px 20px" }}>
                  <Link
                    to={card.href}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      color: "#f77a21",
                      textDecoration: "none",
                    }}
                  >
                    Explorer
                    <ArrowRight size={13} weight="bold" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </section>

          {/* ── FAQ section ── */}
          <section
            style={{ marginInline: "clamp(0.9rem, 2vw, 1.8rem)", display: "flex", flexDirection: "column", gap: "1.1rem" }}
            aria-label="Questions fréquentes"
          >
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.7rem" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "999px",
                  background: "#fff5f5",
                  color: "#f77a21",
                }}
              >
                <Question size={14} weight="bold" aria-hidden="true" />
              </span>
              <h2
                style={{
                  margin: 0,
                  color: "#0f3460",
                  fontSize: "clamp(1.05rem, 1.8vw, 1.4rem)",
                  fontWeight: 700,
                }}
              >
                Questions fréquentes
              </h2>
            </div>

            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {frequentQuestions.map((item) => {
                const isOpen = openQuestionId === item.id;
                return (
                  <li
                    key={item.id}
                    style={{
                      borderRadius: "12px",
                      border: isOpen ? "1px solid #b8d4ea" : "1px solid #d8edf7",
                      borderLeft: isOpen ? "4px solid #052CA0" : "1px solid #d8edf7",
                      background: isOpen ? "linear-gradient(to right, #f0f7ff, #ffffff)" : "#ffffff",
                      overflow: "hidden",
                      transition: "border-color 0.18s ease, background 0.18s ease",
                      boxShadow: isOpen ? "0px 4px 14px -6px rgba(15,52,96,0.12)" : "none",
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        width: "100%",
                        border: 0,
                        background: "transparent",
                        color: isOpen ? "#052CA0" : "#0f3460",
                        minHeight: "3rem",
                        padding: "0.8rem 1rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.8rem",
                        textAlign: "left",
                        fontFamily: "Inter, sans-serif",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                      onClick={() => setOpenQuestionId((current) => (current === item.id ? "" : item.id))}
                      aria-expanded={isOpen}
                    >
                      <span>{item.question}</span>
                      <CaretDown
                        size={16}
                        weight="bold"
                        aria-hidden="true"
                        style={{
                          flexShrink: 0,
                          color: "#4a6fa5",
                          transition: "transform 0.24s cubic-bezier(0.22,1,0.36,1)",
                          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        }}
                      />
                    </button>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateRows: isOpen ? "1fr" : "0fr",
                        opacity: isOpen ? 1 : 0,
                        transition: "grid-template-rows 0.24s cubic-bezier(0.16,1,0.3,1), opacity 0.2s ease",
                      }}
                    >
                      <div style={{ overflow: "hidden", minHeight: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            padding: "0 1rem 0.9rem",
                            fontFamily: "Inter, sans-serif",
                            fontSize: "0.86rem",
                            lineHeight: 1.6,
                            color: "#3d5a7a",
                          }}
                        >
                          {item.answer}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Link
              to="/aide/faq"
              style={{
                alignSelf: "flex-end",
                color: "#052CA0",
                fontFamily: "Inter, sans-serif",
                fontSize: "0.9rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Voir toutes les questions fréquentes →
            </Link>
          </section>

          {/* ── Support section ── */}
          <section
            style={{
              marginInline: "clamp(0.9rem, 2vw, 1.8rem)",
              marginBottom: "clamp(1rem, 2vw, 1.5rem)",
              borderRadius: "14px",
              border: "1px solid #c8e3f0",
              background: "linear-gradient(135deg, #eaf4fb 0%, #f5fafd 100%)",
              padding: "clamp(1rem, 1.8vw, 1.4rem) clamp(1.2rem, 2vw, 1.6rem)",
              display: "flex",
              flexWrap: "wrap" as const,
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              boxShadow: "0px 2px 10px rgba(118,187,221,0.15)",
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  color: "#0f3460",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: "clamp(0.9rem, 1.3vw, 1.05rem)",
                  fontWeight: 700,
                  lineHeight: 1.35,
                }}
              >
                Vous n'avez pas trouvé votre réponse ?
              </h3>
              <p
                style={{
                  margin: "0.25rem 0 0",
                  color: "#6b7e99",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "clamp(0.78rem, 1vw, 0.88rem)",
                  lineHeight: 1.4,
                }}
              >
                Notre équipe est disponible pour vous aider.
              </p>
            </div>

            <button
              type="button"
              style={{
                minHeight: "2.4rem",
                border: 0,
                borderRadius: "10px",
                background: "linear-gradient(135deg, #052CA0 0%, #173FB8 100%)",
                color: "#ffffff",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontSize: "0.85rem",
                fontWeight: 700,
                padding: "0.55rem 1.3rem",
                whiteSpace: "nowrap" as const,
                cursor: "pointer",
                boxShadow: "0px 4px 14px rgba(5,44,160,0.28)",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0px 6px 18px rgba(5,44,160,0.36)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0px 4px 14px rgba(5,44,160,0.28)";
              }}
            >
              Contacter le support
            </button>
          </section>

        </div>
      </main>
    </div>
  );
}
