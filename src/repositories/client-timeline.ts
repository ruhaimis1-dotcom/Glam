import type { SupabaseClient } from "@supabase/supabase-js";
import { requireBusinessOrganization } from "../lib/business-access.ts";

export type ClientTimelineItem = {
  id: string;
  kind: "booking" | "note" | "followup" | "communication";
  occurredAt: string;
  title: string;
  detail: string | null;
};

type TimelineRow = {
  id: string;
  kind: ClientTimelineItem["kind"];
  occurred_at: string;
  title: string;
  detail: string | null;
};

export function createClientTimelineRepository(client: SupabaseClient) {
  return {
    async list(organizationId: string, contactId: string): Promise<ClientTimelineItem[]> {
      await requireBusinessOrganization(client, organizationId);
      const { data, error } = await client.rpc("glam_client_timeline", {
        p_org: organizationId,
        p_contact: contactId,
      });
      if (error?.code === "PGRST202" || error?.code === "42883")
        throw new Error("CLIENT_360_NOT_ENABLED");
      if (error || data === null) throw error ?? new Error("TIMELINE_NOT_CONFIRMED");

      return (data as TimelineRow[])
        .filter((row) => ["booking", "note", "followup", "communication"].includes(row.kind))
        .map((row) => ({
          id: row.id,
          kind: row.kind,
          occurredAt: row.occurred_at,
          title: row.title,
          detail: row.detail,
        }));
    },
  };
}
