"use client";

// ══════════════════════════════════════════════════════════════
// CHANGEMENT DE MOT DE PASSE
// Passage obligé après un mot de passe temporaire (création de compte ou
// réinitialisation par un administrateur), et accessible à tout moment
// depuis le menu de compte.
// ══════════════════════════════════════════════════════════════

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { AlertCircle, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { authService } from "@/services/api/authService";
import { getErrorMessage, setAccessToken } from "@/services/api/client";

const LONGUEUR_MINIMALE = 8;

/** Même règle que sur la page de connexion : jamais de renvoi hors du site. */
function destinationSure(brut: string | null): string {
  if (!brut || !brut.startsWith("/") || brut.startsWith("//")) return "/dashboard";
  return brut;
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: utilisateur, isLoading, isError } = useCurrentUser();

  const [actuel, setActuel] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Sans session, il n'y a pas de mot de passe à changer.
  useEffect(() => {
    if (!isLoading && isError) router.replace("/login");
  }, [isLoading, isError, router]);

  const trop_court = nouveau.length > 0 && nouveau.length < LONGUEUR_MINIMALE;
  const discordance = confirmation.length > 0 && confirmation !== nouveau;
  const identique = nouveau.length > 0 && nouveau === actuel;
  const valide =
    actuel.length > 0 && nouveau.length >= LONGUEUR_MINIMALE && !discordance && !identique;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!valide) return;

    setEnCours(true);
    setErreur(null);

    try {
      // Le serveur révoque les jetons du compte et en renvoie un neuf :
      // la session en cours continue sans repasser par la connexion.
      const jeton = await authService.changePassword(actuel, nouveau);
      setAccessToken(jeton);

      // Le profil porte « mot de passe à changer » : il doit être relu.
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });

      router.replace(destinationSure(new URLSearchParams(window.location.search).get("next")));
    } catch (err) {
      setErreur(getErrorMessage(err));
      setEnCours(false);
    }
  };

  const obligatoire = utilisateur?.mustChangePassword === true;

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-3">
          <Image src="/edc_logo.jpg" alt="EDC" width={36} height={36} className="size-9 rounded-md bg-white object-cover" />
          <span className="text-base font-bold text-fg">EDC Track</span>
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] font-bold tracking-tight text-fg">
            {obligatoire ? "Choisissez votre mot de passe" : "Changer mon mot de passe"}
          </h1>
          <p className="text-[13px] text-fg-muted">
            {obligatoire
              ? "Votre mot de passe actuel est temporaire. Remplacez-le pour accéder à l'application."
              : "Vos autres sessions seront fermées ; celle-ci reste ouverte."}
          </p>
        </div>

        {erreur && (
          <div role="alert" className="flex items-start gap-2.5 rounded-md bg-danger-subtle p-3 text-danger">
            <AlertCircle aria-hidden className="mt-px size-4 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <p className="text-[13px] font-semibold">Changement refusé</p>
              <p className="text-[12.5px] text-fg-muted">{erreur}</p>
            </div>
          </div>
        )}

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Field label="Mot de passe actuel" htmlFor="actuel" required>
            <Input
              id="actuel"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              leftIcon={Lock}
              value={actuel}
              onChange={(event) => setActuel(event.target.value)}
              className="h-10"
            />
          </Field>

          <Field
            label="Nouveau mot de passe"
            htmlFor="nouveau"
            required
            hint={`${LONGUEUR_MINIMALE} caractères au minimum.`}
            error={
              trop_court
                ? `Au moins ${LONGUEUR_MINIMALE} caractères.`
                : identique
                  ? "Choisissez un mot de passe différent de l'actuel."
                  : undefined
            }
          >
            <Input
              id="nouveau"
              name="newPassword"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              required
              leftIcon={ShieldCheck}
              value={nouveau}
              onChange={(event) => setNouveau(event.target.value)}
              className="h-10"
              rightIcon={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setVisible((v) => !v)}
                  aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  aria-pressed={visible}
                >
                  {visible ? <EyeOff /> : <Eye />}
                </Button>
              }
            />
          </Field>

          <Field
            label="Confirmation"
            htmlFor="confirmation"
            required
            error={discordance ? "Les deux saisies diffèrent." : undefined}
          >
            <Input
              id="confirmation"
              name="confirmPassword"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              required
              leftIcon={ShieldCheck}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="h-10"
            />
          </Field>

          <Button type="submit" loading={enCours} disabled={!valide} className="mt-2 h-10 w-full">
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </div>
    </div>
  );
}
