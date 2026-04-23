import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  CaretRight,
  GearSix,
  House,
  MagnifyingGlass,
  Note,
  Pill,
  Question,
  User,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";

import { Sidebar } from "@/components/sidebar";
import { requireSession } from "@/lib/require-session";
import styles from "../parametres.module.css";

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
      href: "/dashboard",
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
      href: "/patients",
    },
    {
      id: "agenda",
      title: "Agenda & Rendez-vous",
      description: "Planification, modification et statuts.",
      icon: <Note size={20} weight="fill" />,
      href: "/agenda",
    },
    {
      id: "ordonnances",
      title: "Ordonnances",
      description: "Creation, impression et suivi des prescriptions.",
      icon: <Note size={20} weight="fill" />,
      href: "/ordonnance",
    },
    {
      id: "medicaments",
      title: "Medicaments",
      description: "Catalogue, prescriptions et statistiques.",
      icon: <Pill size={20} weight="fill" />,
      href: "/medicament",
    },
  ] as const;

  const frequentQuestions = [
    "Je n'arrive pas a me connecter, que faire ?",
    "Comment modifier mon mot de passe ?",
    "Comment recuperer mon compte ?",
    "Comment contacter le support rapidement ?",
  ] as const;

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
              {frequentQuestions.map((question) => (
                <li key={question}>
                  <button type="button" className={styles.faqButton}>
                    <span>{question}</span>
                    <CaretRight size={16} weight="bold" aria-hidden="true" />
                  </button>
                </li>
              ))}
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
