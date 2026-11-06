import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/lib/store/auth";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Sparkles } from "lucide-react";

export function LoginForm(): JSX.Element {
  const [email, setEmail] = useState("alex@workanywhere.dev");
  const signIn = useAuthStore((s) => s.signIn);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  return (
    <Screen>
      <div className="flex flex-col items-center justify-center px-2 pt-24">
        <div className="mb-8 flex h-16 w-16 items-center justify-center border-2 brutal-border-accent bg-accent brutal-shadow">
          <Sparkles className="h-8 w-8 text-black" strokeWidth={2} />
        </div>
        <h1 className="text-2xl font-extrabold uppercase tracking-label">CloudAgent Workspace</h1>
        <p className="mb-10 mt-2 text-center text-sm text-muted-text">
          Demo mode — any email signs you in. The backend isn't wired up yet; all state is local.
        </p>
        <form
          className="flex w-full flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            signIn(email.trim() || "alex@workanywhere.dev");
            navigate(from, { replace: true });
          }}
        >
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <Button type="submit" className="mt-1 w-full">
            Continue
          </Button>
        </form>
      </div>
    </Screen>
  );
}