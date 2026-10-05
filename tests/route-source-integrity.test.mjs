import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Beauty Passport keeps newline delimiters escaped inside source strings", async () => {
  const source = await readFile(new URL("../src/routes/beauty-passport.tsx", import.meta.url), "utf8");
  assert.match(source, /sensitivities\.join\("\\n"\)/);
  assert.match(source, /\.split\("\\n"\)/);
  assert.doesNotMatch(source, /join\("\n"\)/);
});
