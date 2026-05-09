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

export const Route = createFileRoute("/aide/patients")({
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
      id: "creation",
      title: "Créer un nouveau dossier patient",
      intro: "La création d'une fiche patient est la première étape pour assurer un suivi médical de qualité sur Doctor.com. Le processus se fait en 4 ou 5 étapes selon le genre du patient.",
      subtitle: "Accès rapide",
      steps: [
        "Tableau de bord : Utilisez le widget \"Actions Rapides\" et cliquez sur \"+ Ajouter un patient\".",
        "Barre latérale : Dans la section Patients, cliquez sur le bouton bleu \"+ Ajouter un patient\" en haut à droite.",
      ],
      calloutTone: "success",
      callout:
        "Plus rapide, plus simple : accédez à la création patient en moins d'une seconde depuis n'importe quelle vue.",
    },
    {
      id: "etapes",
      title: "Le processus de création (étape par étape)",
      intro: "Suivez ces étapes pour créer une fiche complète et sécurisée.",
      subtitle: "Informations essentielles",
      steps: [
        "Identité : Nom, Prénom, Genre.",
        "Naissance : Date (JJ/MM/AAAA) et Lieu.",
        "Contact : Téléphone et E-mail (cruciaux pour les rappels de rendez-vous).",
        "Administratif : NSS (Numéro de Sécurité Sociale) et Nationalité.",
      ],
      calloutTone: "warning",
      callout:
        "Assurez-vous que l'e-mail et le numéro de téléphone sont corrects pour que les notifications de rendez-vous parviennent au patient.",
    },
    {
      id: "antecedents",
      title: "Antécédents médicaux",
      intro: "Documentez l'historique médical complet du patient pour des prescriptions sécurisées.",
      subtitle: "Collecte des antécédents",
      steps: [
        "Groupe Sanguin : Sélectionnez-le dans le menu déroulant.",
        "Antécédents Personnels : Cliquez sur \"+ Ajouter un antécédent\".",
        "Case \"Maladie active\" : Cochez cette case si le patient souffre encore de cette pathologie (ex : diabète). Si la maladie est guérie (ex : ancienne hépatite), laissez la case décochée pour la garder en historique.",
        "Antécédents Familiaux : Précisez le lien de parenté (ex : Père / Hypertension).",
        "Pour les Hommes : Un champ spécifique apparaît pour l'Âge de circoncision.",
      ],
      calloutTone: "success",
      callout:
        "Les antécédents corrects sont cruciaux pour que l'IA détecte les contre-indications et allergies lors de la prescription.",
    },
    {
      id: "traitements",
      title: "Traitements en cours & Vaccinations",
      intro: "Enregistrez les médicaments actuels et l'historique vaccinal du patient.",
      subtitle: "Gestion des traitements",
      steps: [
        "Médicaments : Ajoutez les molécules, la posologie et l'indication. Cochez \"Maladie active\" pour les traitements de fond.",
        "Vaccinations : Enregistrez le nom du vaccin et la date de la dernière injection.",
      ],
      calloutTone: "success",
      callout:
        "Maintenir à jour la liste des vaccinations aide à identifier rapidement les patients à risque lors d'épidémies.",
    },
    {
      id: "feminin",
      title: "Santé féminine (Spécifique aux femmes)",
      intro: "Collectez les informations pertinentes pour le suivi gynécologique et obstétrique.",
      subtitle: "Informations essentielles",
      steps: [
        "Suivi : Âge de la ménarche, régularité du cycle, contraception.",
        "Obstétrique : Nombre de grossesses et de césariennes. Cochez \"Patiente ménopausée\" si applicable.",
      ],
      calloutTone: "success",
      callout:
        "Ces données sont essentielles pour adapter les prescriptions et identifier les contre-indications liées au statut gynécologique.",
    },
    {
      id: "social",
      title: "Informations sociales & Mode de vie (Optionnel)",
      intro: "Documentez les facteurs sociaux et comportementaux qui influencent la santé du patient.",
      subtitle: "Détails du mode de vie",
      steps: [
        "Mode de vie : Logement, situation familiale, revenus, profession.",
        "Habitudes : Activité physique, habitudes toxiques (tabac, alcool), environnement (animaux).",
        "Note : Cette étape n'est pas obligatoire. Vous pouvez valider le dossier immédiatement si vous manquez de temps.",
      ],
      calloutTone: "success",
      callout:
        "Cliquez sur \"Enregistrer et Ajouter\" pour créer définitivement la fiche patient.",
    },
    {
      id: "suivis",
      title: "Suivis patient",
      intro:
        "Les suivis regroupent les symptomes, hypotheses diagnostiques et consultations liees a un meme probleme de sante.",
      subtitle: "Creer ou modifier un suivi",
      steps: [
        "Depuis le dossier patient, utilisez l'action rapide \"Ajouter suivi\".",
        "Ajoutez au moins un symptome, puis completez l'hypothese diagnostique et l'historique si necessaire.",
        "La date d'ouverture permet de suivre l'evolution du probleme dans le temps.",
        "Un suivi peut ensuite etre relie a des consultations, documents, traitements et ordonnances.",
      ],
      calloutTone: "success",
      callout:
        "Un suivi bien renseigne donne plus de contexte a l'assistant IA et facilite les prescriptions futures.",
    },
    {
      id: "consultations",
      title: "Consultations",
      intro:
        "La consultation formalise l'examen realise pendant un rendez-vous et garde une trace medicale exploitable.",
      subtitle: "Enregistrer une consultation",
      steps: [
        "Utilisez \"Ajouter consultation\" depuis les actions rapides ou demarrez la session depuis l'onglet RDV.",
        "Associez la consultation a un suivi et a un rendez-vous lorsque c'est possible.",
        "Renseignez les constantes, l'examen clinique, le diagnostic et les observations utiles.",
        "Validez pour conserver la consultation dans le dossier patient.",
      ],
      calloutTone: "warning",
      callout:
        "Une ordonnance doit etre rattachee a un rendez-vous termine pour garder une chronologie medicale propre.",
    },
    {
      id: "documents",
      title: "Documents patient",
      intro:
        "Les documents patient centralisent les pieces importees pendant ou apres une consultation.",
      subtitle: "Importer et verifier un document",
      steps: [
        "Cliquez sur \"Ajouter documents\" dans les actions rapides du dossier patient.",
        "Importez un PDF, une image ou un document medical compatible.",
        "Donnez un nom clair au document pour le retrouver rapidement.",
        "Utilisez l'analyse apres import lorsque le document doit etre verifie ou rattache au contexte patient.",
      ],
      calloutTone: "success",
      callout:
        "Conserver les documents dans le dossier patient evite de perdre les bilans, comptes rendus et pieces justificatives.",
    },
    {
      id: "vaccinations",
      title: "Vaccinations",
      intro:
        "La fiche vaccination permet de suivre les injections deja realisees et les rappels utiles.",
      subtitle: "Ajouter une vaccination",
      steps: [
        "Ouvrez l'onglet Vaccinations ou utilisez l'action correspondante dans le dossier patient.",
        "Indiquez le vaccin, la date d'administration et les remarques utiles.",
        "Verifiez la date avant l'enregistrement pour conserver un historique fiable.",
      ],
      calloutTone: "success",
      callout:
        "Un historique vaccinal a jour aide a prendre de meilleures decisions lors des suivis et voyages.",
    },
    {
      id: "voyages",
      title: "Voyages",
      intro:
        "La rubrique Voyages rassemble les destinations et risques sanitaires a anticiper pour le patient.",
      subtitle: "Preparer un voyage",
      steps: [
        "Ajoutez le pays ou la destination, les dates et les remarques sanitaires.",
        "Consultez les epidemies et recommandations liees a la destination.",
        "Reliez les conseils de prevention, vaccinations et traitements necessaires au dossier patient.",
      ],
      calloutTone: "warning",
      callout:
        "Les informations de voyage doivent etre mises a jour lorsque la destination ou les dates changent.",
    },
  ] as const;

  const articleLinks = [
    "Accès à la création patient",
    "Suivis patient",
    "Consultations",
    "Documents patient",
    "Vaccinations",
    "Voyages",
  ] as const;

  const articleLinkTargets: Record<(typeof articleLinks)[number], string> = {
    "Accès à la création patient": "creation",
    "Suivis patient": "suivis",
    "Consultations": "consultations",
    "Documents patient": "documents",
    "Vaccinations": "vaccinations",
    "Voyages": "voyages",
  };

  const scrollToArticleSection = (targetId: string) => {
    const targetElement = document.getElementById(targetId);
    targetElement?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const relatedQuestions = [
    "Puis-je modifier un dossier après sa création ?",
    "Comment l'IA utilise-t-elle les antécédents saisis ?",
  ] as const;

  const faqAnswersByQuestion: Record<(typeof relatedQuestions)[number], string> = {
    "Puis-je modifier un dossier après sa création ?":
      "Oui, cliquez sur l'icône Crayon (orange) sur la carte du patient pour modifier n'importe quelle information.",
    "Comment l'IA utilise-t-elle les antécédents saisis ?":
      "Lors de la création d'une ordonnance, l'IA croise les médicaments suggérés avec les antécédents et les allergies pour générer des alertes de sécurité en temps réel.",
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
            aria-labelledby="patients-page-title"
          >
            <div className={patientsStyles.heroInner}>
              <div className={patientsStyles.heroText}>
                <h1
                  className={patientsStyles.heroTitle}
                  id="patients-page-title"
                  style={{ fontSize: "clamp(1.15rem, 1.9vw, 1.6rem)" }}
                >
                  Patients
                </h1>
                <p
                  className={patientsStyles.heroSubtitle}
                  style={{
                    marginTop: "0.8rem",
                    fontSize: "clamp(0.8rem, 1.1vw, 1rem)",
                  }}
                >
                  Dossiers, fiches et assistant IA médical
                </p>
              </div>
            </div>
          </section>

          <div className={styles.columns}>
            <section className={styles.articleColumn} aria-label="Guide patients">
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
