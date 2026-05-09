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

export const Route = createFileRoute("/aide/ordonnances")({
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
      id: "overview",
      title: "Vue d'ensemble",
      intro:
        "Cet espace centralise l'historique de toutes les prescriptions émises, classées par type pour un suivi optimal.",
      subtitle: "Statut des ordonnances",
      steps: [
        "IA : Ordonnance générée ou assistée par la suggestion intelligente.",
        "Pré-remplie : Ordonnance créée à partir d'un modèle de votre bibliothèque.",
        "Manuel : Ordonnance rédigée de zéro, sans aide ni modèle.",
      ],
      calloutTone: "success",
      callout:
        "Les statuts permettent de retrouver rapidement l'origine d'une prescription et de distinguer les ordonnances assistées des modèles personnalisés.",
    },
    {
      id: "actions",
      title: "Actions",
      intro:
        "Chaque ordonnance peut être consultée, ajustée, imprimée ou téléchargée selon votre besoin.",
      subtitle: "Gérer une prescription",
      steps: [
        "Voir : Consulter l'aperçu du document avant toute action.",
        "Modifier : Ajuster une posologie ou un médicament, même après enregistrement.",
        "Imprimer : Générer la version papier pour le patient.",
        "Télécharger : Exporter l'ordonnance en PDF pour un envoi numérique sécurisé.",
      ],
      calloutTone: "warning",
      callout:
        "Vérifiez toujours l'aperçu avant impression ou téléchargement afin de limiter les corrections de dernière minute.",
    },
    {
      id: "templates",
      title: "Modèles d'ordonnance",
      intro:
        "Gagnez un temps précieux en utilisant des protocoles pré-établis pour les pathologies fréquentes.",
      subtitle: "Utiliser et modifier les modèles",
      steps: [
        "Utiliser les modèles : Cliquez sur le bouton \"Utiliser\" du modèle souhaité. Une page s'ouvre avec l'ordonnance complète, prête à l'emploi.",
        "Modifier un modèle : Sur la carte du modèle, cliquez sur le bouton orange \"Modifier\" pour mettre à jour le contenu.",
        "Créer un nouveau modèle : Cliquez sur \"+ Nouveau modèle\", renseignez l'identification, la description et les médicaments, puis validez avec \"Créer le modèle\".",
        "Conseil : Utilisez la barre de recherche en haut de page pour retrouver instantanément un modèle spécifique parmi votre liste.",
      ],
      calloutTone: "success",
      callout:
        "Un modèle bien documenté accélère la prescription future sans modifier les ordonnances déjà émises.",
    },
    {
      id: "template-pdf",
      title: "Configurer le template Ordonnance",
      intro:
        "La configuration du template Ordonnance permet d'adapter un PDF personnel au format d'impression de votre cabinet.",
      subtitle: "Utiliser un PDF personnel",
      steps: [
        "Ouvrez la popup \"Configurer le template Ordonnance\" depuis la page Ordonnances.",
        "Importez uniquement le PDF de fond ou le logo autorise par la configuration actuelle.",
        "Activez les champs presents sur le PDF et ajustez leur position dans l'aperçu.",
        "Enregistrez la configuration puis testez l'aperçu avant d'imprimer une ordonnance.",
      ],
      calloutTone: "warning",
      callout:
        "Vérifiez toujours l'aperçu final : les rectangles configurés utilisent les mêmes coordonnées que l'export PDF.",
    },
  ] as const;

  const articleLinks = [
    "Vue d’ensemble et statuts",
    "Actions (Impression, PDF)",
    "Utilisation et modification des modèles",
    "Création d'un modele personnalisé",
    "Configurer le template Ordonnance",
  ] as const;

  const articleLinkTargets: Record<(typeof articleLinks)[number], string> = {
    "Vue d’ensemble et statuts": "overview",
    "Actions (Impression, PDF)": "actions",
    "Utilisation et modification des modèles": "templates",
    "Création d'un modele personnalisé": "templates",
    "Configurer le template Ordonnance": "template-pdf",
  };

  const scrollToArticleSection = (targetId: string) => {
    const targetElement = document.getElementById(targetId);
    targetElement?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const relatedQuestions = [
    "Puis-je transformer une ordonnance manuelle en modèle ?",
    "Où sont stockées les ordonnances téléchargées ?",
    "Comment rechercher un modèle spécifique ?",
  ] as const;

  const faqAnswersByQuestion: Record<(typeof relatedQuestions)[number], string> = {
    "Puis-je transformer une ordonnance manuelle en modèle ?":
      "Pas directement, mais vous pouvez copier les éléments d'une ordonnance récente pour créer un nouveau modèle en moins de 30 secondes.",
    "Où sont stockées les ordonnances téléchargées ?":
      "Le fichier PDF est enregistré dans le dossier \"Téléchargements\" de votre appareil.",
    "Comment rechercher un modèle spécifique ?":
      "Utilisez la barre de recherche \"Rechercher un modèle...\" située en haut de la section pour filtrer par pathologie.",
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
            aria-labelledby="ordonnances-page-title"
          >
            <div className={patientsStyles.heroInner}>
              <div className={patientsStyles.heroText}>
                <h1
                  className={patientsStyles.heroTitle}
                  id="ordonnances-page-title"
                  style={{ fontSize: "clamp(1.15rem, 1.9vw, 1.6rem)" }}
                >
                  Ordonnances
                </h1>
                <p
                  className={patientsStyles.heroSubtitle}
                  style={{ marginTop: "0.8rem", fontSize: "clamp(0.8rem, 1.1vw, 1rem)" }}
                >
                  Prescriptions, modèles et historique
                </p>
              </div>
            </div>
          </section>

          <div className={styles.columns}>
            <section className={styles.articleColumn} aria-label="Guide ordonnances">
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
