import { open } from "node:fs/promises";
import { expect, test } from "vitest";
import DocumentParser from "../src/";

test("", async () => {
  const connector = await open("./connector.rb");

  const DocumentParser = new DocumentParser();

  expect(true).toBe(true);
});
