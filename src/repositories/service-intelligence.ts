import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogService, CatalogCategory, ServiceInput } from "../domain/business-catalog.ts";
import { validateService } from "../domain/business-catalog.ts";
import { requireBusinessOrganization } from "../lib/business-access.ts";

const serviceColumns =
  "id,organization_id,name,minutes,price_sar,active,revision,category_id,subcategory_id,pricing_mode,buffer_minutes";

export function createCatalogRepository(client: SupabaseClient) {
  async function load(organizationId: string) {
    await requireBusinessOrganization(client, organizationId);
    const results = await Promise.all([
      client
        .from("glam_services")
        .select(serviceColumns)
        .eq("organization_id", organizationId)
        .order("name"),
      client
        .from("glam_service_categories")
        .select("id,organization_id,name,sort_order,active")
        .eq("organization_id", organizationId)
        .order("sort_order")
        .order("name"),
      client
        .from("glam_service_subcategories")
        .select("id,organization_id,category_id,name,sort_order,active")
        .eq("organization_id", organizationId)
        .order("sort_order")
        .order("name"),
    ]);
    for (const result of results) if (result.error) throw result.error;
    return {
      services: (results[0]!.data ?? []) as CatalogService[],
      categories: (results[1]!.data ?? []) as CatalogCategory[],
      subcategories: (results[2]!.data ?? []) as CatalogCategory[],
    };
  }

  async function saveService(organizationId: string, id: string | null, input: ServiceInput) {
    validateService(input);
    await requireBusinessOrganization(client, organizationId);
    // One transaction validates ownership, category hierarchy and revision.
    // Requires the reviewed SQL proposal; missing RPC errors are never hidden.
    const { data, error } = await client.rpc("glam_save_catalog_service", {
      p_org: organizationId,
      p_id: id,
      p_name: input.name.trim(),
      p_minutes: input.minutes,
      p_price: input.price_sar,
      p_active: input.active,
      p_category: input.category_id,
      p_subcategory: input.subcategory_id,
      p_pricing_mode: input.pricing_mode,
      p_buffer: input.buffer_minutes,
    });
    if (error) throw error;
    if (!data) throw new Error("WRITE_NOT_CONFIRMED");
    return String(data);
  }

  async function deleteService(organizationId: string, id: string) {
    await requireBusinessOrganization(client, organizationId);
    const { data, error } = await client.rpc("glam_delete_catalog_service", {
      p_org: organizationId,
      p_id: id,
    });
    if (error) throw error;
    if (data !== id) throw new Error("WRITE_NOT_CONFIRMED");
  }

  async function saveCategory(
    organizationId: string,
    id: string | null,
    name: string,
    parentId: string | null = null,
  ) {
    if (!name.trim() || name.trim().length > (parentId ? 120 : 80)) throw new Error("INVALID_NAME");
    await requireBusinessOrganization(client, organizationId);
    const { data, error } = await client.rpc("glam_save_catalog_category", {
      p_org: organizationId,
      p_id: id,
      p_name: name.trim(),
      p_parent: parentId,
    });
    if (error) throw error;
    if (!data) throw new Error("WRITE_NOT_CONFIRMED");
    return String(data);
  }

  async function deleteCategory(organizationId: string, id: string, isSubcategory: boolean) {
    await requireBusinessOrganization(client, organizationId);
    const { data, error } = await client.rpc("glam_delete_catalog_category", {
      p_org: organizationId,
      p_id: id,
      p_subcategory: isSubcategory,
    });
    if (error) throw error;
    if (data !== id) throw new Error("WRITE_NOT_CONFIRMED");
  }
  return { load, saveService, deleteService, saveCategory, deleteCategory };
}
