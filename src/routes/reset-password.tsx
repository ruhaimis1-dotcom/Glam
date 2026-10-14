import { createFileRoute } from "@tanstack/react-router";
import { PasswordRecovery } from "@/components/glam/password-recovery";

export const Route = createFileRoute("/reset-password")({
  component: PasswordRecovery,
  head: () => ({ meta: [{ name: "referrer", content: "no-referrer" }] }),
});
