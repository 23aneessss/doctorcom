import { createFileRoute, Link } from "@tanstack/react-router";
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
  X,
} from "@phosphor-icons/react";
import { useDeferredValue, useMemo, useState } from "react";
import headerTexture from "@/assets/figma/patients/fc145d0d9403ead31e8bc198dd8335751de59305.svg";
import patientsStyles from "@/components/patients/patients-page.module.css";

import { Sidebar } from "@/components/sidebar";
import { requireSession } from "@/lib/require-session";

function CalendarAgendaIcon() {
  return (
    <svg width="20" height="18.75" viewBox="0 0 22 20.625" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.875 1.375H22V20.625H0V1.375H4.125V0H5.5V1.375H16.5V0H17.875V1.375ZM4.125 2.75H1.375V5.5H20.625V2.75H17.875V4.125H16.5V2.75H5.5V4.125H4.125V2.75ZM1.375 19.25H20.625V6.875H1.375V19.25ZM4.125 11V9.625H17.875V11H4.125ZM4.125 15.125V13.75H17.875V15.125H4.125Z" fill="currentColor" />
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

const SECTION_CARDS = [
  { id: "accueil", title: "Accueil", description: "Statistiques, KPIs et actions rapides.", icon: <House size={20} weight="fill" />, href: "/aide/accueil" },
  { id: "parametres", title: "Paramètres", description: "Connexion, mot de passe et récupération de compte.", icon: <GearSix size={20} weight="fill" />, href: "/aide/parametres" },
  { id: "patients", title: "Patients", description: "Dossiers, fiches et assistant IA médical.", icon: <User size={20} weight="fill" />, href: "/aide/patients" },
  { id: "agenda", title: "Agenda & Rendez-vous", description: "Planification, modification et statuts.", icon: <CalendarAgendaIcon />, href: "/aide/agenda-rendez-vous" },
  { id: "ordonnances", title: "Ordonnances", description: "Création, impression et suivi des prescriptions.", icon: <Note size={20} weight="fill" />, href: "/aide/ordonnances" },
  { id: "medicaments", title: "Médicaments", description: "Catalogue, prescriptions et statistiques.", icon: <Pill size={20} weight="fill" />, href: "/aide/medicaments" },
] as const;

const ALL_QUESTIONS = [
  { id: "q-conn-1", section: "Paramètres", question: "Je n'arrive pas à me connecter, que faire ?", answer: "Sur la page de connexion, cliquez sur \"Mot de passe oublié ?\", saisissez votre e-mail professionnelle puis suivez le lien de réinitialisation reçu par e-mail." },
  { id: "q-conn-2", section: "Paramètres", question: "Comment modifier mon mot de passe ?", answer: "Allez dans Paramètres > Sécurité, cliquez sur \"Changer le mot de passe\", puis validez votre nouveau mot de passe (minimum 8 caractères)." },
  { id: "q-conn-3", section: "Paramètres", question: "Comment récupérer mon compte ?", answer: "Utilisez l'option \"Mot de passe oublié ?\" sur l'écran de connexion. Si vous n'avez plus accès à votre e-mail, contactez le support pour vérification." },
  { id: "q-conn-4", section: "Paramètres", question: "Y a-t-il une version mobile de Doctor.com ?", answer: "Oui, Doctor.com est disponible en application mobile, ce qui vous permet de consulter vos rendez-vous et d'avoir la liste complète des médicaments sous la main. " },
  { id: "q-pat-1", section: "Patients", question: "Comment créer un nouveau dossier patient ?", answer: "Depuis le tableau de bord, utilisez le widget \"Actions Rapides\" et cliquez sur \"+ Ajouter un patient\". Vous pouvez aussi utiliser le bouton en haut à droite de la section Patients." },
  { id: "q-pat-2", section: "Patients", question: "Puis-je modifier un dossier après sa création ?", answer: "Oui, cliquez sur l'icône Crayon (orange) sur la carte du patient pour modifier n'importe quelle information." },
  { id: "q-pat-3", section: "Patients", question: "Comment supprimer un patient ?", answer: "Cliquez sur le bouton d'options sur la carte du patient, puis sélectionnez \"Supprimer\". Une confirmation sera demandée pour éviter toute suppression accidentelle." },
  { id: "q-pat-4", section: "Patients", question: "L'assistant IA médical est-il fiable ?", answer: "L'IA de Doctor.com est un outil d'assistance à la prescription. Elle croise les médicaments suggérés avec les antécédents et allergies pour générer des alertes de sécurité en temps réel." },
  { id: "q-agenda-1", section: "Agenda", question: "Comment créer un nouveau rendez-vous ?", answer: "Cliquez sur le bouton bleu \"+ Ajouter un RDV\" en haut à droite de votre écran Agenda, puis remplissez les informations du patient, la date et le type de consultation." },
  { id: "q-agenda-2", section: "Agenda", question: "Comment annuler un rendez-vous ?", answer: "Cliquez sur la carte du rendez-vous dans l'agenda, changez le statut en \"Annulé\" et validez. Le rendez-vous annulé reste visible dans l'historique du patient." },
  { id: "q-agenda-3", section: "Agenda", question: "Comment voir mes rendez-vous à venir ?", answer: "Consultez la colonne \"Prochains rendez-vous\" à droite de votre agenda ou directement sur votre tableau de bord (Accueil)." },
  { id: "q-ordo-1", section: "Ordonnances", question: "Puis-je modifier une ordonnance générée par l'IA ?", answer: "Oui. L'IA propose une base que vous pouvez valider, modifier ou compléter manuellement avant l'impression finale." },
  { id: "q-ordo-2", section: "Ordonnances", question: "Comment imprimer ou télécharger une ordonnance ?", answer: "Cliquez sur la carte de l'ordonnance, puis utilisez le bouton \"Imprimer\" pour la version papier ou \"Télécharger\" pour exporter en PDF." },
  { id: "q-ordo-3", section: "Ordonnances", question: "Comment utiliser un modèle d'ordonnance ?", answer: "Cliquez sur le bouton \"Utiliser\" du modèle souhaité. Une page s'ouvre avec l'ordonnance complète, prête à l'emploi." },
  { id: "q-med-1", section: "Médicaments", question: "Comment rechercher un médicament ?", answer: "Utilisez la barre de recherche pour une DCI ou un nom commercial, ou cliquez sur une lettre de l'index alphabétique. Le menu déroulant permet de filtrer par famille thérapeutique." },
  { id: "q-med-2", section: "Médicaments", question: "Que faire si un médicament est absent du catalogue ?", answer: "Cliquez sur le bouton bleu \"+ Ajouter un médicament\". Remplissez les champs obligatoires et les sections \"Informations Cliniques\" et \"Sécurité\"." },
  { id: "q-med-3", section: "Médicaments", question: "Puis-je supprimer un médicament ajouté par erreur ?", answer: "Oui, utilisez l'icône Corbeille (orange) sur la carte du médicament. Une confirmation vous sera demandée." },
  { id: "q-acc-1", section: "Accueil", question: "Puis-je modifier la période des graphiques ?", answer: "Oui, utilisez les filtres \"Par jour\", \"Par mois\" ou \"Par an\" situés en haut à droite du graphique principal." },
  { id: "q-acc-2", section: "Accueil", question: "Les statistiques sont-elles mises à jour automatiquement ?", answer: "Absolument. Dès qu'un patient est ajouté ou qu'un rendez-vous est marqué comme \"Terminé\", les chiffres du tableau de bord s'actualisent instantanément." },
  { id: "q-support", section: "Aide", question: "Comment contacter le support rapidement ?", answer: "Utilisez le bouton \"Contacter le support\" en bas de la page Aide pour joindre rapidement l'équipe d'assistance." },
];

const FEATURED_QUESTIONS = ALL_QUESTIONS.slice(0, 4);

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const sessionUser = session?.data?.user;
  const sidebarUser =
    sessionUser && typeof sessionUser.email === "string"
      ? { name: sessionUser.name?.trim() || sessionUser.email, email: sessionUser.email, avatarUrl: sessionUser.image ?? undefined }
      : undefined;

  const [searchValue, setSearchValue] = useState("");
  const [openQuestionId, setOpenQuestionId] = useState<string>(FEATURED_QUESTIONS[0]?.id ?? "");
  const deferredSearch = useDeferredValue(searchValue.trim());

  const isSearching = deferredSearch.length >= 2;

  const filteredCards = useMemo(() => {
    if (!isSearching) return SECTION_CARDS;
    const q = normalize(deferredSearch);
    return SECTION_CARDS.filter((c) => normalize(c.title).includes(q) || normalize(c.description).includes(q));
  }, [deferredSearch, isSearching]);

  const filteredQuestions = useMemo(() => {
    if (!isSearching) return FEATURED_QUESTIONS;
    const q = normalize(deferredSearch);
    return ALL_QUESTIONS.filter((item) => normalize(item.question).includes(q) || normalize(item.answer).includes(q));
  }, [deferredSearch, isSearching]);

  const hasResults = filteredCards.length > 0 || filteredQuestions.length > 0;

  return (
    <div className={patientsStyles.pageShell}>
      <Sidebar currentUser={sidebarUser} />

      <main className={patientsStyles.pageMain}>
        <div className={patientsStyles.pageContent}>

          {/* ── Hero header with search ── */}
          <section
            className={patientsStyles.hero}
            style={{
              "--patients-hero-texture": `url(${headerTexture})`,
            } as any}
            aria-labelledby="aide-page-title"
          >
            <div className={patientsStyles.heroInner}>
              <div className={patientsStyles.heroText}>
                <h1
                  className={patientsStyles.heroTitle}
                  id="aide-page-title"
                >
                  Aide &amp; Assistance
                </h1>
                <p
                  className={patientsStyles.heroSubtitle}
                >
                  Guides, FAQ et support technique
                </p>
              </div>

              {/* Search bar — right side, where action buttons go in other hero headers */}
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
                  placeholder="Rechercher..."
                  aria-label="Rechercher dans l'aide"
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

          {/* ── Search results view ── */}
          {isSearching ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem" }}>

              {!hasResults ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem", padding: "3rem 2rem", borderRadius: "14px", border: "1px solid #d8edf7", background: "#ffffff" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "3rem", height: "3rem", borderRadius: "999px", background: "#f0f7ff", color: "#7aaec8" }}>
                    <MagnifyingGlass size={22} weight="bold" />
                  </span>
                  <p style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "1rem", fontWeight: 700, color: "#0f3460" }}>Aucun résultat trouvé</p>
                  <p style={{ margin: 0, fontFamily: "Inter, sans-serif", fontSize: "0.85rem", color: "#6b7e99", textAlign: "center" }}>
                    Aucune rubrique ou question ne correspond à <strong>"{deferredSearch}"</strong>
                  </p>
                </div>
              ) : (
                <>
                  {filteredCards.length > 0 && (
                    <div>
                      <p style={{ margin: "0 0 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#7aaec8" }}>
                        Rubriques — {filteredCards.length}
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.9rem" }}>
                        {filteredCards.map((card) => (
                          <SectionCard key={card.id} card={card} />
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredQuestions.length > 0 && (
                    <div>
                      <p style={{ margin: "0 0 0.75rem", fontFamily: "Inter, sans-serif", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#7aaec8" }}>
                        Questions — {filteredQuestions.length}
                      </p>
                      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                        {filteredQuestions.map((item) => (
                          <QuestionItem
                            key={item.id}
                            item={item}
                            isOpen={openQuestionId === item.id}
                            showSection
                            onToggle={() => setOpenQuestionId((c) => (c === item.id ? "" : item.id))}
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              {/* ── 6 section cards ── */}
              <section
                aria-label="Rubriques d'aide"
                style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.9rem" }}
              >
                {SECTION_CARDS.map((card) => (
                  <SectionCard key={card.id} card={card} />
                ))}
              </section>

              {/* ── FAQ section ── */}
              <section
                style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
                aria-label="Questions fréquentes"
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "1.75rem", height: "1.75rem", borderRadius: "8px", background: "#eef4ff", border: "1px solid #c2d4f8", color: "#052CA0" }}>
                      <Question size={13} weight="bold" aria-hidden="true" />
                    </span>
                    <h2 style={{ margin: 0, color: "#052ca0", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "clamp(1rem, 1.5vw, 1.15rem)", fontWeight: 700 }}>
                      Questions fréquentes
                    </h2>
                  </div>
                  <Link
                    to="/aide/faq"
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontFamily: "Inter, sans-serif", fontSize: "0.82rem", fontWeight: 600, color: "#052CA0", textDecoration: "none", whiteSpace: "nowrap" }}
                  >
                    Voir tout <ArrowRight size={12} weight="bold" />
                  </Link>
                </div>

                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {FEATURED_QUESTIONS.map((item) => (
                    <QuestionItem
                      key={item.id}
                      item={item}
                      isOpen={openQuestionId === item.id}
                      showSection={false}
                      onToggle={() => setOpenQuestionId((c) => (c === item.id ? "" : item.id))}
                    />
                  ))}
                </ul>
              </section>

              {/* ── Support section ── */}
              <section
                style={{
                  marginBottom: "clamp(1rem, 2vw, 1.5rem)",
                  borderRadius: "14px",
                  border: "0.8px solid #c2e0ef",
                  background: "#ffffff",
                  padding: "clamp(1rem, 1.8vw, 1.4rem) clamp(1.2rem, 2vw, 1.6rem)",
                  display: "flex",
                  flexWrap: "wrap" as const,
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  boxShadow: "0px 4px_6px_0px rgba(118,187,221,0.2),0px 2px 4px 0px rgba(118,187,221,0.2)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "2.4rem", height: "2.4rem", flexShrink: 0, borderRadius: "10px", background: "#eef4ff", border: "1px solid #c2d4f8", color: "#052ca0" }}>
                    <MagnifyingGlass size={16} weight="bold" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 style={{ margin: 0, color: "#0f3460", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "clamp(0.88rem, 1.25vw, 1rem)", fontWeight: 700, lineHeight: 1.35 }}>
                      Vous n'avez pas trouvé votre réponse ?
                    </h3>
                    <p style={{ margin: "0.25rem 0 0", color: "#6b7e99", fontFamily: "Inter, sans-serif", fontSize: "clamp(0.76rem, 1vw, 0.86rem)", lineHeight: 1.4 }}>
                      Notre équipe est disponible du lundi au vendredi pour vous aider.
                    </p>
                  </div>
                </div>
                <SupportButton />
              </section>
            </>
          )}

        </div>
      </main>

    </div>
  );
}

function SectionCard({ card }: { card: typeof SECTION_CARDS[number] }) {
  const [hovered, setHovered] = useState(false);
  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: "14px",
        border: hovered ? "0.8px solid #76bbdd" : "0.8px solid #c2e0ef",
        background: hovered ? "#f8fafc" : "#ffffff",
        boxShadow: hovered
          ? "0px 6px 16px -6px rgba(118,187,221,0.35)"
          : "0px 4px 6px 0px rgba(118,187,221,0.2),0px 2px 4px 0px rgba(118,187,221,0.2)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        transition: "transform 200ms ease-out, box-shadow 200ms ease-out, border-color 200ms ease-out, background 200ms ease-out",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", padding: "18px 18px 14px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "38px", height: "38px", flexShrink: 0, borderRadius: "10px", background: "#052ca0", color: "#ffffff", boxShadow: "0px 4px 10px rgba(5,44,160,0.22)" }}>
          {card.icon}
        </span>
        <div>
          <h2 style={{ margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "14.5px", fontWeight: 700, lineHeight: 1.3, color: "#0f3460" }}>
            {card.title}
          </h2>
          <p style={{ margin: "4px 0 0", fontFamily: "Inter, sans-serif", fontSize: "12px", fontWeight: 400, lineHeight: 1.5, color: "#6b7e99" }}>
            {card.description}
          </p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", borderTop: "0.8px solid #e8f3fb", padding: "9px 18px" }}>
        <Link
          to={card.href}
          style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "12px", fontWeight: 700, color: "#052ca0", textDecoration: "none" }}
        >
          Explorer <ArrowRight size={12} weight="bold" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function QuestionItem({
  item,
  isOpen,
  showSection,
  onToggle,
}: {
  item: (typeof ALL_QUESTIONS)[number];
  isOpen: boolean;
  showSection: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      style={{
        borderRadius: "10px",
        border: isOpen ? "0.8px solid #76bbdd" : "0.8px solid #c2e0ef",
        background: isOpen ? "#f8fafc" : "#ffffff",
        overflow: "hidden",
        boxShadow: isOpen ? "0px 4px 6px 0px rgba(118,187,221,0.2)" : "none",
        transition: "border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease",
      }}
    >
      <button
        type="button"
        style={{ width: "100%", border: 0, background: "transparent", color: isOpen ? "#052ca0" : "#0f3460", minHeight: "2.8rem", padding: "0.75rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", textAlign: "left", fontFamily: "Inter, sans-serif", fontSize: "0.865rem", fontWeight: 600, cursor: "pointer" }}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
          {showSection && (
            <span style={{ flexShrink: 0, display: "inline-flex", height: "1.25rem", alignItems: "center", borderRadius: "6px", background: "#eef4ff", border: "1px solid #c2d4f8", padding: "0 0.5rem", fontFamily: "Inter, sans-serif", fontSize: "10.5px", fontWeight: 600, color: "#052ca0", whiteSpace: "nowrap" }}>
              {item.section}
            </span>
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.question}</span>
        </span>
        <CaretDown
          size={15}
          weight="bold"
          aria-hidden="true"
          style={{ flexShrink: 0, color: isOpen ? "#052ca0" : "#7aaec8", transition: "transform 0.24s cubic-bezier(0.22,1,0.36,1)", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>
      <div style={{ display: "grid", gridTemplateRows: isOpen ? "1fr" : "0fr", opacity: isOpen ? 1 : 0, transition: "grid-template-rows 0.24s cubic-bezier(0.16,1,0.3,1), opacity 0.2s ease" }}>
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <div style={{ height: "0.8px", background: "#c2e0ef", margin: "0 1rem" }} />
          <p style={{ margin: 0, padding: "0.7rem 1rem 0.9rem", fontFamily: "Inter, sans-serif", fontSize: "0.84rem", lineHeight: 1.65, color: "#3d5a7a" }}>
            {item.answer}
          </p>
        </div>
      </div>
    </li>
  );
}

function SupportButton() {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      style={{
        height: "42px",
        border: 0,
        borderRadius: "14px",
        background: "#f77a21",
        color: "#ffffff",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: "0.84rem",
        fontWeight: 600,
        padding: "0 1.4rem",
        whiteSpace: "nowrap" as const,
        cursor: "pointer",
        boxShadow: hovered
          ? "0px 6px 18px rgba(247,122,33,0.34)"
          : "0px 4px 14px rgba(247,122,33,0.22)",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      Contacter le support
    </button>
  );
}

