import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, CircleHelp, Eye, EyeOff, KeyRound, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { trpc } from "@/utils/trpc";

import styles from "./changer-mdp.module.css";

interface ChangerMdpDialogProps {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
  onForgotPassword?: () => void;
}

type PasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const INITIAL_VALUES: PasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Le mot de passe actuel est requis."),
    newPassword: z
      .string()
      .min(6, "Le nouveau mot de passe doit contenir au moins 6 caractères."),
    confirmPassword: z.string().min(1, "La confirmation est requise."),
  })
  .refine((values) => values.currentPassword !== values.newPassword, {
    message: "Le nouveau mot de passe doit être différent de l'ancien.",
    path: ["newPassword"],
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "La confirmation ne correspond pas.",
    path: ["confirmPassword"],
  });

export function ChangerMdpDialog({
  open,
  onChanged,
  onClose,
  onForgotPassword,
}: ChangerMdpDialogProps) {
  const [values, setValues] = useState<PasswordFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<Partial<PasswordFormValues>>({});
  const [visibleFields, setVisibleFields] = useState<
    Partial<Record<keyof PasswordFormValues, boolean>>
  >({});
  const changePasswordMutation = useMutation(
    trpc.auth.changePassword.mutationOptions(),
  );

  useEffect(() => {
    if (!open) {
      setValues(INITIAL_VALUES);
      setErrors({});
      setVisibleFields({});
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !changePasswordMutation.isPending) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [changePasswordMutation.isPending, onClose, open]);

  if (!open) {
    return null;
  }

  const updateValue = (field: keyof PasswordFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const toggleVisible = (field: keyof PasswordFormValues) => {
    setVisibleFields((current) => ({ ...current, [field]: !current[field] }));
  };
  const canSubmit = passwordSchema.safeParse(values).success;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = passwordSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Partial<PasswordFormValues> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof PasswordFormValues | undefined;
        if (field && !nextErrors[field]) {
          nextErrors[field] = issue.message;
        }
      }
      setErrors(nextErrors);
      return;
    }

    try {
      await changePasswordMutation.mutateAsync({
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
      });
      onChanged?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Le mot de passe n'a pas pu être mis à jour.",
      );
    }
  };

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !changePasswordMutation.isPending) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="changer-mdp-title"
        aria-modal="true"
        className={styles.dialog}
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerIcon}>
            <KeyRound size={22} aria-hidden="true" />
          </div>
          <div className={styles.headerCopy}>
            <h2 id="changer-mdp-title">Changer le mot de passe</h2>
            <p>Renseignez votre mot de passe actuel puis choisissez un nouveau mot de passe.</p>
          </div>
          <div className={styles.headerActions}>
            <button aria-label="Aide" className={styles.iconButton} data-context-help-href="/aide/parametres#securite" type="button">
              <CircleHelp size={20} aria-hidden="true" />
            </button>
            <button
              aria-label="Fermer"
              className={styles.iconButton}
              disabled={changePasswordMutation.isPending}
              onClick={onClose}
              type="button"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <PasswordField
            error={errors.currentPassword}
            label="Mot de passe actuel"
            name="currentPassword"
            onChange={updateValue}
            onToggleVisible={toggleVisible}
            placeholder="Votre mot de passe actuel"
            value={values.currentPassword}
            visible={Boolean(visibleFields.currentPassword)}
          />
          {onForgotPassword ? (
            <button
              className={styles.inlineForgotButton}
              disabled={changePasswordMutation.isPending}
              onClick={onForgotPassword}
              type="button"
            >
              Mot de passe actuel oublié ?
            </button>
          ) : null}
          <PasswordField
            error={errors.newPassword}
            label="Nouveau mot de passe"
            name="newPassword"
            onChange={updateValue}
            onToggleVisible={toggleVisible}
            placeholder="Au moins 6 caractères"
            value={values.newPassword}
            visible={Boolean(visibleFields.newPassword)}
          />
          <PasswordField
            error={errors.confirmPassword}
            label="Confirmation"
            name="confirmPassword"
            onChange={updateValue}
            onToggleVisible={toggleVisible}
            placeholder="Retapez le nouveau mot de passe"
            value={values.confirmPassword}
            visible={Boolean(visibleFields.confirmPassword)}
          />

          <div className={styles.tipBox}>
            <CheckCircle2 size={18} aria-hidden="true" />
            <p>Utilisez un mot de passe unique avec lettres, chiffres et caractères spéciaux.</p>
          </div>

          <footer className={styles.footer}>
            <button
              className={styles.cancelButton}
              disabled={changePasswordMutation.isPending}
              onClick={onClose}
              type="button"
            >
              Annuler
            </button>
            <button
              className={styles.submitButton}
              disabled={changePasswordMutation.isPending || !canSubmit}
              type="submit"
            >
              {changePasswordMutation.isPending ? (
                <Loader2 className={styles.spinner} size={16} aria-hidden="true" />
              ) : (
                <KeyRound size={16} aria-hidden="true" />
              )}
              Confirmer
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function PasswordField({
  error,
  label,
  name,
  onChange,
  onToggleVisible,
  placeholder,
  value,
  visible,
}: {
  error?: string;
  label: string;
  name: keyof PasswordFormValues;
  onChange: (name: keyof PasswordFormValues, value: string) => void;
  onToggleVisible: (name: keyof PasswordFormValues) => void;
  placeholder: string;
  value: string;
  visible: boolean;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={styles.inputWrap}>
        <KeyRound className={styles.inputIcon} size={16} aria-hidden="true" />
        <input
          aria-invalid={Boolean(error)}
          className={styles.input}
          onChange={(event) => onChange(name, event.currentTarget.value)}
          placeholder={placeholder}
          type={visible ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className={styles.visibilityButton}
          onClick={() => onToggleVisible(name)}
          type="button"
        >
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </span>
      {error ? <span className={styles.errorText}>{error}</span> : null}
    </label>
  );
}
