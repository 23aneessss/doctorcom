import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";
import { Lock, User } from "lucide-react";

import { authClient } from "@/lib/auth-client";

import { AuthFormSkeleton } from "./page-skeletons";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export default function SignInForm({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
  const navigate = useNavigate({
    from: "/login",
  });
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "tbib@doctorcom.com",
      password: "doctor123!",
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onSuccess: () => {
            navigate({
              to: "/dashboard",
            });
            toast.success("Connexion réussie");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.string().min(1, "L'email ou le nom d'utilisateur est requis"),
        password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
      }),
    },
  });

  if (isPending) {
    return <AuthFormSkeleton />;
  }

  return (
    <div className="flex w-full flex-col items-center">
      <h1 className="font-['Plus_Jakarta_Sans'] text-[40px] font-bold leading-none text-[#0f3460]">
        Connexion
      </h1>

      <p className="mt-12 max-w-[360px] text-center font-['Plus_Jakarta_Sans'] text-[18px] font-semibold leading-[1.45] text-[#0f3460]">
        Veuillez entrer votre nom d'utilisateur et votre mot de passe
      </p>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="mt-12 flex w-full flex-col items-center"
      >
        <div className="w-full max-w-[352px]">
          <form.Field name="email">
            {(field) => (
              <div className="relative">
                <Input
                  autoComplete="email"
                  id={field.name}
                  name={field.name}
                  type="text"
                  placeholder="Nom d'utilisateur ou email"
                  className="h-[51px] w-full rounded-[15px] border-[3px] border-[#76bbdd] bg-transparent py-0 pl-11 font-['Inter'] text-[15px] font-medium text-[#0f3460] placeholder:text-[rgba(15,52,96,0.62)] focus-visible:border-[#0f3460] focus-visible:ring-0"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <User className="h-[18px] w-[18px] text-[#0f3460]" strokeWidth={2.5} />
                </div>
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="ml-1 mt-1 text-sm text-red-500">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <div className="mt-8 w-full max-w-[352px]">
          <form.Field name="password">
            {(field) => (
              <div className="relative">
                <Input
                  autoComplete="current-password"
                  id={field.name}
                  name={field.name}
                  type="password"
                  placeholder="Mot de passe"
                  className="h-[51px] w-full rounded-[15px] border-[3px] border-[#0f3460] bg-transparent py-0 pl-11 font-['Inter'] text-[15px] font-medium text-[#0f3460] placeholder:text-[rgba(15,52,96,0.62)] focus-visible:border-[#76bbdd] focus-visible:ring-0"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <Lock className="h-[18px] w-[18px] text-[#0f3460]" strokeWidth={2.5} />
                </div>
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-red-500 ml-1 mt-1">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>

          <div className="text-right mt-1.5">
            <Button variant="link" className="px-0 py-0 h-auto text-[12px] text-[#052ca0] hover:text-[#0f3460] font-semibold" type="button">
              Mot de passe oublié ?
            </Button>
          </div>
        </div>

        <form.Subscribe>
          {(state) => (
            <Button
              type="submit"
              className="mt-9 h-[51px] w-full max-w-[352px] rounded-[15px] bg-[#0f3460] font-['Plus_Jakarta_Sans'] text-[18px] font-bold text-white shadow-[0_14px_26px_-18px_rgba(15,52,96,0.65)] transition-colors hover:bg-[#0f3460]/90"
              disabled={state.isSubmitting}
            >
              {state.isSubmitting ? "Connexion en cours..." : "Connexion"}
            </Button>
          )}
        </form.Subscribe>
      </form>


<div className="mt-5 text-center text-sm text-[#0f3460]">
        Vous n'avez pas de compte ?{" "}
        <Button
          variant="link"
          onClick={onSwitchToSignUp}
          className="p-0 h-auto font-semibold text-[#052ca0] hover:text-[#76BBDD]"
        >
          Inscrivez-vous
        </Button>
      </div>
    </div>
  );
}
