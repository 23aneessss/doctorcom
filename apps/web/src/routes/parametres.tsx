import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Cpu,
  Download,
  Globe2,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import headerTexture from "@/assets/figma/patients/fc145d0d9403ead31e8bc198dd8335751de59305.svg";
import { Sidebar } from "@/components/sidebar";
import { authClient } from "@/lib/auth-client";
import {
  toInterfaceLanguage,
  useInterfaceLanguage,
  type InterfaceLanguage,
} from "@/lib/interface-language";
import { requireSession } from "@/lib/require-session";
import { ChangerMdpDialog } from "@/routes/parametres/popups/changer-mdp";

import styles from "./parametres.module.css";

export const Route = createFileRoute("/parametres")({
  component: ParametresPage,
  beforeLoad: async () => {
    const session = await requireSession();
    return { session };
  },
});

type ProfileFormValues = {
  nom: string;
  prenom: string;
  telephone: string;
  adresse: string;
};

type ProfileUpdatePayload = Partial<ProfileFormValues> & {
  langue_interface?: InterfaceLanguage;
};

type AIProviderPreference = "gemini" | "ollama";

const EMPTY_PROFILE_FORM: ProfileFormValues = {
  nom: "",
  prenom: "",
  telephone: "",
  adresse: "",
};

function ParametresPage() {
  const { session, trpc, queryClient } = Route.useRouteContext();
  const {
    hasStoredLanguagePreference,
    language: activeLanguage,
    setLanguage: setActiveLanguage,
    t,
  } = useInterfaceLanguage();
  const sessionUser = session?.data?.user;
  const [profileForm, setProfileForm] = useState<ProfileFormValues>(
    EMPTY_PROFILE_FORM,
  );
  const [language, setLanguage] = useState<InterfaceLanguage>(activeLanguage);
  const [aiProvider, setAiProvider] = useState<AIProviderPreference>("gemini");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [successDialog, setSuccessDialog] = useState<null | "password">(null);

  const profileQuery = useQuery({
    ...trpc.auth.me.queryOptions(),
    throwOnError: false,
  });
  const updateProfileMutation = useMutation(
    trpc.auth.updateMyProfile.mutationOptions(),
  );
  const aiSettingsQuery = useQuery({
    ...trpc.ai.settings.get.queryOptions(),
    throwOnError: false,
  });
  const updateAiSettingsMutation = useMutation(
    trpc.ai.settings.update.mutationOptions(),
  );
  const downloadLocalModelMutation = useMutation(
    trpc.ai.settings.downloadLocalModel.mutationOptions(),
  );
  const deleteLocalModelMutation = useMutation(
    trpc.ai.settings.deleteLocalModel.mutationOptions(),
  );

  const profile = profileQuery.data?.profile;
  const aiSettings = aiSettingsQuery.data;
  const email = profile?.email ?? sessionUser?.email ?? "";
  const displayedName = buildFullName(profile?.prenom, profile?.nom)
    || sessionUser?.name?.trim()
    || email
    || t.settings.userProfile;

  const sidebarUser = email
    ? {
        name: displayedName,
        email,
        avatarUrl: profile?.avatar_url ?? sessionUser?.image ?? undefined,
      }
    : undefined;

  useEffect(() => {
    if (!profile) {
      return;
    }

    setProfileForm({
      nom: profile.nom ?? "",
      prenom: profile.prenom ?? "",
      telephone: profile.telephone ?? "",
      adresse: profile.adresse ?? "",
    });
    const persistedLanguage = toInterfaceLanguage(profile.langue_interface);
    const preferredLanguage =
      hasStoredLanguagePreference && activeLanguage !== persistedLanguage
        ? activeLanguage
        : persistedLanguage;
    setLanguage(preferredLanguage);
    setActiveLanguage(preferredLanguage);
  }, [activeLanguage, hasStoredLanguagePreference, profile, setActiveLanguage]);

  useEffect(() => {
    if (!aiSettings) {
      return;
    }

    setAiProvider(aiSettings.preferred_provider);
    setGeminiApiKey("");
  }, [aiSettings]);

  const hasProfileChanges = useMemo(() => {
    if (!profile) {
      return false;
    }

    return (
      profileForm.nom.trim() !== (profile.nom ?? "") ||
      profileForm.prenom.trim() !== (profile.prenom ?? "") ||
      profileForm.telephone.trim() !== (profile.telephone ?? "") ||
      profileForm.adresse.trim() !== (profile.adresse ?? "") ||
      language !== toInterfaceLanguage(profile.langue_interface)
    );
  }, [language, profile, profileForm]);

  const updateProfileField = (field: keyof ProfileFormValues, value: string) => {
    setProfileForm((current) => ({ ...current, [field]: value }));
  };

  const handleLanguageChange = (nextLanguage: InterfaceLanguage) => {
    setLanguage(nextLanguage);
    setActiveLanguage(nextLanguage);

    if (!profile || nextLanguage === toInterfaceLanguage(profile.langue_interface)) {
      return;
    }

    updateProfileMutation.mutate(
      { langue_interface: nextLanguage },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: trpc.auth.me.queryKey(),
          });
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : t.settings.saveError,
          );
        },
      },
    );
  };

  const refreshAISettings = async () => {
    await queryClient.invalidateQueries({
      queryKey: trpc.ai.settings.get.queryKey(),
    });
  };

  const handleSaveAISettings = async () => {
    const trimmedApiKey = geminiApiKey.trim();

    try {
      await updateAiSettingsMutation.mutateAsync({
        preferred_provider: aiProvider,
        ...(trimmedApiKey ? { gemini_api_key: trimmedApiKey } : {}),
      });
      setGeminiApiKey("");
      await refreshAISettings();
      toast.success(t.settings.aiSettingsSaved);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t.settings.saveError,
      );
    }
  };

  const handleClearGeminiApiKey = async () => {
    try {
      await updateAiSettingsMutation.mutateAsync({
        clear_gemini_api_key: true,
      });
      setGeminiApiKey("");
      await refreshAISettings();
      toast.success(t.settings.aiSettingsSaved);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t.settings.saveError,
      );
    }
  };

  const handleDownloadLocalModel = async () => {
    try {
      await downloadLocalModelMutation.mutateAsync();
      await refreshAISettings();
      toast.success(t.settings.localModelDownloaded);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t.settings.localModelError,
      );
    }
  };

  const handleDeleteLocalModel = async () => {
    try {
      await deleteLocalModelMutation.mutateAsync();
      await refreshAISettings();
      toast.success(t.settings.localModelDeleted);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t.settings.localModelError,
      );
    }
  };

  const handleCancel = () => {
    if (!profile) {
      setProfileForm(EMPTY_PROFILE_FORM);
      setLanguage(activeLanguage);
      return;
    }

    const persistedLanguage = toInterfaceLanguage(profile.langue_interface);
    setProfileForm({
      nom: profile.nom ?? "",
      prenom: profile.prenom ?? "",
      telephone: profile.telephone ?? "",
      adresse: profile.adresse ?? "",
    });
    setLanguage(persistedLanguage);
    setActiveLanguage(persistedLanguage);
  };

  const handleSave = async () => {
    if (!profile) {
      toast.error(t.settings.profileLoadError);
      return;
    }

    if (!hasProfileChanges) {
      toast.info(t.settings.noChanges);
      return;
    }

    const payload: ProfileUpdatePayload = {};
    const trimmedForm = {
      nom: profileForm.nom.trim(),
      prenom: profileForm.prenom.trim(),
      telephone: profileForm.telephone.trim(),
      adresse: profileForm.adresse.trim(),
    };

    if (!trimmedForm.nom || !trimmedForm.prenom) {
      toast.error(t.settings.nameRequired);
      return;
    }

    if (!trimmedForm.telephone || !trimmedForm.adresse) {
      toast.error(t.settings.contactRequired);
      return;
    }

    if (trimmedForm.nom !== (profile.nom ?? "")) {
      payload.nom = trimmedForm.nom;
    }
    if (trimmedForm.prenom !== (profile.prenom ?? "")) {
      payload.prenom = trimmedForm.prenom;
    }
    if (trimmedForm.telephone !== (profile.telephone ?? "")) {
      payload.telephone = trimmedForm.telephone;
    }
    if (trimmedForm.adresse !== (profile.adresse ?? "")) {
      payload.adresse = trimmedForm.adresse;
    }
    if (language !== toInterfaceLanguage(profile.langue_interface)) {
      payload.langue_interface = language;
    }

    try {
      await updateProfileMutation.mutateAsync(payload);
      setActiveLanguage(language);
      await queryClient.invalidateQueries({ queryKey: trpc.auth.me.queryKey() });

      const fullName = [trimmedForm.prenom, trimmedForm.nom].filter(Boolean).join(" ");
      if (fullName && fullName !== sessionUser?.name?.trim()) {
        await authClient.updateUser({ name: fullName });
      }

      toast.success(t.settings.saved);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t.settings.saveError,
      );
    }
  };

  return (
    <div className={styles.pageShell}>
      <Sidebar currentUser={sidebarUser} />

      <main className={styles.pageMain}>
        <div className={styles.pageContent}>
          <section
            aria-labelledby="parametres-page-title"
            className={styles.hero}
            style={{ "--parametres-hero-texture": `url(${headerTexture})` } as React.CSSProperties}
          >
            <div className={styles.heroInner}>
              <div className={styles.heroText}>
                <h1 className={styles.heroTitle} id="parametres-page-title">{t.settings.title}</h1>
                <p className={styles.heroSubtitle}>{t.settings.subtitle}</p>
              </div>
            </div>
          </section>

          <SettingsSection icon={<UserRound size={20} />} title={t.settings.profile}>
            <div className={styles.profileGrid}>
              <SettingsField label={t.settings.fullName} icon={<UserRound size={16} />}>
                <div className={styles.nameGrid}>
                  <input
                    aria-label={t.settings.firstName}
                    className={styles.input}
                    onChange={(event) =>
                      updateProfileField("prenom", event.currentTarget.value)
                    }
                    placeholder={t.settings.firstName}
                    value={profileForm.prenom}
                  />
                  <input
                    aria-label={t.settings.lastName}
                    className={styles.input}
                    onChange={(event) =>
                      updateProfileField("nom", event.currentTarget.value)
                    }
                    placeholder={t.settings.lastName}
                    value={profileForm.nom}
                  />
                </div>
              </SettingsField>

              <SettingsField label={t.settings.email} icon={<Mail size={16} />}>
                <input className={styles.input} disabled value={email} />
              </SettingsField>

              <SettingsField label={t.settings.phone} icon={<Phone size={16} />}>
                <input
                  className={styles.input}
                  onChange={(event) =>
                    updateProfileField("telephone", event.currentTarget.value)
                  }
                  placeholder="+213 555 123 456"
                  type="tel"
                  value={profileForm.telephone}
                />
              </SettingsField>

              <SettingsField
                className={styles.addressField}
                label={t.settings.cabinetAddress}
                icon={<MapPin size={16} />}
              >
                <input
                  className={styles.input}
                  onChange={(event) =>
                    updateProfileField("adresse", event.currentTarget.value)
                  }
                  placeholder={t.settings.cabinetAddress}
                  value={profileForm.adresse}
                />
              </SettingsField>
            </div>
          </SettingsSection>

          <div className={styles.sideBySideSections}>
            <SettingsSection icon={<Globe2 size={20} />} title={t.settings.preferences}>
              <div className={styles.preferencesGrid}>
                <SettingsField label={t.settings.interfaceLanguage} icon={<Globe2 size={16} />}>
                  <div className={styles.selectWrap}>
                    <select
                      className={styles.select}
                      onChange={(event) => {
                        const nextLanguage = toInterfaceLanguage(event.currentTarget.value);
                        handleLanguageChange(nextLanguage);
                      }}
                      value={language}
                    >
                      <option value="fr">{t.settings.french}</option>
                      <option value="ar">{t.settings.arabic}</option>
                      <option value="en">{t.settings.english}</option>
                    </select>
                    <ChevronDown size={16} aria-hidden="true" />
                  </div>
                </SettingsField>
              </div>
            </SettingsSection>

            <SettingsSection icon={<Shield size={20} />} title={t.settings.security}>
              <div className={styles.passwordManagerCard}>
                <div className={styles.passwordManagerCopy}>
                  <div className={styles.passwordActionGroup}>
                    <div className={styles.passwordActionHeader}>
                      <div className={styles.passwordChoiceIcon}>
                        <KeyRound size={18} aria-hidden="true" />
                      </div>
                      <div className={styles.passwordChoiceCopy}>
                        <p>{t.settings.changeNow}</p>
                        <span>{t.settings.passwordHelp}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    className={styles.orangeButton}
                    onClick={() => setIsPasswordDialogOpen(true)}
                    type="button"
                  >
                    <KeyRound size={16} aria-hidden="true" />
                    {t.settings.changePassword}
                  </button>
                </div>
              </div>
            </SettingsSection>
          </div>

          <SettingsSection icon={<BrainCircuit size={20} />} title={t.settings.aiAssistant}>
            <div className={styles.aiSettingsGrid}>
              <div className={styles.aiProviderPanel}>
                <div className={styles.aiProviderHeader}>
                  <span className={styles.aiProviderIcon}>
                    {aiProvider === "gemini" ? (
                      <Cloud size={18} aria-hidden="true" />
                    ) : (
                      <Cpu size={18} aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <p>{t.settings.aiProvider}</p>
                    <span>
                      {aiSettings?.active_provider === "gemini"
                        ? t.settings.cloudGeminiActive
                        : t.settings.localGemmaActive}
                    </span>
                  </div>
                </div>

                <SettingsField label={t.settings.aiProvider} icon={<BrainCircuit size={16} />}>
                  <div className={styles.selectWrap}>
                    <select
                      className={styles.select}
                      onChange={(event) =>
                        setAiProvider(event.currentTarget.value as AIProviderPreference)
                      }
                      value={aiProvider}
                    >
                      <option value="gemini">{t.settings.cloudGemini}</option>
                      <option value="ollama">{t.settings.localGemma}</option>
                    </select>
                    <ChevronDown size={16} aria-hidden="true" />
                  </div>
                </SettingsField>

                <div className={styles.aiComparisonGrid}>
                  <div className={styles.aiComparisonItem}>
                    <span className={styles.aiComparisonIcon}>
                      <Cpu size={15} aria-hidden="true" />
                    </span>
                    <div>
                      <p>{t.settings.localGemma}</p>
                      <span>{t.settings.localAiDescription}</span>
                    </div>
                  </div>
                  <div className={styles.aiComparisonItem}>
                    <span className={styles.aiComparisonIcon}>
                      <Cloud size={15} aria-hidden="true" />
                    </span>
                    <div>
                      <p>{t.settings.cloudGemini}</p>
                      <span>{t.settings.cloudAiDescription}</span>
                    </div>
                  </div>
                </div>
                <p className={styles.aiHint}>{t.settings.aiFallbackHint}</p>
              </div>

              <div className={styles.aiProviderPanel}>
                <SettingsField label={t.settings.geminiApiKey} icon={<KeyRound size={16} />}>
                  <input
                    className={styles.input}
                    onChange={(event) => setGeminiApiKey(event.currentTarget.value)}
                    placeholder={
                      aiSettings?.gemini_api_key_configured
                        ? t.settings.apiKeyConfigured
                        : t.settings.apiKeyPlaceholder
                    }
                    type="password"
                    value={geminiApiKey}
                  />
                </SettingsField>

                <div className={styles.aiStatusRow}>
                  <span
                    className={[
                      styles.aiStatusDot,
                      aiSettings?.gemini_api_key_configured ? styles.aiStatusOk : "",
                    ].filter(Boolean).join(" ")}
                  />
                  <span>
                    {aiSettings?.gemini_api_key_configured
                      ? t.settings.apiKeyConfigured
                      : t.settings.apiKeyMissing}
                  </span>
                </div>

                <div className={styles.aiActions}>
                  <button
                    className={styles.saveButtonSmall}
                    disabled={updateAiSettingsMutation.isPending}
                    onClick={handleSaveAISettings}
                    type="button"
                  >
                    <Save size={15} aria-hidden="true" />
                    {updateAiSettingsMutation.isPending
                      ? t.settings.saving
                      : t.settings.saveAISettings}
                  </button>
                  <button
                    className={styles.secondaryActionButton}
                    disabled={
                      updateAiSettingsMutation.isPending ||
                      !aiSettings?.gemini_api_key_configured
                    }
                    onClick={handleClearGeminiApiKey}
                    type="button"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    {t.settings.clearApiKey}
                  </button>
                </div>
              </div>

              <div className={styles.aiProviderPanel}>
                <div className={styles.aiProviderHeader}>
                  <span className={styles.aiProviderIcon}>
                    <Cpu size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <p>{aiSettings?.ollama.model ?? "gemma4:e2b"}</p>
                    <span>
                      {aiSettings?.ollama.installed
                        ? t.settings.localModelReady
                        : t.settings.localModelMissing}
                    </span>
                  </div>
                </div>

                <div className={styles.aiModelStatusGrid}>
                  <AIStatusPill
                    active={Boolean(aiSettings?.ollama.reachable)}
                    label={t.settings.ollamaService}
                  />
                  <AIStatusPill
                    active={Boolean(aiSettings?.ollama.installed)}
                    label={t.settings.localModelInstalled}
                  />
                  <AIStatusPill
                    active={Boolean(aiSettings?.ollama.running)}
                    label={t.settings.localModelLoaded}
                  />
                </div>

                <div className={styles.aiActions}>
                  <button
                    className={styles.orangeButton}
                    disabled={downloadLocalModelMutation.isPending}
                    onClick={handleDownloadLocalModel}
                    type="button"
                  >
                    <Download size={15} aria-hidden="true" />
                    {downloadLocalModelMutation.isPending
                      ? t.settings.downloadingModel
                      : t.settings.downloadLocalModel}
                  </button>
                  <button
                    className={styles.secondaryActionButton}
                    disabled={
                      deleteLocalModelMutation.isPending ||
                      !aiSettings?.ollama.installed
                    }
                    onClick={handleDeleteLocalModel}
                    type="button"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    {deleteLocalModelMutation.isPending
                      ? t.settings.deletingModel
                      : t.settings.deleteLocalModel}
                  </button>
                </div>
              </div>
            </div>
          </SettingsSection>

          <footer className={styles.footerActions}>
            <button
              className={styles.cancelButton}
              disabled={updateProfileMutation.isPending}
              onClick={handleCancel}
              type="button"
            >
              {t.settings.cancel}
            </button>
            <button
              className={styles.saveButton}
              disabled={updateProfileMutation.isPending || profileQuery.isLoading}
              onClick={handleSave}
              type="button"
            >
              <Save size={16} aria-hidden="true" />
              {updateProfileMutation.isPending
                ? t.settings.saving
                : t.settings.save}
            </button>
          </footer>
        </div>
      </main>

      <ChangerMdpDialog
        open={isPasswordDialogOpen}
        onClose={() => setIsPasswordDialogOpen(false)}
        onChanged={() => {
          setIsPasswordDialogOpen(false);
          setSuccessDialog("password");
        }}
      />
      <SuccessDialog
        open={successDialog !== null}
        title={t.settings.passwordChangedTitle}
        description={t.settings.passwordChangedDescription}
        buttonLabel={t.settings.finish}
        onClose={() => setSuccessDialog(null)}
      />
    </div>
  );
}

function SuccessDialog({
  buttonLabel,
  description,
  onClose,
  open,
  title,
}: {
  buttonLabel: string;
  description: string;
  onClose: () => void;
  open: boolean;
  title: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className={styles.modalBackdrop}>
      <section className={styles.successModal} role="dialog" aria-modal="true" aria-labelledby="success-title">
        <div className={styles.successIconCircle}>
          <CheckCircle2 size={44} aria-hidden="true" />
        </div>
        <h2 id="success-title">{title}</h2>
        <p>{description}</p>
        <button className={styles.successButton} onClick={onClose} type="button">{buttonLabel}</button>
      </section>
    </div>
  );
}

function AIStatusPill({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <span className={[styles.aiStatusPill, active ? styles.aiStatusPillActive : ""].filter(Boolean).join(" ")}>
      <span className={styles.aiStatusDot} />
      {label}
    </span>
  );
}

function SettingsSection({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon}>{icon}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SettingsField({
  children,
  className,
  icon,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <label className={[styles.field, className].filter(Boolean).join(" ")}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.inputWrap}>
        <span className={styles.inputIcon}>{icon}</span>
        {children}
      </span>
    </label>
  );
}

function buildFullName(prenom?: string | null, nom?: string | null) {
  return [prenom, nom].map((value) => value?.trim()).filter(Boolean).join(" ");
}
