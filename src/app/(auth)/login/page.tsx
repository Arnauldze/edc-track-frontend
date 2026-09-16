"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertCircle, Eye, EyeOff, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { login } from "@/lib/authStore";
import { getErrorMessage } from "@/services/api/client";

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login({ login: loginId, password });
      router.push("/dashboard");
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* ── Marque ── */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-nav p-10 lg:flex">
        <div className="flex items-center gap-3">
          <Image src="/edc_logo.jpg" alt="EDC" width={40} height={40} className="size-10 rounded-md bg-white object-cover" priority />
          <span className="flex flex-col leading-tight">
            <span className="text-base font-bold text-white">EDC Track</span>
            <span className="text-xs text-nav-muted">Pilotage des projets</span>
          </span>
        </div>

        <div className="flex max-w-md flex-col gap-4">
          <span aria-hidden className="h-1 w-12 rounded-full bg-accent" />
          <h1 className="text-[32px] font-bold leading-tight tracking-tight text-white">
            Planifier, suivre et piloter les projets d&apos;infrastructure électrique.
          </h1>
          <p className="text-[15px] leading-relaxed text-nav-fg">
            Structure des projets, planification des activités, passation des marchés et suivi de l&apos;exécution, au même endroit.
          </p>
        </div>

        <p className="text-xs text-nav-muted">© 2026 Electricity Development Corporation</p>
      </aside>

      {/* ── Connexion ── */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex items-center gap-3 lg:hidden">
            <Image src="/edc_logo.jpg" alt="EDC" width={36} height={36} className="size-9 rounded-md bg-white object-cover" />
            <span className="text-base font-bold text-fg">EDC Track</span>
          </div>

          <div className="flex flex-col gap-1">
            <h2 className="text-[22px] font-bold tracking-tight text-fg">Connexion</h2>
            <p className="text-[13px] text-fg-muted">Accédez à votre espace de pilotage.</p>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2.5 rounded-md bg-danger-subtle p-3 text-danger">
              <AlertCircle aria-hidden className="mt-px size-4 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <p className="text-[13px] font-semibold">Échec de la connexion</p>
                <p className="text-[12.5px] text-fg-muted">{error}</p>
              </div>
            </div>
          )}

          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <Field label="Identifiant" htmlFor="login">
              <Input
                id="login"
                name="login"
                autoComplete="off"
                required
                placeholder="Votre identifiant"
                leftIcon={User}
                value={loginId}
                onChange={(event) => setLoginId(event.target.value)}
                className="h-10"
                data-form-type="other"
              />
            </Field>

            <Field label="Mot de passe" htmlFor="password">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="off"
                required
                placeholder="Votre mot de passe"
                leftIcon={Lock}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-10"
                data-form-type="password"
                rightIcon={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                }
              />
            </Field>

            <Button type="submit" loading={loading} className="mt-2 h-10 w-full">
              {loading ? "Connexion…" : "Se connecter"}
            </Button>
          </form>

          <p className="rounded-md border border-line bg-inset px-3 py-2.5 text-center text-xs text-fg-muted">
            Démo : identifiant <code className="rounded-sm bg-surface px-1.5 py-0.5 font-mono text-fg">admin</code>, mot de passe{" "}
            <code className="rounded-sm bg-surface px-1.5 py-0.5 font-mono text-fg">admin123</code>
          </p>
        </div>
      </main>
    </div>
  );
}
