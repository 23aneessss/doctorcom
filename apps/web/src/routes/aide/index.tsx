import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  CaretDown,
  GearSix,
  House,
  MagnifyingGlass,
  Note,
  Pill,
  Question,
  User,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Sidebar } from "@/components/sidebar";
import { requireSession } from "@/lib/require-session";
import styles from "../parametres.module.css";

function CalendarAgendaIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="20.625"
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
      title: "Parametres",
      description: "Connexion, mot de passe et recuperation de compte.",
      icon: <GearSix size={20} weight="fill" />,
      href: "/aide/parametres",
    },
    {
      id: "patients",
      title: "Patients",
      description: "Dossiers, fiches et assistant IA medical.",
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
      description: "Creation, impression et suivi des prescriptions.",
      icon: <Note size={20} weight="fill" />,
      href: "/aide/ordonnances",
    },
    {
      id: "medicaments",
      title: "Medicaments",
      description: "Catalogue, prescriptions et statistiques.",
      icon: <Pill size={20} weight="fill" />,
      href: "/aide/medicaments",
    },
  ] as const;

  const frequentQuestions = [
    {
      id: "aide-home-1",
      question: "Je n'arrive pas a me connecter, que faire ?",
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
      question: "Comment recuperer mon compte ?",
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
          <section className={styles.heroCard}>
            <div className={styles.heroInner}>
              <h1 className={styles.heroTitle}>Comment pouvons-nous vous aider ?</h1>
              <p className={styles.heroSubtitle}>
                Recherchez une rubrique ou parcourez les categories ci-dessous
              </p>

              <div className={styles.searchWrap}>
                <MagnifyingGlass
                  size={18}
                  weight="bold"
                  className={styles.searchIcon}
                  aria-hidden="true"
                />
                <input
                  className={styles.searchInput}
                  type="search"
                  placeholder="Rechercher dans l'aide..."
                  aria-label="Rechercher dans l'aide"
                />
              </div>
            </div>
          </section>

          <section className={styles.sectionsGrid} aria-label="Rubriques d'aide">
            {sectionCards.map((card) => (
              <article key={card.id} className={styles.sectionCard}>
                <div className={styles.sectionIconWrap} aria-hidden="true">
                  {card.icon}
                </div>
                <h2 className={styles.sectionTitle}>{card.title}</h2>
                <p className={styles.sectionDescription}>{card.description}</p>
                <Link to={card.href} className={styles.sectionExplore}>
                  Explorer
                  <ArrowRight size={14} weight="bold" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </section>

          <section className={styles.faqSection} aria-label="Questions frequentes">
            <div className={styles.faqHeader}>
              <span className={styles.faqMarker}>
                <Question size={14} weight="bold" aria-hidden="true" />
              </span>
              <h2 className={styles.faqTitle}>Questions frequentes</h2>
            </div>

            <ul className={styles.faqList}>
              {frequentQuestions.map((item) => {
                const isOpen = openQuestionId === item.id;

                return (
                  <li
                    key={item.id}
                    className={`${styles.faqItem} ${isOpen ? styles.faqItemOpen : ""}`}
                  >
                    <button
                      type="button"
                      className={styles.faqButton}
                      onClick={() => {
                        setOpenQuestionId((current) => (current === item.id ? "" : item.id));
                      }}
                      aria-expanded={isOpen}
                    >
                      <span>{item.question}</span>
                      <CaretDown
                        size={16}
                        weight="bold"
                        className={`${styles.faqIcon} ${isOpen ? styles.faqIconOpen : ""}`}
                        aria-hidden="true"
                      />
                    </button>

                    <div className={`${styles.faqAnswerWrap} ${isOpen ? styles.faqAnswerWrapOpen : ""}`}>
                      <div className={styles.faqAnswerInner}>
                        <p className={styles.faqAnswerText}>{item.answer}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Link to="/aide/faq" className={styles.faqAll}>
              Voir toutes les questions frequentes {"->"}
            </Link>
          </section>

          <section className={styles.supportCard}>
            <div>
              <h3 className={styles.supportTitle}>Vous n'avez pas trouve votre reponse ?</h3>
              <p className={styles.supportDescription}>
                Notre equipe est disponible pour vous aider.
              </p>
            </div>

            <button type="button" className={styles.supportButton}>
              Contacter le support
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}
