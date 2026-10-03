import { createContext, useContext } from "react";
import type { BusinessOrganization } from "./business-access";

export const BusinessContext = createContext<BusinessOrganization | null>(null);

export function useBusinessOrganization() {
  const organization = useContext(BusinessContext);
  if (!organization) throw new Error("BUSINESS_CONTEXT_REQUIRED");
  return organization;
}
