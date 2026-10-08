import type { SupabaseClient } from "@supabase/supabase-js";
import { requireBusinessOrganization } from "../lib/business-access.ts";

export type ClientContact = {
  id: string;
  organizationId: string;
  linkedCustomerId: string | null;
  displayName: string;
  phone: string | null;
  email: string | null;
  source: string;
};

export type ClientContactInput = {
  displayName: string;
  phone?: string;
  email?: string;
};

type ContactRow = {
  id: string;
  organization_id: string;
  linked_customer_id: string | null;
  display_name: string;
  phone: string | null;
  email: string | null;
  source: string;
};

function schemaUnavailable(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function normalizeContact(row: ContactRow): ClientContact {
  return {
    id: row.id,
    organizationId: row.organization_id,
    linkedCustomerId: row.linked_customer_id,
    displayName: row.display_name,
    phone: row.phone,
    email: row.email,
    source: row.source,
  };
}

export function createClient360Repository(client: SupabaseClient) {
  return {
    async list(organizationId: string): Promise<ClientContact[]> {
      await requireBusinessOrganization(client, organizationId);
      const { data, error } = await client
        .from("glam_client_contacts")
        .select("id,organization_id,linked_customer_id,display_name,phone,email,source")
        .eq("organization_id", organizationId)
        .order("display_name");
      if (schemaUnavailable(error)) throw new Error("CLIENT_360_NOT_ENABLED");
      if (error || data === null) throw error ?? new Error("READ_NOT_CONFIRMED");
      return (data as ContactRow[]).map(normalizeContact);
    },

    async get(organizationId: string, contactId: string): Promise<ClientContact> {
      await requireBusinessOrganization(client, organizationId);
      const { data, error } = await client
        .from("glam_client_contacts")
        .select("id,organization_id,linked_customer_id,display_name,phone,email,source")
        .eq("organization_id", organizationId)
        .eq("id", contactId)
        .single();
      if (schemaUnavailable(error)) throw new Error("CLIENT_360_NOT_ENABLED");
      if (error || !data) throw error ?? new Error("CONTACT_NOT_FOUND");
      return normalizeContact(data as ContactRow);
    },

    async findDuplicateSignals(
      organizationId: string,
      input: ClientContactInput,
    ): Promise<ClientContact[]> {
      await requireBusinessOrganization(client, organizationId);
      const phone = input.phone?.trim();
      const email = input.email?.trim().toLowerCase();
      if (!phone && !email) return [];

      const { data, error } = await client.rpc("glam_find_client_contact_duplicates", {
        p_org: organizationId,
        p_phone: phone ?? null,
        p_email: email ?? null,
      });
      if (error?.code === "PGRST202" || error?.code === "42883")
        throw new Error("CLIENT_360_NOT_ENABLED");
      if (error || data === null) throw error ?? new Error("DUPLICATE_CHECK_NOT_CONFIRMED");
      return (data as ContactRow[]).map(normalizeContact);
    },

    async create(organizationId: string, input: ClientContactInput): Promise<ClientContact> {
      await requireBusinessOrganization(client, organizationId);
      const displayName = input.displayName.trim();
      const phone = input.phone?.trim();
      const email = input.email?.trim().toLowerCase();
      if (!displayName) throw new Error("DISPLAY_NAME_REQUIRED");
      if (!phone && !email) throw new Error("CONTACT_CHANNEL_REQUIRED");

      const { data, error } = await client.rpc("glam_create_client_contact", {
        p_org: organizationId,
        p_display_name: displayName,
        p_phone: phone ?? null,
        p_email: email ?? null,
      });
      if (error?.code === "PGRST202" || error?.code === "42883")
        throw new Error("CLIENT_360_NOT_ENABLED");
      if (error || !data) throw error ?? new Error("CREATE_NOT_CONFIRMED");
      return normalizeContact(data as ContactRow);
    },
  };
}
