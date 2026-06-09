import { afterEach, describe, expect, it } from "vitest";
import { createPass, signingConfiguration } from "./pass-service.js";

const signingVariables = [
  "APPLE_PASS_TYPE_IDENTIFIER",
  "APPLE_TEAM_IDENTIFIER",
  "APPLE_WWDR_CERT_PATH",
  "APPLE_WWDR_CERT_BASE64",
  "APPLE_SIGNER_CERT_PATH",
  "APPLE_SIGNER_CERT_BASE64",
  "APPLE_SIGNER_KEY_PATH",
  "APPLE_SIGNER_KEY_BASE64",
];

const originalEnvironment = Object.fromEntries(
  signingVariables.map((name) => [name, process.env[name]]),
);

afterEach(() => {
  for (const name of signingVariables) {
    if (originalEnvironment[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnvironment[name];
  }
});

describe("signingConfiguration", () => {
  it("reports missing Apple credentials", () => {
    for (const name of signingVariables) delete process.env[name];

    const config = signingConfiguration();

    expect(config.configured).toBe(false);
    expect(config.missing).toContain("APPLE_PASS_TYPE_IDENTIFIER");
    expect(config.missing).toContain("APPLE_SIGNER_KEY");
  });
});

describe("createPass", () => {
  it("validates builder payloads before trying to sign", async () => {
    await expect(createPass({ passType: "not-a-pass" })).rejects.toMatchObject({
      name: "ZodError",
    });
  });
});
