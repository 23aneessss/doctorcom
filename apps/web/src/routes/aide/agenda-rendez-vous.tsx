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

export const Route = createFileRoute("/aide/agenda-rendez-vous")({
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
      id: "agenda",
      title: "Vue de l'agenda",
      intro:
        "L'agenda offre une vue chronologique de tous vos rendez-vous, organisés par jour. Chaque créneau est représenté par une carte colorée pour une lecture rapide de votre charge de travail.",
      subtitle: "Les codes couleurs",
      steps: [
        "Vert : Terminé. La consultation a été effectuée et clôturée.",
        "Bleu ciel : Confirmé. Le rendez-vous est validé par le patient ou le secrétariat.",
        "Orange : En attente. Le rendez-vous nécessite une confirmation.",
        "Rouge : Annulé. Le rendez-vous a été annulé par le médecin ou le patient.",
      ],
      calloutTone: "success",
      callout:
        "Les couleurs vous permettent d'identifier en un coup d'œil l'état de chaque créneau sans ouvrir le détail du rendez-vous.",
    },
    {
      id: "creation",
      title: "Créer un nouveau rendez-vous",
      intro:
        "L'ajout d'un rendez-vous est simplifié pour permettre une prise en charge rapide.",
      subtitle: "Étapes de création",
      steps: [
        "Cliquez sur le bouton bleu \"+ Ajouter un RDV\" en haut à droite de votre écran Agenda.",
        "Recherche Patient : Saisissez le nom ou l'ID du patient. Si c'est un nouveau patient, l'option de création apparaîtra.",
        "Détails du RDV : Sélectionnez la date, l'heure de début et le type de consultation.",
        "Statut : Par défaut, le RDV est mis \"En attente\". Vous pouvez le passer en \"Confirmé\" immédiatement.",
        "Notes : Ajoutez des notes internes (ex : \"Apporter anciens résultats\").",
        "Cliquez sur \"Confirmer le rendez-vous\".",
      ],
      calloutTone: "warning",
      callout:
        "Le mini-calendrier à droite de l'écran reste toujours visible pour vous aider à trouver un créneau libre.",
    },
    {
      id: "modify",
      title: "Modifier ou annuler un rendez-vous",
      intro:
        "La gestion des imprévus est au cœur du module Agenda.",
      subtitle: "Procédure de modification",
      steps: [
        "Cliquez directement sur la carte du rendez-vous dans l'agenda pour ouvrir les détails.",
        "Modifiez l'heure ou la date si nécessaire.",
        "Pour annuler : changez le statut en \"Annulé\".",
        "Validez pour mettre à jour votre planning.",
      ],
      calloutTone: "warning",
      callout:
        "Un rendez-vous annulé reste visible dans l'historique du patient.",
    },
  ] as const;

  const articleLinks = [
    "Vue de l'agenda et codes couleurs",
    "Créer un nouveau rendez-vous",
    "Modifier ou annuler un rendez-vous",
  ] as const;

  const articleLinkTargets: Record<(typeof articleLinks)[number], string> = {
    "Vue de l'agenda et codes couleurs": "agenda",
    "Créer un nouveau rendez-vous": "creation",
    "Modifier ou annuler un rendez-vous": "modify",
  };

  const scrollToArticleSection = (targetId: string) => {
    const targetElement = document.getElementById(targetId);
    targetElement?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const relatedQuestions = [
    "Comment voir mes rendez-vous à venir en un clin d'œil ?",
    "Puis-je rechercher un rendez-vous spécifique ?",
    "Comment retrouver rapidement le dossier d'un patient depuis l'agenda ?",
  ] as const;

  const faqAnswersByQuestion: Record<(typeof relatedQuestions)[number], string> = {
    "Comment voir mes rendez-vous à venir en un clin d'œil ?":
      "Consultez la colonne \"Prochains rendez-vous\" à droite de votre agenda ou directement sur votre tableau de bord (Accueil).",
    "Puis-je rechercher un rendez-vous spécifique ?":
      "Oui, utilisez la barre de recherche en haut à droite pour filtrer par nom de patient ou type de consultation.",
    "Comment retrouver rapidement le dossier d'un patient depuis l'agenda ?":
      "Pour gagner du temps entre deux consultations, cliquez simplement sur le nom du patient (en bleu) à l'intérieur de sa carte de rendez-vous. L'application vous redirigera instantanément vers son profil complet.",
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
            aria-labelledby="agenda-page-title"
          >
            <div className={patientsStyles.heroInner}>
              <div className={patientsStyles.heroText}>
                <h1
                  className={patientsStyles.heroTitle}
                  id="agenda-page-title"
                  style={{ fontSize: "clamp(1.15rem, 1.9vw, 1.6rem)" }}
                >
                  Agenda & Rendez-vous
                </h1>
                <p
                  className={patientsStyles.heroSubtitle}
                  style={{ marginTop: "0.8rem", fontSize: "clamp(0.8rem, 1.1vw, 1rem)" }}
                >
                  Planning, couleurs et suivi des consultations
                </p>
              </div>
            </div>
          </section>

          <div className={styles.columns}>
            <section className={styles.articleColumn} aria-label="Guide agenda">
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
                      section.calloutTone === "success" ? styles.calloutSuccess : styles.calloutWarning
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
                  <p className={styles.supportDescription}>Notre équipe est disponible pour vous aider.</p>
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
                <h2 className={styles.sideTitle}>Questions liées</h2>
                <ul className={styles.sideList}>
                  {relatedQuestions.map((item) => {
                    const answer = faqAnswersByQuestion[item];
                    const isOpen = openRelatedQuestion === item;

                    return (
                      <li key={item} className={styles.sideQuestionItem}>
                        <button
                          type="button"
                          className={styles.sideQuestionButton}
                          onClick={() => {
                            setOpenRelatedQuestion((current) => (current === item ? "" : item));
                          }}
                          aria-expanded={isOpen}
                        >
                          <span>{item}</span>
                          <CaretDown
                            size={14}
                            weight="bold"
                            className={`${styles.sideQuestionIcon} ${isOpen ? styles.sideQuestionIconOpen : ""}`}
                            aria-hidden="true"
                          />
                        </button>

                        <div className={`${styles.sideAnswerWrap} ${isOpen ? styles.sideAnswerWrapOpen : ""}`}>
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
