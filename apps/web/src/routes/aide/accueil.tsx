import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  CaretDown,
  CheckCircle,
  Warning,
} from "@phosphor-icons/react";
import headerTexture from "@/assets/figma/patients/fc145d0d9403ead31e8bc198dd8335751de59305.svg";
import patientsStyles from "@/components/patients/patients-page.module.css";

import { Sidebar } from "@/components/sidebar";
import { requireSession } from "@/lib/require-session";
import styles from "./parametres.module.css";

export const Route = createFileRoute("/aide/accueil")({
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

  const articleSections = [
    {
      id: "statistiques",
      title: "Comprendre vos indicateurs d'activité",
      intro: "Le tableau de bord vous offre une vue d'ensemble en temps réel de la performance de votre cabinet.",
      subtitle: "Les indicateurs clés (KPIs)",
      steps: [
        "Rendez-vous du jour : Nombre total de consultations prévues pour la date actuelle.",
        "Total patient : Taille globale de votre base de données patients.",
        "Nouveaux patients : Nombre de nouveaux dossiers créés durant le mois en cours.",
        "RDV annulés : Suivi des désistements pour optimiser votre gestion du temps.",
      ],
      calloutTone: "success",
      callout:
        "Ces indicateurs vous permettent de garder un œil constant sur votre activité et d'identifier rapidement les tendances importantes.",
    },
    {
      id: "analyses",
      title: "Analyse graphique",
      intro: "Visualisez vos données de manière dynamique pour mieux comprendre votre activité.",
      subtitle: "Types de graphiques disponibles",
      steps: [
        "Nombre de patients : Ce graphique à barres vous permet de comparer votre flux de patients par jour, mois ou année.",
        "Répartition par type de RDV : Le diagramme circulaire (Donut chart) segmente votre activité (Routine, Consultation, Suivi, Contrôle) pour mieux comprendre votre charge de travail.",
        "Médicaments les plus prescrits : Un classement automatique des traitements que vous validez le plus (ex : Doliprane, GRIPPEX), idéal pour le suivi épidémiologique.",
      ],
      calloutTone: "success",
      callout:
        "Utilisez les filtres temporels pour adapter chaque graphique à votre besoin d'analyse spécifique.",
    },
    {
      id: "raccourcis",
      title: "Actions Rapides & Prochains RDV",
      intro: "Le tableau de bord est conçu pour minimiser les clics et accéder instantanément à l'essentiel.",
      subtitle: "Utiliser les raccourcis",
      steps: [
        "Ajouter un RDV : Ouvre directement le formulaire de planification sans passer par l'onglet Agenda.",
        "Ajouter un patient : Crée une fiche patient vierge en un clic.",
        "Liste des prochains RDV : Visualisez les 4 prochains patients attendus. Cliquez sur l'icône \"Voir\" (l'œil orange) pour ouvrir instantanément leur dossier médical avant qu'ils n'entrent en consultation.",
        "Conseil : Utilisez le mini-calendrier dans le widget \"Prochains Rendez-vous\" pour naviguer rapidement entre les jours de la semaine et anticiper votre planning.",
      ],
      calloutTone: "success",
      callout:
        "Ces raccourcis vous permettent de gérer l'essentiel sans quitter le tableau de bord principal.",
    },
  ] as const;

  const articleLinks = [
    "Statistiques d'activité",
    "Analyses graphiques",
    "Utilisation des raccourcis",
  ] as const;

  const articleLinkTargets: Record<(typeof articleLinks)[number], string> = {
    "Statistiques d'activité": "statistiques",
    "Analyses graphiques": "analyses",
    "Utilisation des raccourcis": "raccourcis",
  };

  const scrollToArticleSection = (targetId: string) => {
    const targetElement = document.getElementById(targetId);
    targetElement?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const relatedQuestions = [
    "Puis-je modifier la période des graphiques ?",
    "Les statistiques sont-elles mises à jour automatiquement ?",
  ] as const;

  const faqAnswersByQuestion: Record<(typeof relatedQuestions)[number], string> = {
    "Puis-je modifier la période des graphiques ?":
      "Oui, utilisez les filtres \"Par jour\", \"Par mois\" ou \"Par an\" situés en haut à droite du graphique principal pour adapter la vue.",
    "Les statistiques sont-elles mises à jour automatiquement ?":
      "Absolument. Dès qu'un patient est ajouté ou qu'un rendez-vous est marqué comme \"Terminé\", les chiffres du tableau de bord s'actualisent instantanément.",
  };

  const [openRelatedQuestion, setOpenRelatedQuestion] = useState<string>("");

  return (
    <div className={styles.pageShell}>
      <Sidebar currentUser={sidebarUser} />

      <main className={styles.pageMain}>
        <div className={styles.pageContent}>
          <section
            className={patientsStyles.hero}
            style={{
              "--patients-hero-texture": `url(${headerTexture})`,
              marginLeft: "clamp(0.9rem, 2vw, 1.8rem)",
              marginRight: "clamp(0.9rem, 2vw, 1.8rem)",
              padding: "clamp(1.2rem, 2.5vw, 1.8rem) clamp(1rem, 2vw, 1.5rem)",
            } as any}
            aria-labelledby="accueil-page-title"
          >
            <div className={patientsStyles.heroInner}>
              <div className={patientsStyles.heroText}>
                <h1
                  className={patientsStyles.heroTitle}
                  id="accueil-page-title"
                  style={{ fontSize: "clamp(1.15rem, 1.9vw, 1.6rem)" }}
                >
                  Accueil
                </h1>
                <p
                  className={patientsStyles.heroSubtitle}
                  style={{
                    marginTop: "0.8rem",
                    fontSize: "clamp(0.8rem, 1.1vw, 1rem)",
                  }}
                >
                  Tableau de bord et gestion d'activité
                </p>
              </div>
            </div>
          </section>

          <div className={styles.columns}>
            <section className={styles.articleColumn} aria-label="Guide accueil">
              <Link to="/aide" className={styles.backLink}>
                <ArrowLeft size={17} weight="bold" aria-hidden="true" />
                Retour aux categories
              </Link>

              {articleSections.map((section) => (
                <article key={section.id} id={section.id} className={styles.articleCard}>
                  <h1 className={styles.articleTitle}>{section.title}</h1>
                  <p className={styles.articleIntro}>{section.intro}</p>
                  <h2 className={styles.articleSubtitle}>{section.subtitle}</h2>

                  <ol className={styles.stepsList}>
                    {section.steps.map((step) => (
                      <li key={step} className={styles.stepItem}>
                        <span className={styles.stepDot} aria-hidden="true" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>

                  <div
                    className={`${styles.callout} ${
                      section.calloutTone === "success"
                        ? styles.calloutSuccess
                        : styles.calloutWarning
                    }`}
                  >
                    {section.calloutTone === "success" ? (
                      <CheckCircle size={16} weight="fill" aria-hidden="true" />
                    ) : (
                      <Warning size={16} weight="fill" aria-hidden="true" />
                    )}
                    <p>{section.callout}</p>
                  </div>
                </article>
              ))}

              <section className={styles.supportCard}>
                <div>
                  <h3 className={styles.supportTitle}>Vous n'avez pas trouvé votre réponse ?</h3>
                  <p className={styles.supportDescription}>
                    Notre équipe est disponible pour vous aider.
                  </p>
                </div>

                <button type="button" className={styles.supportButton}>
                  Contacter le support
                </button>
              </section>
            </section>

            <aside className={styles.sideColumn} aria-label="Navigation secondaire aide">
              <section className={styles.sideCard}>
                <h2 className={styles.sideTitle}>Dans cet article</h2>
                <ul className={styles.sideList}>
                  {articleLinks.map((item) => (
                    <li key={item}>
                      <button
                        type="button"
                        className={styles.sideLink}
                        onClick={() => scrollToArticleSection(articleLinkTargets[item])}
                      >
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section className={styles.sideCard}>
                <h2 className={styles.sideTitle}>Questions liees</h2>
                <ul className={styles.sideList}>
                  {relatedQuestions.map((item) => {
                    const answer = faqAnswersByQuestion[item];
                    const hasAnswer = typeof answer === "string" && answer.length > 0;
                    const isOpen = hasAnswer && openRelatedQuestion === item;

                    if (!hasAnswer) {
                      return (
                        <li key={item}>
                          <Link to={relatedQuestionLinks[item]} className={styles.sideLink}>
                            {item}
                          </Link>
                        </li>
                      );
                    }

                    return (
                      <li key={item} className={styles.sideQuestionItem}>
                        <button
                          type="button"
                          className={styles.sideQuestionButton}
                          onClick={() => {
                            setOpenRelatedQuestion((current) =>
                              current === item ? "" : item
                            );
                          }}
                          aria-expanded={isOpen}
                        >
                          <span>{item}</span>
                          <CaretDown
                            size={14}
                            weight="bold"
                            className={`${styles.sideQuestionIcon} ${
                              isOpen ? styles.sideQuestionIconOpen : ""
                            }`}
                            aria-hidden="true"
                          />
                        </button>

                        <div
                          className={`${styles.sideAnswerWrap} ${
                            isOpen ? styles.sideAnswerWrapOpen : ""
                          }`}
                        >
                          <div className={styles.sideAnswerInner}>
                            <p className={styles.sideAnswerText}>{answer}</p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
