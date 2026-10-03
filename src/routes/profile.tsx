import { createFileRoute, Link } from "@tanstack/react-router";
import { UserRound, ArrowRight } from "lucide-react";
import { CustomerShell } from "@/components/glam/shells";
import { EmptyState } from "@/components/glam/ui";

export const Route = createFileRoute("/profile")({ component: ProfilePage });
function ProfilePage() {
  return (
    <CustomerShell title="ملفي">
      <div className="mb-6 flex items-center gap-3">
        <Link to="/" className="grid size-9 place-items-center rounded-full border bg-card">
          <ArrowRight className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">ملفي</h1>
          <p className="text-sm text-muted-foreground">إعداداتك وتفضيلات الخصوصية</p>
        </div>
      </div>
      <EmptyState
        icon={UserRound}
        title="ملفك جاهز للتخصيص"
        desc="أضيفي بياناتك وتفضيلاتك لتجربة حجز أسهل وأكثر خصوصية."
        action={
          <button
            type="button"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            إضافة البيانات
          </button>
        }
      />
    </CustomerShell>
  );
}
