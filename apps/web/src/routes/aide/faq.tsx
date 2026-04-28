import { CaretDown, MagnifyingGlass, Question, ArrowLeft, X } from "@phosphor-icons/react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useDeferredValue, useMemo, useState } from "react";
import headerTexture from "@/assets/figma/patients/fc145d0d9403ead31e8bc198dd8335751de59305.svg";
import patientsStyles from "@/components/patients/patients-page.module.css";

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
            "Absolument pas. L'IA de Doctor.com est un outil d'assistance à la prescription. Elle est là pour vous suggérer des molécules et vous alerter sur des contre-indications, mais le médecin reste le seul décisionnaire et responsable légal de l'ordonnance.",
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
          answer:
            "Sur la page de connexion, cliquez sur \"Mot de passe oublié ?\". Saisissez votre adresse e-mail professionnelle. Un e-mail de sécurité vous sera envoyé instantanément. Cliquez sur le bouton \"Réinitialiser mon mot de passe\" contenu dans l'e-mail pour réinitialiser votre accès.",
        },
        {
          id: "account-2",
          question: "Comment changer mon mot de passe ?",
          answer:
            "Allez dans Paramètres > section Sécurité. Cliquez sur le bouton bleu \"Changer le mot de passe\". Saisissez votre mot de passe actuel, puis le nouveau (minimum 8 caractères, incluant des chiffres et symboles). Validez pour appliquer le changement immédiatement.",
        },
        {
          id: "account-3",
          question: "doctor.com est-il accessible sur mobile ?",
          answer:
            "Oui. Doctor.com s'adapte parfaitement aux écrans de smartphones et de tablettes. Vous pouvez consulter vos rendez-vous ou le dossier d'un patient en déplacement directement depuis votre téléphone ou tablette.",
        },
        {
          id: "account-4",
          question: "Puis-je rester connecté sur plusieurs appareils ?",
          answer:
            "Oui, vous pouvez être connecté sur votre ordinateur de bureau et votre tablette simultanément. Cependant, pour des raisons de sécurité et de confidentialité des données de santé, nous vous conseillons de fermer votre session sur les appareils que vous n'utilisez plus activement.",
        },
        {
          id: "account-5",
          question: "Je n'ai plus accès à mon adresse e-mail de récupération, que faire ?",
          answer:
            "Contactez l'assistance technique car si vous ne pouvez plus accéder à la boîte mail liée à votre compte, vous ne pourrez pas recevoir le lien de réinitialisation.",
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
          answer:
            "Pour supprimer un patient, cliquez sur le bouton d'options (trois points) sur la carte du patient, puis sélectionnez \"Supprimer\". Une confirmation sera demandée pour éviter toute suppression accidentelle.",
        },
        {
          id: "patients-2",
          question: "L'assistant IA médical est-il fiable ?",
          answer:
            "L'IA de Doctor.com est un outil d'assistance à la prescription. Elle croise les médicaments suggérés avec les antécédents, allergies et traitements en cours pour générer des alertes de sécurité en temps réel. Cependant, le médecin reste le seul décisionnaire responsable de l'ordonnance.",
        },
        {
          id: "patients-3",
          question: "Puis-je fusionner deux dossiers patients en double ?",
          answer:
            "Actuellement, la fusion automatique de dossiers n'est pas disponible. Contactez l'équipe support pour gérer les cas de dossiers en double.",
        },
        {
          id: "patients-4",
          question: "Puis-je modifier un dossier après sa création ?",
          answer:
            "Oui, cliquez sur l'icône Crayon (orange) sur la carte du patient pour modifier n'importe quelle information.",
        },
        {
          id: "patients-5",
          question: "Comment l'IA utilise-t-elle les antécédents saisis ?",
          answer:
            "Lors de la création d'une ordonnance, l'IA croise les médicaments suggérés avec les antécédents et les allergies pour générer des alertes de sécurité en temps réel.",
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
          answer:
            "Cliquez directement sur la carte du rendez-vous dans l'agenda pour ouvrir les détails. Changez le statut en \"Annulé\" et validez pour mettre à jour votre planning. Le rendez-vous annulé reste visible dans l'historique du patient.",
        },
        {
          id: "agenda-2",
          question: "Peut-on programmer des rappels automatiques ?",
          answer:
            "Les rappels automatiques sont envoyés aux patients via leur e-mail et téléphone renseignés dans leur fiche. Ces notifications sont générées automatiquement selon les paramètres de votre cabinet.",
        },
        {
          id: "agenda-3",
          question: "Comment exporter ou imprimer l'agenda ?",
          answer:
            "Utilisez le bouton \"Imprimer\" ou \"Exporter\" en haut de votre agenda pour générer une version papier ou un fichier PDF de votre planning.",
        },
        {
          id: "agenda-4",
          question: "Comment voir mes rendez-vous à venir en un clin d'œil ?",
          answer:
            "Consultez la colonne \"Prochains rendez-vous\" à droite de votre agenda ou directement sur votre tableau de bord (Accueil).",
        },
        {
          id: "agenda-5",
          question: "Puis-je rechercher un rendez-vous spécifique ?",
          answer:
            "Oui, utilisez la barre de recherche en haut à droite pour filtrer par nom de patient ou type de consultation.",
        },
        {
          id: "agenda-6",
          question: "Comment retrouver rapidement le dossier d'un patient depuis l'agenda ?",
          answer:
            "Pour gagner du temps entre deux consultations, cliquez simplement sur le nom du patient (en bleu) à l'intérieur de sa carte de rendez-vous. L'application vous redirigera instantanément vers son profil complet.",
        },
        {
          id: "agenda-7",
          question: "Le mini-calendrier est-il toujours visible ?",
          answer:
            "Oui, le mini-calendrier à droite de l'écran reste toujours visible pour vous aider à trouver un créneau libre et naviguer rapidement entre les jours.",
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
          answer:
            "Oui. Cliquez sur la carte de l'ordonnance, puis cliquez sur le bouton \"Imprimer\" pour générer la version papier. Vous pouvez aussi la télécharger en PDF via le bouton \"Télécharger\".",
        },
        {
          id: "ordonnances-2",
          question: "Comment ajouter un médicament absent du catalogue ?",
          answer:
            "Si une référence est absente du catalogue de 8 333 médicaments, cliquez sur le bouton bleu \"+ Ajouter un médicament\" dans l'onglet Médicaments. Remplissez les champs obligatoires et les sections \"Informations Cliniques\" et \"Sécurité\" pour enrichir la base de données.",
        },
        {
          id: "ordonnances-3",
          question: "Puis-je transformer une ordonnance manuelle en modèle ?",
          answer:
            "Pas directement, mais vous pouvez copier les éléments d'une ordonnance récente pour créer un nouveau modèle en moins de 30 secondes.",
        },
        {
          id: "ordonnances-4",
          question: "Où sont stockées les ordonnances téléchargées ?",
          answer:
            "Le fichier PDF est enregistré dans le dossier \"Téléchargements\" de votre appareil.",
        },
        {
          id: "ordonnances-5",
          question: "Comment rechercher un modèle spécifique ?",
          answer:
            "Utilisez la barre de recherche \"Rechercher un modèle...\" située en haut de la section pour filtrer par pathologie.",
        },
      ],
    },
    {
      id: "accueil-dashboard",
      title: "Tableau de Bord",
      items: [
        {
          id: "accueil-1",
          question: "Puis-je modifier la période des graphiques ?",
          answer:
            "Oui, utilisez les filtres \"Par jour\", \"Par mois\" ou \"Par an\" situés en haut à droite du graphique principal pour adapter la vue à votre besoin d'analyse.",
        },
        {
          id: "accueil-2",
          question: "Les statistiques sont-elles mises à jour automatiquement ?",
          answer:
            "Absolument. Dès qu'un patient est ajouté ou qu'un rendez-vous est marqué comme \"Terminé\", les chiffres du tableau de bord s'actualisent instantanément.",
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
        {
          id: "medicaments-access-3",
          question: "Pourquoi remplir les contre-indications manuellement ?",
          answer:
            "Cela vous permet de personnaliser les alertes de sécurité selon vos protocoles cliniques et de garantir que l'IA se base sur des données que vous avez validées.",
        },
        {
          id: "medicaments-access-4",
          question: "Puis-je supprimer un médicament ajouté par erreur ?",
          answer:
            "Oui, utilisez l'icône Corbeille (orange) située sur la carte du médicament pour le retirer. Une confirmation vous sera demandée pour éviter toute suppression accidentelle.",
        },
        {
          id: "medicaments-access-5",
          question: "Comment retrouver tous mes antibiotiques ?",
          answer:
            "Sélectionnez simplement la catégorie \"Antibiotique\" dans le menu des filtres pour afficher l'ensemble des fiches liées.",
        },
      ],
    },
  ];

  const [openItemId, setOpenItemId] = useState("ai-prescription-1");
  const [searchValue, setSearchValue] = useState("");
  const deferredSearch = useDeferredValue(searchValue.trim());
  const isSearching = deferredSearch.length >= 2;

  function normalize(s: string) {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  const filteredGroups = useMemo(() => {
    if (!isSearching) return faqGroups;
    const q = normalize(deferredSearch);
    return faqGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => normalize(item.question).includes(q) || ("answer" in item && normalize(item.answer as string).includes(q)),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [deferredSearch, isSearching]);

  return (
    <div className={styles.pageShell}>
      <Sidebar currentUser={sidebarUser} />

      <main className={styles.pageMain}>
        <div className={styles.pageContent}>
          {/* ── Hero header ── */}
          <section
            className={patientsStyles.hero}
            style={{
              "--patients-hero-texture": `url(${headerTexture})`,
              marginLeft: "clamp(0.9rem, 2vw, 1.8rem)",
              marginRight: "clamp(0.9rem, 2vw, 1.8rem)",
              padding: "clamp(1.2rem, 2.5vw, 1.8rem) clamp(1rem, 2vw, 1.5rem)",
            } as any}
            aria-labelledby="faq-page-title"
          >
            <div className={patientsStyles.heroInner}>
              <div className={patientsStyles.heroText}>
                <h1
                  className={patientsStyles.heroTitle}
                  id="faq-page-title"
                  style={{ fontSize: "clamp(1.15rem, 1.9vw, 1.6rem)" }}
                >
                  Foire Aux Questions
                </h1>
                <p
                  className={patientsStyles.heroSubtitle}
                  style={{ marginTop: "0.8rem", fontSize: "clamp(0.8rem, 1.1vw, 1rem)" }}
                >
                  Toutes les réponses aux questions fréquentes
                </p>
              </div>

              {/* Search bar */}
              <div style={{ flexShrink: 0, position: "relative", width: "clamp(14rem, 24vw, 22rem)" }}>
                <MagnifyingGlass
                  size={16}
                  weight="bold"
                  aria-hidden="true"
                  style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "#173FB8", pointerEvents: "none" }}
                />
                <input
                  type="search"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Rechercher une question..."
                  aria-label="Rechercher dans la FAQ"
                  style={{
                    width: "100%",
                    height: "2.6rem",
                    borderRadius: "0.75rem",
                    border: "1.5px solid #C2E0EF",
                    background: "#ffffff",
                    color: "#0F3460",
                    fontFamily: "Inter, sans-serif",
                    fontSize: "0.86rem",
                    padding: `0 ${searchValue.length > 0 ? "2.2rem" : "0.9rem"} 0 2.3rem`,
                    outline: "none",
                    boxSizing: "border-box",
                    boxShadow: "0px 2px 6px rgba(118,187,221,0.1)",
                    transition: "border-color 0.18s ease, box-shadow 0.18s ease",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#76BBDD";
                    e.currentTarget.style.boxShadow = "inset 0 0 0 1px #76BBDD, 0px 2px 8px rgba(118,187,221,0.2)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#C2E0EF";
                    e.currentTarget.style.boxShadow = "0px 2px 6px rgba(118,187,221,0.1)";
                  }}
                />
                {searchValue.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSearchValue("")}
                    aria-label="Effacer la recherche"
                    style={{ position: "absolute", right: "0.6rem", top: "50%", transform: "translateY(-50%)", background: "#e8f3fb", border: "none", borderRadius: "999px", width: "1.2rem", height: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#4a6fa5", padding: 0 }}
                  >
                    <X size={10} weight="bold" />
                  </button>
                )}
              </div>
            </div>
          </section>

          <Link to="/aide" className={styles.backLink}>
            <ArrowLeft size={18} weight="bold" aria-hidden="true" />
            Retour aux catégories
          </Link>

          <section className={styles.faqCard} aria-label="Foire aux questions">
            <header className={styles.titleRow}>
              <Question size={18} weight="fill" className={styles.titleMark} aria-hidden="true" />
              <h1 className={styles.title}>
                {isSearching ? `Résultats pour "${deferredSearch}"` : "Foire Aux Questions"}
              </h1>
            </header>

            {isSearching && filteredGroups.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem", padding: "2.5rem 1rem", color: "#6b7e99" }}>
                <MagnifyingGlass size={28} weight="bold" style={{ color: "#b0cfe0" }} />
                <p style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "0.95rem", fontWeight: 700, color: "#0f3460" }}>
                  Aucun résultat
                </p>
                <p style={{ margin: 0, fontFamily: "Inter, sans-serif", fontSize: "0.82rem", textAlign: "center" }}>
                  Aucune question ne correspond à <strong>"{deferredSearch}"</strong>
                </p>
              </div>
            )}

            {filteredGroups.map((group) => (
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