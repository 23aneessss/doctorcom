import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";
import { Lock, User } from "lucide-react";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export default function SignInForm({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
  const navigate = useNavigate({
    from: "/",
  });
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
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
    return <Loader />;
  }

  return (
    <div className="w-full">
      {/* Title */}
      <h1 className="text-[40px] font-bold text-[#0f3460] leading-[1]">Connexion</h1>
      
      {/* Subtitle */}
      <p className="text-[18px] text-[#0f3460] font-medium mt-[97px]">
        Veuillez entrer votre nom d'utilisateur et votre mot de passe
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="mt-[91px]"
      >
        <div>
          <form.Field name="email">
            {(field) => (
              <div className="relative">
                <Input
                  id={field.name}
                  name={field.name}
                  type="text"
                  placeholder="Nom d'utilisateur ou email"
                  className="h-[51.262px] w-[352px] pl-11 py-0 rounded-[15px] border-[3px] border-[#0f3460] bg-transparent focus-visible:ring-0 focus-visible:border-[#76BBDD] text-[#0f3460] text-[15px] font-medium placeholder:text-[#0f3460]"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
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

        <div className="mt-[57px]">
          <form.Field name="password">
            {(field) => (
              <div className="relative">
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  placeholder="Mot de passe"
                  className="h-[51.262px] w-[352px] pl-11 py-0 rounded-[15px] border-[3px] border-[#0f3460] bg-transparent focus-visible:ring-0 focus-visible:border-[#76BBDD] text-[#0f3460] text-[15px] font-medium placeholder:text-[#0f3460]"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
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
              className="w-[352px] h-[51.262px] bg-[#0f3460] hover:bg-[#0f3460]/90 text-white text-[18px] font-bold rounded-[15px] mt-[97px] transition-colors"
              disabled={!state.canSubmit || state.isSubmitting}
            >
              {state.isSubmitting ? "Connexion en cours..." : "Connexion"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-[182px] text-center text-sm text-[#0f3460]">
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