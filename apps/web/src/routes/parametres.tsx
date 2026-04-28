import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  ChevronDown,
  Globe2,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import headerTexture from "@/assets/figma/patients/fc145d0d9403ead31e8bc198dd8335751de59305.svg";
import Sidebar from "@/components/sidebar";
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

type InterfaceLanguage = "fr" | "ar" | "en";

type ProfileUpdatePayload = Partial<ProfileFormValues> & {
  langue_interface?: InterfaceLanguage;
};

const EMPTY_PROFILE_FORM: ProfileFormValues = {
  nom: "",
  prenom: "",
  telephone: "",
  adresse: "",
};

function toInterfaceLanguage(value: string | null | undefined): InterfaceLanguage {
  return value === "ar" || value === "en" ? value : "fr";
}

function ParametresPage() {
  const { session, trpc, queryClient } = Route.useRouteContext();
  const sessionUser = session?.data?.user;
  const [profileForm, setProfileForm] = useState<ProfileFormValues>(
    EMPTY_PROFILE_FORM,
  );
  const [language, setLanguage] = useState<InterfaceLanguage>("fr");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [successDialog, setSuccessDialog] = useState<null | "password">(null);

  const profileQuery = useQuery({
    ...trpc.auth.me.queryOptions(),
    throwOnError: false,
  });
  const updateProfileMutation = useMutation(
    trpc.auth.updateMyProfile.mutationOptions(),
  );

  const profile = profileQuery.data?.profile;
  const email = profile?.email ?? sessionUser?.email ?? "";
  const displayedName = buildFullName(profile?.prenom, profile?.nom)
    || sessionUser?.name?.trim()
    || email
    || "Profil utilisateur";

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
    setLanguage(toInterfaceLanguage(profile.langue_interface));
  }, [profile]);

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

  const handleCancel = () => {
    if (!profile) {
      setProfileForm(EMPTY_PROFILE_FORM);
      return;
    }

    setProfileForm({
      nom: profile.nom ?? "",
      prenom: profile.prenom ?? "",
      telephone: profile.telephone ?? "",
      adresse: profile.adresse ?? "",
    });
    setLanguage(toInterfaceLanguage(profile.langue_interface));
  };

  const handleSave = async () => {
    if (!profile) {
      toast.error("Impossible de charger votre profil.");
      return;
    }

    if (!hasProfileChanges) {
      toast.info("Aucune modification à enregistrer.");
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
      toast.error("Le nom et le prénom sont requis.");
      return;
    }

    if (!trimmedForm.telephone || !trimmedForm.adresse) {
      toast.error("Le téléphone et l'adresse du cabinet sont requis.");
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
      await queryClient.invalidateQueries({ queryKey: trpc.auth.me.queryKey() });
      toast.success("Paramètres enregistrés.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer les paramètres.",
      );
    }
  };

  return (
    <div className={styles.pageShell}>
      <Sidebar currentUser={sidebarUser} />

      <main className={styles.pageMain}>
        <div className={styles.pageContent}>
          <header
            className={styles.hero}
            style={{ "--parametres-hero-texture": `url(${headerTexture})` } as React.CSSProperties}
          >
            <div className={styles.heroInner}>
              <div className={styles.heroText}>
                <h1 className={styles.heroTitle}>Paramètres</h1>
                <p className={styles.heroSubtitle}>
                  Modifiez vos informations, gérez la sécurité de votre compte et
                  ajustez vos préférences en toute simplicité.
                </p>
              </div>
            </div>
          </header>

          <SettingsSection icon={<UserRound size={20} />} title="Profil">
            <div className={styles.profileGrid}>
              <SettingsField label="Nom complet" icon={<UserRound size={16} />}>
                <div className={styles.nameGrid}>
                  <input
                    aria-label="Prénom"
                    className={styles.input}
                    onChange={(event) =>
                      updateProfileField("prenom", event.currentTarget.value)
                    }
                    placeholder="Prénom"
                    value={profileForm.prenom}
                  />
                  <input
                    aria-label="Nom"
                    className={styles.input}
                    onChange={(event) =>
                      updateProfileField("nom", event.currentTarget.value)
                    }
                    placeholder="Nom"
                    value={profileForm.nom}
                  />
                </div>
              </SettingsField>

              <SettingsField label="Adresse e-mail" icon={<Mail size={16} />}>
                <input className={styles.input} disabled value={email} />
              </SettingsField>

              <SettingsField label="Numéro de téléphone" icon={<Phone size={16} />}>
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
                label="Adresse du cabinet"
                icon={<MapPin size={16} />}
              >
                <input
                  className={styles.input}
                  onChange={(event) =>
                    updateProfileField("adresse", event.currentTarget.value)
                  }
                  placeholder="Adresse du cabinet"
                  value={profileForm.adresse}
                />
              </SettingsField>
            </div>
          </SettingsSection>

          <div className={styles.sideBySideSections}>
            <SettingsSection icon={<Globe2 size={20} />} title="Préférences">
              <div className={styles.preferencesGrid}>
                <SettingsField label="Langue de l'interface" icon={<Globe2 size={16} />}>
                  <div className={styles.selectWrap}>
                    <select
                      className={styles.select}
                      onChange={(event) =>
                        setLanguage(toInterfaceLanguage(event.currentTarget.value))
                      }
                      value={language}
                    >
                      <option value="fr">Français</option>
                      <option value="ar">Arabe</option>
                      <option value="en">Anglais</option>
                    </select>
                    <ChevronDown size={16} aria-hidden="true" />
                  </div>
                </SettingsField>
              </div>
            </SettingsSection>

            <SettingsSection icon={<Shield size={20} />} title="Sécurité">
              <div className={styles.passwordManagerCard}>
                <div className={styles.passwordManagerCopy}>
                  <div className={styles.passwordActionGroup}>
                    <div className={styles.passwordActionHeader}>
                      <div className={styles.passwordChoiceIcon}>
                        <KeyRound size={18} aria-hidden="true" />
                      </div>
                      <div className={styles.passwordChoiceCopy}>
                        <p>Changer maintenant</p>
                        <span>Remplacez-le avec votre mot de passe actuel. Cette option met à jour votre accès immédiatement.</span>
                      </div>
                    </div>
                  </div>
                  <button
                    className={styles.orangeButton}
                    onClick={() => setIsPasswordDialogOpen(true)}
                    type="button"
                  >
                    <KeyRound size={16} aria-hidden="true" />
                    Changer le mot de passe
                  </button>
                </div>
              </div>
            </SettingsSection>
          </div>

          <footer className={styles.footerActions}>
            <button
              className={styles.cancelButton}
              disabled={updateProfileMutation.isPending}
              onClick={handleCancel}
              type="button"
            >
              Annuler
            </button>
            <button
              className={styles.saveButton}
              disabled={updateProfileMutation.isPending || profileQuery.isLoading}
              onClick={handleSave}
              type="button"
            >
              <Save size={16} aria-hidden="true" />
              {updateProfileMutation.isPending
                ? "Enregistrement..."
                : "Enregistrer les modifications"}
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
        title="Mot de passe modifié"
        description="Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant l'utiliser pour vos prochaines connexions."
        onClose={() => setSuccessDialog(null)}
      />
    </div>
  );
}

function SuccessDialog({
  description,
  onClose,
  open,
  title,
}: {
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
        <button className={styles.successButton} onClick={onClose} type="button">Terminer</button>
      </section>
    </div>
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
