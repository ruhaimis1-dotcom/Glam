import assert from "node:assert/strict";
import test from "node:test";
import { validateCustomerRows, validateServiceRows } from "../src/domain/import-pipeline.ts";

test("customer import rejects every supported consent escalation field", () => {
  for (const field of [
    "consent",
    "consent_scopes",
    "passport_consent",
    "photo_consent",
    "sensitivities_consent",
  ]) {
    const result = validateCustomerRows([{ name: "عميلة", phone: "0500000000", [field]: "true" }]);
    assert.equal(result.valid.length, 0, field);
    assert.ok(result.issues.some((issue) => issue.field === field && issue.code === "forbidden"));
  }
});

test("service import cannot smuggle tenant identity into normalized rows", () => {
  const result = validateServiceRows([
    {
      name: "خدمة",
      price_sar: 100,
      minutes: 30,
      organization_id: "other-org",
      org_id: "other-org",
      tenant_id: "other-org",
    },
  ]);
  assert.equal(result.issues.length, 0);
  assert.deepEqual(Object.keys(result.valid[0]).sort(), ["active", "minutes", "name", "priceSar"]);
});

test("customer import cannot smuggle tenant identity into normalized rows", () => {
  const result = validateCustomerRows([
    {
      name: "عميلة",
      phone: "0500000000",
      organization_id: "other-org",
      org_id: "other-org",
      tenant_id: "other-org",
    },
  ]);
  assert.equal(result.issues.length, 0);
  assert.deepEqual(Object.keys(result.valid[0]).sort(), ["name", "phone"]);
});

test("invalid service rows never enter the normalized commit set", () => {
  const result = validateServiceRows([
    { name: "", price_sar: -1, minutes: 0 },
    { name: "صالحة", price_sar: 100, minutes: 30 },
  ]);
  assert.equal(result.valid.length, 1);
  assert.equal(result.valid[0].name, "صالحة");
  assert.ok(result.issues.length >= 3);
});
