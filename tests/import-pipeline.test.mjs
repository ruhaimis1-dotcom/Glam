import assert from "node:assert/strict";
import test from "node:test";
import { validateCustomerRows, validateServiceRows } from "../src/domain/import-pipeline.ts";

test("valid service rows are normalized without trusting organization ids", () => {
  const result = validateServiceRows([
    {\n      name: "قص شعر",\n      price_sar: "120",\n      minutes: "45",\n      category: "شعر",\n      organization_id: "evil-org",\n    },
  ]);
  assert.equal(result.issues.length, 0);
  assert.deepEqual(result.valid[0], {
    name: "قص شعر",
    priceSar: 120,
    minutes: 45,
    category: "شعر",
    active: true,
  });
  assert.equal("organizationId" in result.valid[0], false);
});

test("duplicate service names inside the file are rejected", () => {
  const result = validateServiceRows([
    { name: "مناكير", price_sar: 80, minutes: 30 },
    { name: "مناكير", price_sar: 90, minutes: 40 },
  ]);
  assert.equal(result.valid.length, 1);
  assert.ok(result.issues.some((issue) => issue.code === "duplicate"));
});

test("customer import requires a contact channel", () => {
  const result = validateCustomerRows([{ name: "نورة" }]);
  assert.equal(result.valid.length, 0);
  assert.ok(result.issues.some((issue) => issue.field === "email/phone"));
});

test("customer consent can never be imported from a spreadsheet", () => {
  const result = validateCustomerRows([
    { name: "سارة", phone: "0500000000", passport_consent: "yes" },
  ]);
  assert.equal(result.valid.length, 0);
  assert.ok(result.issues.some((issue) => issue.code === "forbidden"));
});

test("unknown organization id in customer file is not part of normalized output", () => {
  const result = validateCustomerRows([
    { name: "ريم", email: "reem@example.test", organization_id: "other-org" },
  ]);
  assert.equal(result.issues.length, 0);
  assert.equal("organizationId" in result.valid[0], false);
});
