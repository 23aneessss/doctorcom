import { useEffect, useRef, useState } from "react";

import {
  ArrowLeft,
  Check,
  ChevronRight,
  Eye,
  FileText,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

type MessageStatus = "thinking" | "done";

interface ResultCard {
  title: string;
  description: string;
  buttonLabel: string;
  icon: typeof Stethoscope;
}

interface Message {
  id: number;
  type: "user" | "assistant";
  text: string;
  status?: MessageStatus;
  thinkingText?: string;
  resultCard?: ResultCard;
}

const actions = [
  { icon: Stethoscope, label: "Proposer une hypothese diagnostique", color: "#0f3460" },
  { icon: FileText, label: "Recommander une ordonnance", color: "#0f3460" },
  { icon: ShieldCheck, label: "Verifier un document medical", color: "#0f3460" },
];

const responses: Record<string, { thinking: string; done: string; card: ResultCard }> = {
  "Proposer une hypothese diagnostique": {
    thinking: "Analyse des symptomes, antecedents et resultats biologiques du patient...",
    done: "Hypothese diagnostique generee a partir des donnees du dossier patient en cours.",
    card: {
      title: "Hypothese diagnostique",
      description: "Syndrome grippal avec surinfection bacterienne probable",
      buttonLabel: "Voir l'hypothese",
      icon: Stethoscope,
    },
  },
  "Recommander une ordonnance": {
    thinking: "Verification des allergies, interactions medicamenteuses et protocoles en vigueur...",
    done: "Ordonnance preparee selon le diagnostic et les contraintes du patient.",
    card: {
      title: "Ordonnance generee",
      description: "Amoxicilline 1g, Paracetamol 500mg, Repos 5 jours",
      buttonLabel: "Voir l'ordonnance",
      icon: FileText,
    },
  },
  "Verifier un document medical": {
    thinking: "Lecture et analyse du document medical en cours...",
    done: "Document verifie. Aucune anomalie detectee dans le compte-rendu.",
    card: {
      title: "Verification terminee",
      description: "Compte-rendu conforme, pas d'erreur detectee",
      buttonLabel: "Voir le rapport",
      icon: ShieldCheck,
    },
  },
};

function getFreeTextResponse(text: string): { thinking: string; done: string; card?: ResultCard } {
  const lower = text.toLowerCase();

  if (
    lower.includes("douleur") ||
    lower.includes("fievre") ||
    lower.includes("symptom") ||
    lower.includes("mal") ||
    lower.includes("toux") ||
    lower.includes("diagnostic")
  ) {
    return {
      thinking: "Analyse des symptomes decrits et croisement avec les antecedents du patient...",
      done: "Voici une analyse basee sur les symptomes mentionnes.",
      card: {
        title: "Analyse symptomatique",
        description: "Evaluation des symptomes avec recommandations cliniques",
        buttonLabel: "Voir l'analyse",
        icon: Stethoscope,
      },
    };
  }

  if (
    lower.includes("ordonnance") ||
    lower.includes("prescrire") ||
    lower.includes("prescription") ||
    lower.includes("traitement")
  ) {
    return {
      thinking: "Preparation de la prescription en tenant compte du profil du patient...",
      done: "Proposition de traitement generee selon les donnees cliniques.",
      card: {
        title: "Proposition de traitement",
        description: "Traitement adapte au profil et aux contraintes du patient",
        buttonLabel: "Voir le traitement",
        icon: FileText,
      },
    };
  }

  if (
    lower.includes("medicament") ||
    lower.includes("interaction") ||
    lower.includes("allergie") ||
    lower.includes("compatib")
  ) {
    return {
      thinking: "Verification des interactions medicamenteuses et contre-indications...",
      done: "Analyse de compatibilite terminee.",
      card: {
        title: "Rapport de compatibilite",
        description: "Aucune interaction majeure detectee",
        buttonLabel: "Voir le rapport",
        icon: ShieldCheck,
      },
    };
  }

  if (
    lower.includes("patient") ||
    lower.includes("dossier") ||
    lower.includes("antecedent") ||
    lower.includes("historique")
  ) {
    return {
      thinking: "Recherche dans le dossier medical du patient en cours...",
      done: "Informations pertinentes extraites du dossier patient.",
      card: {
        title: "Resume du dossier",
        description: "Synthese des informations cles du patient",
        buttonLabel: "Voir le resume",
        icon: FileText,
      },
    };
  }

  return {
    thinking: "Analyse de votre demande en cours...",
    done: "Je peux vous aider avec cette demande. Essayez de decrire des symptomes, un traitement ou un medicament pour obtenir une reponse plus detaillee.",
  };
}

const springPop = { type: "spring" as const, stiffness: 400, damping: 28, mass: 0.8 };
const springGentle = { type: "spring" as const, stiffness: 300, damping: 30, mass: 1 };
const springBouncy = { type: "spring" as const, stiffness: 500, damping: 25, mass: 0.6 };

const cWhite = "#FFFDFB";
const cSky = "#76BBDD";
const cSidebarGradStart = "#0f3460";
const cSidebarGradMid = "#123865";
const cSidebarGradEnd = "#285487";
const cChipActiveBg = "rgba(118,187,221,0.4)";
const cChipHoverBg = "rgba(118,187,221,0.18)";
const cTextDefault = "rgba(255,255,255,0.7)";
const cDivider = "rgba(255,255,255,0.7)";
const cDiscussionText = "#08233f";
const cDiscussionMuted = "#334155";
const cDiscussionBorder = "#c2e0ef";
const cDiscussionCardBg = "#f8fafc";

function StethoscopeThinkingIcon() {
  const bars = [
    { height: 6, delay: 0 },
    { height: 10, delay: 0.12 },
    { height: 14, delay: 0.24 },
    { height: 10, delay: 0.36 },
    { height: 6, delay: 0.48 },
  ];

  return (
    <div className="flex items-center gap-1.5">
      <Stethoscope size={15} style={{ color: cSky, flexShrink: 0 }} />
      <div className="flex items-center gap-[2.5px]" style={{ height: 16 }}>
        {bars.map((bar, index) => (
          <motion.div
            key={index}
            className="rounded-full"
            style={{
              width: 2.5,
              background: cSky,
              originY: 0.5,
            }}
            animate={{
              height: [bar.height * 0.35, bar.height, bar.height * 0.35],
              opacity: [0.4, 0.9, 0.4],
            }}
            transition={{
              duration: 1.2,
              repeat: Number.POSITIVE_INFINITY,
              delay: bar.delay,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function AIAssistantPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [hoveredAction, setHoveredAction] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 80);
  };

  const handleNewChat = () => {
    setMessages([]);
    setInputValue("");
    setIsProcessing(false);
  };

  const sendWithResponse = (userText: string, response: { thinking: string; done: string; card?: ResultCard }) => {
    if (isProcessing) {
      return;
    }

    const userMsg: Message = { id: ++idRef.current, type: "user", text: userText };
    const assistantId = ++idRef.current;
    const assistantMsg: Message = {
      id: assistantId,
      type: "assistant",
      text: "",
      status: "thinking",
      thinkingText: response.thinking,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsProcessing(true);
    scrollToBottom();

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? { ...message, status: "done", text: response.done, resultCard: response.card }
            : message,
        ),
      );
      setIsProcessing(false);
      scrollToBottom();
    }, 3200);
  };

  const handleAction = (label: string) => {
    const response = responses[label];
    if (!response) {
      return;
    }
    sendWithResponse(label, response);
  };

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || isProcessing) {
      return;
    }
    setInputValue("");
    const matchedAction = Object.keys(responses).find((key) => text.toLowerCase() === key.toLowerCase());
    if (matchedAction) {
      handleAction(matchedAction);
      return;
    }
    sendWithResponse(text, getFreeTextResponse(text));
  };

  const hasMessages = messages.length > 0;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="pointer-events-none fixed inset-0 z-[60]"
              style={{
                background: `radial-gradient(circle at bottom right, ${cChipActiveBg} 0%, transparent 70%)`,
              }}
            />

            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.92, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 20, scale: 0.95, filter: "blur(4px)" }}
              transition={springGentle}
              className="fixed bottom-[5.5rem] right-3 z-[70] flex max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-3xl sm:right-6"
              style={{
                width: 390,
                height: hasMessages ? 530 : "auto",
                maxHeight: "calc(100vh - 130px)",
                background: `linear-gradient(160deg, ${cSidebarGradStart} 0%, ${cSidebarGradMid} 60%, ${cSidebarGradEnd} 100%)`,
                boxShadow: "0 10px 45px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.18)",
              }}
            >
              <div
                className="flex flex-shrink-0 items-center justify-between px-5 py-4"
                style={{
                  background: `linear-gradient(135deg, ${cSidebarGradStart} 0%, ${cSidebarGradMid} 65%, ${cSidebarGradEnd} 100%)`,
                  borderBottom: `1px solid ${cDivider}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <AnimatePresence mode="wait">
                    {hasMessages && (
                      <motion.button
                        initial={{ opacity: 0, x: -8, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -8, scale: 0.8 }}
                        transition={springBouncy}
                        onClick={handleNewChat}
                        className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                        style={{ background: "transparent" }}
                        title="Retour"
                      >
                        <ArrowLeft size={15} style={{ color: cWhite }} />
                      </motion.button>
                    )}
                  </AnimatePresence>

                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ background: cChipHoverBg, backdropFilter: "blur(12px)" }}
                  >
                    <Sparkles size={17} style={{ color: cWhite }} />
                  </div>

                  <div>
                    <span style={{ fontSize: 15, fontWeight: 600, color: cWhite, letterSpacing: "-0.01em" }}>
                      Assistant IA
                    </span>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={hasMessages ? "active" : "idle"}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                        style={{ fontSize: 11, color: cTextDefault, marginTop: 1 }}
                      >
                        {hasMessages ? "Consultation en cours" : "Que souhaitez-vous faire ?"}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <AnimatePresence>
                    {hasMessages && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                        transition={springBouncy}
                        onClick={handleNewChat}
                        className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                        style={{ background: "transparent" }}
                        title="Nouveau chat"
                      >
                        <Plus size={15} style={{ color: cWhite }} />
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <motion.button
                    whileHover={{ scale: 1.1, background: cChipHoverBg }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                  >
                    <X size={14} style={{ color: cTextDefault }} />
                  </motion.button>
                </div>
              </div>

              <div
                ref={scrollRef}
                className="min-h-0 flex-1 overflow-y-auto"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: `${cDiscussionBorder} transparent`,
                  background: cWhite,
                }}
              >
                <AnimatePresence mode="wait">
                  {!hasMessages ? (
                    <motion.div
                      key="home"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, x: -30, filter: "blur(4px)" }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="px-5 pb-2 pt-5">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ ...springBouncy, delay: 0.15 }}
                          className="inline-flex items-center gap-2 rounded-full px-3.5 py-2"
                          style={{
                            background: cDiscussionCardBg,
                            border: `1px solid ${cDiscussionBorder}`,
                          }}
                        >
                          <motion.div
                            className="h-2 w-2 rounded-full"
                            style={{ background: cSky }}
                            animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                          />
                          <span style={{ fontSize: 11, fontWeight: 500, color: cDiscussionText }}>
                            Consultation en cours
                          </span>
                        </motion.div>
                      </div>

                      <div className="flex flex-col gap-1.5 px-4 pb-3 pt-3">
                        <motion.p
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 }}
                          className="mb-1 px-2"
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: cDiscussionMuted,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                          }}
                        >
                          Actions suggerees
                        </motion.p>
                        {actions.map((action, index) => (
                          <motion.button
                            key={index}
                            initial={{ opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ ...springPop, delay: 0.25 + index * 0.08 }}
                            onClick={() => handleAction(action.label)}
                            className="group relative flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left"
                            onMouseEnter={() => setHoveredAction(index)}
                            onMouseLeave={() => setHoveredAction(null)}
                            whileHover={{ x: 3 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <motion.div
                              className="absolute inset-0 rounded-2xl"
                              initial={false}
                              animate={{
                                opacity: hoveredAction === index ? 1 : 0,
                                scale: hoveredAction === index ? 1 : 0.97,
                              }}
                              transition={{ duration: 0.15 }}
                              style={{ background: cDiscussionCardBg }}
                            />
                            <motion.div
                              className="relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                              style={{ background: hoveredAction === index ? cDiscussionBorder : cDiscussionCardBg }}
                              animate={{ scale: hoveredAction === index ? 1.05 : 1 }}
                              transition={springBouncy}
                            >
                              <action.icon size={16} style={{ color: action.color }} />
                            </motion.div>
                            <span
                              className="relative z-10"
                              style={{ fontSize: 13, fontWeight: 450, color: cDiscussionText, lineHeight: "1.35" }}
                            >
                              {action.label}
                            </span>
                            <motion.div
                              className="relative z-10 ml-auto"
                              animate={{
                                opacity: hoveredAction === index ? 1 : 0,
                                x: hoveredAction === index ? 0 : -4,
                              }}
                              transition={{ duration: 0.15 }}
                            >
                              <ChevronRight size={14} style={{ color: cDiscussionMuted }} />
                            </motion.div>
                          </motion.button>
                        ))}
                      </div>

                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 0.4, duration: 0.3 }}
                        className="mx-5 my-1 origin-left"
                        style={{ height: 1, background: `linear-gradient(90deg, ${cDiscussionBorder}, transparent)` }}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="chat"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col gap-5 px-4 py-4"
                    >
                      {messages.map((message) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 16, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ ...springPop, delay: 0.05 }}
                        >
                          {message.type === "user" ? (
                            <div className="flex justify-end">
                              <motion.div
                                className="max-w-[85%] rounded-2xl rounded-br-lg px-4 py-3"
                                style={{ background: "rgba(118,187,221,0.22)", border: `1px solid ${cDiscussionBorder}` }}
                                whileHover={{ scale: 1.01 }}
                                transition={springBouncy}
                              >
                                <span style={{ fontSize: 13, color: cDiscussionText, lineHeight: "1.45" }}>
                                  {message.text}
                                </span>
                              </motion.div>
                            </div>
                          ) : (
                            <div className="flex gap-2.5">
                              <motion.div
                                className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg"
                                style={{ background: cDiscussionCardBg, border: `1px solid ${cDiscussionBorder}` }}
                                initial={{ scale: 0, rotate: -45 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={springBouncy}
                              >
                                <Sparkles size={13} style={{ color: cSky }} />
                              </motion.div>
                              <div className="min-w-0 flex-1">
                                <AnimatePresence mode="wait">
                                  {message.status === "thinking" ? (
                                    <motion.div
                                      key="thinking"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      exit={{ opacity: 0, scale: 0.98 }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      <ThinkingBlock text={message.thinkingText || ""} />
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      key="done"
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      transition={{ duration: 0.3 }}
                                    >
                                      <DoneBlock text={message.text} card={message.resultCard} />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <motion.div
                className="flex-shrink-0 px-4 py-3.5"
                style={{ borderTop: `1px solid ${cDivider}`, background: cSidebarGradMid }}
              >
                <motion.div
                  className="flex items-end gap-2 rounded-2xl px-3.5 py-2.5 transition-all duration-200"
                  animate={{
                    boxShadow: inputFocused
                      ? `0 0 0 2px ${cSky}, 0 2px 12px rgba(0,0,0,0.3)`
                      : `0 0 0 1px ${cDivider}, 0 1px 3px rgba(0,0,0,0.2)`,
                  }}
                  style={{ background: "rgba(255,255,255,0.98)" }}
                >
                  <textarea
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Posez une question ou demandez une action..."
                    rows={1}
                    className="mx-[0px] my-[6px] flex-1 resize-none bg-transparent outline-none"
                    style={{ fontSize: 13, lineHeight: "1.5", color: cDiscussionText }}
                  />
                  <motion.button
                    onClick={handleSend}
                    disabled={isProcessing || !inputValue.trim()}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
                    animate={{
                      scale: inputValue.trim() && !isProcessing ? 1 : 0.9,
                      background: inputValue.trim() && !isProcessing ? cSky : "#e2ecf3",
                      border: `1px solid ${cDivider}`,
                    }}
                    whileHover={inputValue.trim() && !isProcessing ? { scale: 1.08 } : {}}
                    whileTap={inputValue.trim() && !isProcessing ? { scale: 0.92 } : {}}
                    transition={springBouncy}
                  >
                    <Send
                      size={14}
                      style={{ color: inputValue.trim() && !isProcessing ? cWhite : cDiscussionMuted }}
                    />
                  </motion.button>
                </motion.div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[70] flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-2xl"
        style={{
          background: `linear-gradient(135deg, ${cSidebarGradStart} 0%, ${cSidebarGradMid} 65%, ${cSidebarGradEnd} 100%)`,
          border: `1px solid ${cDivider}`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
        }}
        whileHover={{
          scale: 1.08,
          boxShadow: "0 6px 28px rgba(0,0,0,0.45)",
        }}
        whileTap={{ scale: 0.92 }}
        transition={springBouncy}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0, opacity: 0 }}
              transition={springBouncy}
            >
              <X size={20} style={{ color: cWhite }} />
            </motion.div>
          ) : (
            <motion.div
              key="spark"
              initial={{ rotate: 90, scale: 0, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: -90, scale: 0, opacity: 0 }}
              transition={springBouncy}
            >
              <Sparkles size={20} style={{ color: cWhite }} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(true);
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    setDisplayedText("");
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index += 1;
      } else {
        clearInterval(interval);
      }
    }, 22);

    return () => clearInterval(interval);
  }, [text]);

  return (
    <div className="flex flex-col gap-2">
      <motion.button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2" whileTap={{ scale: 0.97 }}>
        <StethoscopeThinkingIcon />
        <span style={{ fontSize: 12, fontWeight: 500, color: cDiscussionMuted }}>Reflexion en cours</span>
        <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={springBouncy}>
          <ChevronRight size={11} style={{ color: cDiscussionMuted }} />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ ...springGentle, opacity: { duration: 0.15 } }}
            className="overflow-hidden"
          >
            <motion.div className="relative py-2 pl-5" style={{ borderLeft: `2px solid ${cDiscussionBorder}` }}>
              <motion.div
                className="absolute left-0 top-0 h-6 w-0.5 rounded-full"
                style={{ background: `linear-gradient(180deg, ${cSky}, transparent)` }}
                animate={{ top: ["0%", "80%", "0%"] }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              />
              <p style={{ fontSize: 12, color: cDiscussionMuted, lineHeight: "1.55" }}>
                {displayedText}
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Number.POSITIVE_INFINITY }}
                  style={{ color: cSky }}
                >
                  |
                </motion.span>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DoneBlock({ text, card }: { text: string; card?: ResultCard }) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    setDisplayedText("");
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index += 1;
      } else {
        clearInterval(interval);
      }
    }, 15);

    return () => clearInterval(interval);
  }, [text]);

  const textDone = displayedText.length >= text.length;

  return (
    <div className="flex flex-col gap-3">
      <ThoughtCollapsed />

      <p style={{ fontSize: 13, color: cDiscussionText, lineHeight: "1.55" }}>
        {displayedText}
        {!textDone && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Number.POSITIVE_INFINITY }}
            style={{ color: cSky }}
          >
            |
          </motion.span>
        )}
      </p>

      {card && textDone && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...springPop, delay: 0.1 }}
          className="group relative overflow-hidden rounded-2xl"
          style={{
            border: `1px solid ${cDiscussionBorder}`,
            background: cDiscussionCardBg,
          }}
        >
          <motion.div
            className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ boxShadow: "inset 0 0 20px rgba(118,187,221,0.14)" }}
          />

          <div className="flex items-stretch">
            <div className="flex-1 px-4 py-3.5">
              <div className="mb-1.5 flex items-center gap-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ ...springBouncy, delay: 0.3 }}
                  className="flex h-5 w-5 items-center justify-center rounded-md"
                  style={{ background: cDiscussionCardBg }}
                >
                  <Check size={11} style={{ color: cSky }} />
                </motion.div>
                <p style={{ fontSize: 13, fontWeight: 600, color: cDiscussionText }}>{card.title}</p>
              </div>
              <p style={{ fontSize: 12, color: cDiscussionMuted, lineHeight: "1.4" }}>{card.description}</p>
              <motion.button
                className="mt-3 flex items-center gap-2 rounded-xl px-4 py-2 transition-all"
                style={{
                  background: cSky,
                  color: cWhite,
                  fontSize: 12,
                  fontWeight: 500,
                }}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.03, boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}
                whileTap={{ scale: 0.97 }}
              >
                <Eye size={13} />
                {card.buttonLabel}
              </motion.button>
            </div>
            <motion.div
              className="flex w-16 flex-shrink-0 items-center justify-center"
              style={{ background: cDiscussionCardBg }}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 }}
            >
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              >
                <card.icon size={22} style={{ color: cSky }} />
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function ThoughtCollapsed() {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.button
      onClick={() => setExpanded(!expanded)}
      className="w-fit rounded-lg px-2.5 py-1"
      style={{ background: "transparent" }}
      whileHover={{ background: cDiscussionCardBg }}
      whileTap={{ scale: 0.97 }}
    >
      <div className="flex items-center gap-2">
        <motion.div className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: cDiscussionCardBg }}>
          <Check size={9} style={{ color: cSky }} />
        </motion.div>
        <span style={{ fontSize: 11, fontWeight: 500, color: cDiscussionMuted }}>Reflexion terminee</span>
        <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={springBouncy}>
          <ChevronRight size={10} style={{ color: cDiscussionMuted }} />
        </motion.div>
      </div>
    </motion.button>
  );
}
