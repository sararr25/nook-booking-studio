import { type FormEvent, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/nook/wordmark";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { POST_AUTH_KEY } from "@/components/nook/oauth-return";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    notice: search["notice"] === "owner-only" ? "owner-only" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Owner sign in | Nook" },
      { name: "description", content: "Secure sign in for the Stillroom Tattoo owner workspace." },
      { property: "og:title", content: "Owner sign in | Nook" },
      {
        property: "og:description",
        content: "Secure access to bookings, availability, artists and flash designs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerAuth,
});

function OwnerAuth() {
  const navigate = useNavigate();
  const { notice } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void navigate({ to: "/owner" });
    });
  }, [navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name }, emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data.session) {
        toast.success("Check your email to confirm your account.");
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    await navigate({ to: "/owner" });
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    sessionStorage.setItem(POST_AUTH_KEY, "/owner");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    setBusy(false);
    if (result.error) {
      sessionStorage.removeItem(POST_AUTH_KEY);
      toast.error(String(result.error));
      return;
    }
    if (result.redirected) return;
    sessionStorage.removeItem(POST_AUTH_KEY);
    await navigate({ to: "/owner" });
  };

  return (
    <main className="grid min-h-screen bg-secondary p-3 lg:grid-cols-[1fr_30rem] lg:p-5">
      <section className="hidden rounded-l-sm border border-r-0 border-border bg-card p-12 lg:flex lg:flex-col lg:justify-between">
        <Wordmark />
        <div className="max-w-xl">
          <h1 className="display text-5xl">Everything in its place.</h1>
          <p className="mt-6 max-w-md leading-relaxed text-muted-foreground">
            Review requests, shape your calendar, set honest prices and keep the flash book current.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Stillroom Tattoo · Malmö</p>
      </section>
      <section className="flex items-center rounded-sm border border-border bg-card px-6 py-14 lg:rounded-l-none sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Wordmark className="lg:hidden" />
          <p className="eyebrow mt-12 lg:mt-0">Owner access</p>
          <h2 className="display mt-3 text-3xl">
            {mode === "signin" ? "Welcome back" : "Create your studio account"}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {notice
              ? "This area is reserved for the studio owner."
              : "Sign in to manage Stillroom Tattoo."}
          </p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && <AuthField label="Your name" value={name} onChange={setName} />}
            <AuthField label="Email" value={email} onChange={setEmail} type="email" />
            <AuthField label="Password" value={password} onChange={setPassword} type="password" />
            <Button className="h-12 w-full rounded-sm" disabled={busy}>
              {busy ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  {mode === "signin" ? "Sign in" : "Create account"}
                  <ArrowRight />
                </>
              )}
            </Button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-sm"
            disabled={busy}
            onClick={signInWithGoogle}
          >
            Continue with Google
          </Button>
          <button
            type="button"
            className="mt-6 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin"
              ? "First time here? Create the owner account"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </section>
    </main>
  );
}

function AuthField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block">{label}</span>
      <input
        required
        minLength={type === "password" ? 8 : undefined}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full rounded-sm border border-border bg-card px-3 outline-none focus:border-brand"
      />
    </label>
  );
}
