import type { SupabaseClient } from "@supabase/supabase-js";
import { requireBusinessOrganization } from "../lib/business-access.ts";
import type { CustomerImportRow, ImportKind, ServiceImportRow } from "../domain/import-pipeline.ts";

export type ImportCommitResult = {
  batchId: string;
  accepted: number;
  rejected: number;
  failures: Array<{ row: number; message: string }>;
};

function rpcUnavailable(error: { code?: string } | null) {
  return error?.code === "PGRST202" || error?.code === "42883";
}

export function createImportCommitRepository(client: SupabaseClient) {
  return {
    async commit(
      organizationId: string,
      kind: ImportKind,
      rows: ServiceImportRow[] | CustomerImportRow[],
    ): Promise<ImportCommitResult> {
      await requireBusinessOrganization(client, organizationId);
      if (!rows.length) throw new Error("EMPTY_IMPORT");
      const { data, error } = await client.rpc("glam_commit_import_batch", {
        p_org: organizationId,
        p_kind: kind,
        p_rows: rows,
      });
      if (rpcUnavailable(error)) throw new Error("IMPORT_COMMIT_NOT_ENABLED");
      if (error) throw error;
      if (!data?.batch_id) throw new Error("IMPORT_NOT_CONFIRMED");
      return {
        batchId: data.batch_id,
        accepted: Number(data.accepted ?? 0),
        rejected: Number(data.rejected ?? 0),
        failures: Array.isArray(data.failures) ? data.failures : [],
      };
    },
  };
}
