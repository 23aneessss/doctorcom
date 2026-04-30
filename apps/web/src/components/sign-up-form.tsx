import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";
import { Mail, Lock, User } from "lucide-react";

import { authClient } from "@/lib/auth-client";

import { AuthFormSkeleton } from "./page-skeletons";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export default function SignUpForm({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const navigate = useNavigate({
    from: "/login",
  });
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      name: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
        },
        {
          onSuccess: () => {
            navigate({
              to: "/patients",
            });
            toast.success("Inscription réussie");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
        email: z.email("Adresse email invalide"),
        password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
      }),
    },
  });

  if (isPending) {
    return <AuthFormSkeleton />;
  }

  return (
    <div className="flex w-full flex-col items-center">
      <h1 className="text-center font-['Plus_Jakarta_Sans'] text-[36px] font-bold leading-none text-[#0f3460]">
        Créer un compte
      </h1>

      <p className="mt-8 max-w-[360px] text-center font-['Plus_Jakarta_Sans'] text-[16px] font-semibold leading-[1.45] text-[#0f3460]">
        Remplissez les informations ci-dessous pour vous inscrire
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="mt-8 flex w-full flex-col items-center"
      >
        <div className="w-full max-w-[352px]">
          <form.Field name="name">
            {(field) => (
              <div className="relative">
                <Label htmlFor={field.name} className="text-[#0f3460] font-medium text-[15px] block mb-1">Nom complet</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  placeholder="Nom complet"
                  className="h-[51px] w-full rounded-[15px] border-[3px] border-[#0f3460] bg-transparent py-0 pl-11 text-[15px] font-medium text-[#0f3460] placeholder:text-[rgba(15,52,96,0.62)] focus-visible:border-[#76BBDD] focus-visible:ring-0"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none" style={{ top: "32px" }}>
                  <User className="h-[18px] w-[18px] text-[#0f3460]" strokeWidth={2.5} />
                </div>
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-red-500 ml-1">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <div className="mt-5 w-full max-w-[352px]">
          <form.Field name="email">
            {(field) => (
              <div className="relative">
                <Label htmlFor={field.name} className="text-[#0f3460] font-medium text-[15px] block mb-1">Adresse Email</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  placeholder="Adresse email"
                  className="h-[51px] w-full rounded-[15px] border-[3px] border-[#0f3460] bg-transparent py-0 pl-11 text-[15px] font-medium text-[#0f3460] placeholder:text-[rgba(15,52,96,0.62)] focus-visible:border-[#76BBDD] focus-visible:ring-0"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none" style={{ top: "32px" }}>
                  <Mail className="h-[18px] w-[18px] text-[#0f3460]" strokeWidth={2.5} />
                </div>
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-red-500 ml-1">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <div className="mt-5 w-full max-w-[352px]">
          <form.Field name="password">
            {(field) => (
              <div className="relative">
                <Label htmlFor={field.name} className="text-[#0f3460] font-medium text-[15px] block mb-1">Mot de passe</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  placeholder="Mot de passe"
                  className="h-[51px] w-full rounded-[15px] border-[3px] border-[#0f3460] bg-transparent py-0 pl-11 text-[15px] font-medium text-[#0f3460] placeholder:text-[rgba(15,52,96,0.62)] focus-visible:border-[#76BBDD] focus-visible:ring-0"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none" style={{ top: "32px" }}>
                  <Lock className="h-[18px] w-[18px] text-[#0f3460]" strokeWidth={2.5} />
                </div>
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-red-500 ml-1">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <form.Subscribe>
          {(state) => (
            <Button
              type="submit"
              className="mt-8 h-[51px] w-full max-w-[352px] rounded-[15px] bg-[#0f3460] text-[18px] font-bold text-white transition-colors hover:bg-[#0f3460]/90"
              disabled={state.isSubmitting}
            >
              {state.isSubmitting ? "Inscription en cours..." : "S'inscrire"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-5 text-center text-sm text-[#0f3460]">
        Vous avez déjà un compte ?{" "}
        <Button
          variant="link"
          onClick={onSwitchToSignIn}
          className="p-0 h-auto font-semibold text-[#052ca0] hover:text-[#76BBDD]"
        >
          Connectez-vous
        </Button>
      </div>
    </div>
  );
}
