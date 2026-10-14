import { createFileRoute } from "@tanstack/react-router";
import { PasswordRecovery } from "@/components/glam/password-recovery";

export const Route = createFileRoute("/auth/confirm")({
  component: AuthConfirmPage,
  head: () => ({ meta: [{ name: "referrer", content: "no-referrer" }] }),
});

function AuthConfirmPage() {
  return <PasswordRecovery confirmLink />;
}
