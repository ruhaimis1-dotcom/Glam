import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const guardedSources = [
  "../src/domain/import-pipeline.ts",
  "../src/lib/excel-import.ts",
  "../src/repositories/import-commit.ts",
  "../src/repositories/passport-consent.ts",
  "../src/repositories/beauty-passport.ts",
  "../src/routes/business.import.tsx",
  "../src/routes/beauty-passport.consents.tsx",
  "../src/routes/profile.tsx",
];

test("P2/P3 source files contain no literal backslash-n formatting corruption", async () => {
  for (const path of guardedSources) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\\n\s{2,}[A-Za-z{.(]/, path);
  }
});

test("Beauty Passport keeps intended newline delimiters escaped inside strings", async () => {
  const source = await readFile(new URL("../src/routes/beauty-passport.tsx", import.meta.url), "utf8");
  assert.match(source, /sensitivities\.join\("\\n"\)/);
  assert.match(source, /\.split\("\\n"\)/);
});
