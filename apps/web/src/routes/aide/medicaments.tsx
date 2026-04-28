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

export const Route = createFileRoute("/aide/medicaments")({
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
      id: "recherche",
      title: "Rechercher et Filtrer",
      intro:
        "Trouvez instantanément la molécule ou le produit dont vous avez besoin.",
      subtitle: "Rechercher un médicament",
      steps: [
        "Par texte : Utilisez la barre de recherche pour une DCI (Dénomination Commune Internationale) ou un nom commercial.",
        "Par index : Cliquez sur une lettre (ex : \"B\") pour lister tous les produits correspondants par ordre alphabétique.",
        "Par catégorie : Utilisez le menu déroulant à droite pour filtrer par famille thérapeutique (ex : Antibiotique, Antihypertenseur).",
      ],
      calloutTone: "success",
      callout:
        "La combinaison de recherche, d'index alphabétique et de filtres réduit considérablement le temps nécessaire pour accéder à une fiche.",
    },
    {
      id: "base",
      title: "Enrichir la base de données",
      intro:
        "Ductor.com vous permet de devenir l'éditeur de votre propre base de connaissances médicales.",
      subtitle: "Consulter et Modifier une fiche",
      steps: [
        "Cliquez sur \"Voir\" (pour consulter) ou sur l'icône \"Crayon\" orange (pour modifier) afin d’accéder aux détails du médicament.",
        "Classification : Définissez la famille, le nom générique et la forme (Comprimé, Sirop, etc.).",
        "Posologie : Renseignez les doses adultes/enfants et la fréquence d'administration.",
        "Informations Cliniques : Saisissez les indications, contre-indications et précautions d'emploi.",
        "Sécurité : Précisez les risques liés à la grossesse ou à l'allaitement.",
      ],
      calloutTone: "warning",
      callout:
        "Une fiche riche en détails cliniques permet à l'Assistant IA de générer des alertes de sécurité plus précises lors des prescriptions.",
    },
    {
      id: "ajout",
      title: "Ajouter un nouveau médicament",
      intro:
        "Complétez la base lorsque la référence recherchée n'existe pas encore.",
      subtitle: "Procédure d'ajout",
      steps: [
        "Si une référence est absente du catalogue (8 333 références initiales), cliquez sur le bouton bleu \"+ Ajouter un médicament\".",
        "Remplissez les champs obligatoires (Nom, Catégorie, Dosage).",
        "Plus vous complétez les sections \"Informations Cliniques\" et \"Sécurité\", plus l'IA sera capable de vous alerter efficacement lors d'une future ordonnance.",
        "Note : Nous vous encourageons vivement à vérifier et compléter les fiches des molécules que vous prescrivez le plus fréquemment.",
      ],
      calloutTone: "success",
      callout:
        "Une base de données détaillée aide l'Assistant IA à fournir des alertes de sécurité plus fines et plus fiables.",
    },
  ] as const;

  const articleLinks = [
    "Utilisation de la recherche",
    "Consulter et modifier une fiche de médicament",
    "Ajout d’un médicament manquant à la base",
  ] as const;

  const articleLinkTargets: Record<(typeof articleLinks)[number], string> = {
    "Utilisation de la recherche": "recherche",
    "Consulter et modifier une fiche de médicament": "base",
    "Ajout d’un médicament manquant à la base": "ajout",
  };

  const scrollToArticleSection = (targetId: string) => {
    const targetElement = document.getElementById(targetId);
    targetElement?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const relatedQuestions = [
    "Pourquoi remplir les contre-indications manuellement ?",
    "Puis-je supprimer un médicament ajouté par erreur ?",
    "Comment retrouver tous mes antibiotiques ?",
  ] as const;

  const faqAnswersByQuestion: Record<(typeof relatedQuestions)[number], string> = {
    "Pourquoi remplir les contre-indications manuellement ?":
      "Cela vous permet de personnaliser les alertes de sécurité selon vos protocoles cliniques et de garantir que l'IA se base sur des données que vous avez validées.",
    "Puis-je supprimer un médicament ajouté par erreur ?":
      "Oui, utilisez l'icône Corbeille (orange) située sur la carte du médicament pour le retirer. Une confirmation vous sera demandée pour éviter toute suppression accidentelle.",
    "Comment retrouver tous mes antibiotiques ?":
      "Sélectionnez simplement la catégorie \"Antibiotique\" dans le menu des filtres pour afficher l'ensemble des fiches liées.",
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
            aria-labelledby="medicaments-page-title"
          >
            <div className={patientsStyles.heroInner}>
              <div className={patientsStyles.heroText}>
                <h1
                  className={patientsStyles.heroTitle}
                  id="medicaments-page-title"
                  style={{ fontSize: "clamp(1.15rem, 1.9vw, 1.6rem)" }}
                >
                  Médicaments
                </h1>
                <p
                  className={patientsStyles.heroSubtitle}
                  style={{
                    marginTop: "0.8rem",
                    fontSize: "clamp(0.8rem, 1.1vw, 1rem)",
                  }}
                >
                  Catalogue, recherche et enrichissement des fiches
                </p>
              </div>
            </div>
          </section>

          <div className={styles.columns}>
            <section className={styles.articleColumn} aria-label="Guide medicaments">
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
