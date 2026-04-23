import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  CaretDown,
  CaretRight,
  CheckCircle,
  Warning,
} from "@phosphor-icons/react";
import drAdminHead from "@/assets/0849c953470bfbc456f6bb8378af8f0b2293e2d7.svg";
import drAdminBody from "@/assets/94439e37d5eda0beeaf04124bb2db2df0848c812.svg";
import drAdminDot from "@/assets/9eb00701539dafff1d15056cbd2a5cc50d99e8a3.svg";

import { Sidebar } from "@/components/sidebar";
import { requireSession } from "@/lib/require-session";
import styles from "./parametres.module.css";

export const Route = createFileRoute("/aide/parametres")({
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
      id: "profil",
      title: "Gerer votre profil et vos identifiants",
      intro: "L'onglet Parametres vous permet de maintenir vos informations professionnelles a jour pour garantir la validite des documents emis et par le cabinet.",
      subtitle: "Mettre a jour vos informations de contact",
      steps: [
        "Rendez-vous dans l'onglet Parametres via la barre laterale gauche.",
        "Dans la section Profil, modifiez votre nom, e-mail, numero de telephone ou l'adresse de votre cabinet.",
        "Preferences : utilisez le menu deroulant pour changer la langue de l'interface (francais, arabe, anglais, etc.).",
        "Cliquez sur Enregistrer les modifications pour valider.",
      ],
      calloutTone: "warning",
      callout:
        "Assurez-vous que votre adresse e-mail est correcte, car elle est le seul moyen de reinitialiser votre acces en cas d'oubli.",
    },
    {
      id: "securite",
      title: "Securite du compte",
      intro: "La protection des donnees de sante commence par un mot de passe robuste et regulierement renouvele.",
      subtitle: "Changer votre mot de passe",
      steps: [
        "Allez dans Parametres > section Securite.",
        "Cliquez sur le bouton bleu Changer le mot de passe.",
        "Saisissez votre mot de passe actuel, puis le nouveau (minimum 8 caracteres, incluant des chiffres et symboles).",
        "Validez pour appliquer le changement immediatement.",
      ],
      calloutTone: "warning",
      callout:
        "Si vous avez oublie votre mot de passe, cliquez sur Mot de passe oublie ? sous le formulaire de connexion.",
    },
    {
      id: "session",
      title: "Gestion de la session",
      intro: "Pour proteger la confidentialite des dossiers patients, il est crucial de fermer votre session lorsque vous quittez votre poste.",
      subtitle: "Se deconnecter de doctor.com",
      steps: [
        "Reperez l'icone de deconnexion situee tout en bas de votre barre laterale gauche.",
        "Cliquez sur le bouton Se deconnecter.",
        "Vous pouvez egalement effectuer cette action depuis l'onglet Parametres, tout en bas dans la section Session.",
      ],
      calloutTone: "success",
      callout:
        "Nous recommandons de vous deconnecter systematiquement a la fin de chaque journee de consultation.",
    },
    {
      id: "recuperation",
      title: "Recuperation du mot de passe",
      intro: "Pour reinitialiser votre cle d'acces et debloquer votre session, suivez les etapes de securisation ci-dessous.",
      subtitle: "Etapes de reinitialisation du mot de passe",
      steps: [
        "Sur la page de connexion de l'application, cliquez sur le lien Mot de passe oublie ? situe sous le formulaire.",
        "Saisissez l'adresse e-mail associee a votre compte (celle renseignee dans vos Parametres).",
        "Consultez votre messagerie : un e-mail de securite vous sera envoye instantanement.",
        "Cliquez sur le bouton Reinitialiser mon mot de passe contenu dans l'e-mail.",
      ],
      calloutTone: "success",
      callout:
        "Pour des raisons de securite, le lien de recuperation expire apres quelques minutes. Si vous ne recevez pas l'e-mail, verifiez votre dossier Courriers indesirables (Spams).",
    },
  ] as const;

  const articleLinks = [
    "Modifier vos informations de profil",
    "Changer votre mot de passe",
    "Se deconnecter de Doctor.com",
    "Recuperation du mot de passe oublie",
  ] as const;

  const relatedQuestions = [
    "Puis-je rester connecte sur plusieurs appareils ?",
    "Je n'ai plus acces a mon adresse e-mail de recuperation, que faire ?",
    "doctor.com est-il accessible sur mobile ?",
  ] as const;

  const faqAnswersByQuestion: Partial<Record<(typeof relatedQuestions)[number], string>> = {
    // Questions without mapped answers stay static, as requested.
  };

  const [openRelatedQuestion, setOpenRelatedQuestion] = useState<string>("");

  return (
    <div className={styles.pageShell}>
      <Sidebar currentUser={sidebarUser} />

      <main className={styles.pageMain}>
        <div className={styles.pageContent}>
          <section className={styles.topBar} aria-label="Contexte de navigation">
            <div className={styles.breadcrumbs}>
              <span className={styles.breadcrumbMuted}>Aide et Assistance</span>
              <CaretRight size={16} weight="bold" aria-hidden="true" />
              <span className={styles.breadcrumbCurrent}>Connexion & Acces</span>
            </div>
            <div className={styles.topUserWrap}>
              <div className={styles.topUserLogo} aria-hidden="true">
                <img className={styles.logoHead} src={drAdminHead} alt="" />
                <img className={styles.logoBody} src={drAdminBody} alt="" />
                <img className={styles.logoDot} src={drAdminDot} alt="" />
              </div>
              <div className={styles.topUser}>
                <p className={styles.topUserName}>{sidebarUser?.name ?? "Dr. tbib"}</p>
                <p className={styles.topUserRole}>Administrator</p>
              </div>
            </div>
          </section>

          <div className={styles.columns}>
            <section className={styles.articleColumn} aria-label="Guide parametres">
              <Link to="/aide" className={styles.backLink}>
                <ArrowLeft size={17} weight="bold" aria-hidden="true" />
                Retour aux categories
              </Link>

              {articleSections.map((section) => (
                <article key={section.id} className={styles.articleCard}>
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
                  <h3 className={styles.supportTitle}>Vous n'avez pas trouve votre reponse ?</h3>
                  <p className={styles.supportDescription}>
                    Notre equipe est disponible pour vous aider.
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
                      <button type="button" className={styles.sideLink}>
                        {item}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section className={styles.sideCard}>
                <h2 className={styles.sideTitle}>Questions lies</h2>
                <ul className={styles.sideList}>
                  {relatedQuestions.map((item) => {
                    const answer = faqAnswersByQuestion[item];
                    const hasAnswer = typeof answer === "string" && answer.length > 0;
                    const isOpen = hasAnswer && openRelatedQuestion === item;

                    if (!hasAnswer) {
                      return (
                        <li key={item}>
                          <button type="button" className={styles.sideLink}>
                            {item}
                          </button>
                        </li>
                      );
                    }

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

                        <div
                          className={`${styles.sideAnswerWrap} ${isOpen ? styles.sideAnswerWrapOpen : ""}`}
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