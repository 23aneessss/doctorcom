import { CaretDown, Question, ArrowLeft } from "@phosphor-icons/react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Sidebar } from "@/components/sidebar";
import { requireSession } from "@/lib/require-session";
import styles from "./faq.module.css";

export const Route = createFileRoute("/aide/faq")({
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

  const faqGroups = [
    {
      id: "ai-prescription",
      title: "IA & Ordonnances",
      items: [
        {
          id: "ai-prescription-1",
          question: "Puis-je modifier une ordonnance générée par l'IA ?",
          answer:
            "Oui. L'IA propose une base que vous pouvez valider, modifier ou compléter manuellement avant l'impression finale.",
        },
        {
          id: "ai-prescription-2",
          question: "L'IA peut-elle remplacer mon diagnostic ?",
          answer:
            "Absolument pas. L'IA de Ductor est un outil d'assistance à la prescription. Elle est là pour vous suggérer des molécules et vous alerter sur des contre-indications, mais le médecin reste le seul décisionnaire et responsable légal de l'ordonnance.",
        },
        {
          id: "ai-prescription-3",
          question: "Comment l'IA détecte-t-elle les allergies ?",
          answer:
            "Elle croise en temps réel la molécule que vous saisissez avec les informations renseignées dans la fiche \"Antécédents\" et \"Allergies\" de votre patient.",
        },
      ],
    },
    {
      id: "account",
      title: "Connexion & Compte",
      items: [
        {
          id: "account-1",
          question: "Je n'arrive pas à me connecter, que faire ?",
        },
        {
          id: "account-2",
          question: "Comment changer mon mot de passe ?",
        },
        {
          id: "account-3",
          question: "doctor.com est-il accessible sur mobile ?",
        },
      ],
    },
    {
      id: "patients",
      title: "Patients",
      items: [
        {
          id: "patients-1",
          question: "Comment supprimer un patient ?",
        },
        {
          id: "patients-2",
          question: "L'assistant IA médical est-il fiable ?",
        },
        {
          id: "patients-3",
          question: "Puis-je fusionner deux dossiers patients en double ?",
        },
      ],
    },
    {
      id: "agenda",
      title: "Agenda & Rendez-vous",
      items: [
        {
          id: "agenda-1",
          question: "Un patient a annulé son RDV. Comment mettre à jour l'agenda ?",
        },
        {
          id: "agenda-2",
          question: "Peut-on programmer des rappels automatiques ?",
        },
        {
          id: "agenda-3",
          question: "Comment exporter ou imprimer l'agenda ?",
        },
      ],
    },
    {
      id: "ordonnances",
      title: "Ordonnances",
      items: [
        {
          id: "ordonnances-1",
          question: "Peut-on imprimer une ordonnance ?",
        },
        {
          id: "ordonnances-2",
          question: "Comment ajouter un médicament absent du catalogue ?",
        },
      ],
    },
    {
      id: "medicaments-access",
      title: "Médicaments & Accès",
      items: [
        {
          id: "medicaments-access-1",
          question: "Que faire si un médicament n'est pas dans la base des 8 333 références ?",
          answer:
            "Vous pouvez l'ajouter manuellement en quelques secondes via le bouton \"+ Ajouter un médicament\" dans l'onglet Médicaments.",
        },
        {
          id: "medicaments-access-2",
          question: "Puis-je utiliser Ductor.com sans connexion Internet ?",
          answer:
            "Oui. Ductor.com est une application qui fonctionne parfaitement hors ligne. Vous pouvez l'utiliser sans connexion internet.",
        },
      ],
    },
  ];

  const [openItemId, setOpenItemId] = useState("ai-prescription-1");

  return (
    <div className={styles.pageShell}>
      <Sidebar currentUser={sidebarUser} />

      <main className={styles.pageMain}>
        <div className={styles.pageContent}>
          <Link to="/aide" className={styles.backLink}>
            <ArrowLeft size={18} weight="bold" aria-hidden="true" />
            Retour aux categories
          </Link>

          <section className={styles.faqCard} aria-label="Foire aux questions">
            <header className={styles.titleRow}>
              <Question size={18} weight="fill" className={styles.titleMark} aria-hidden="true" />
              <h1 className={styles.title}>Foire Aux Questions</h1>
            </header>

            {faqGroups.map((group) => (
              <section className={styles.group} key={group.id}>
                <h2 className={styles.groupTitle}>{group.title}</h2>

                <ul className={styles.list}>
                  {group.items.map((item) => {
                    const answer = "answer" in item ? item.answer : undefined;
                    const hasAnswer = Boolean(answer);
                    const isOpen = openItemId === item.id && hasAnswer;
                    return (
                      <li
                        key={item.id}
                        id={item.id}
                        className={`${styles.item} ${isOpen ? styles.itemOpen : ""}`}
                      >
                        <button
                          type="button"
                          className={styles.questionButton}
                          disabled={!hasAnswer}
                          onClick={() => {
                            if (!hasAnswer) {
                              return;
                            }
                            setOpenItemId((current) => (current === item.id ? "" : item.id));
                          }}
                          aria-expanded={isOpen}
                          aria-disabled={!hasAnswer}
                        >
                          <span>{item.question}</span>
                          <CaretDown
                            size={16}
                            weight="bold"
                            className={`${styles.icon} ${isOpen ? styles.iconOpen : ""}`}
                            aria-hidden="true"
                          />
                        </button>

                        {answer ? (
                          <div
                            className={`${styles.answerWrap} ${isOpen ? styles.answerWrapOpen : ""}`}
                          >
                            <div className={styles.answerInner}>
                              <p className={styles.answer}>{answer}</p>
                            </div>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
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
