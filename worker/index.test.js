import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { nearestColorPreset, toWalletWalletPayload } from "./index.js";

const builderPass = {
  logoText: "Northstar",
  organizationName: "Northstar Club",
  passDescription: "Membership card",
  colors: { background: "#087A5B" },
  barcode: {
    format: "PKBarcodeFormatQR",
    message: "MEMBER-123",
  },
  fields: {
    header: [{ label: "STATUS", value: "GOLD" }],
    primary: [{ label: "MEMBER", value: "ALEX" }],
    secondary: [{ label: "NUMBER", value: "123" }],
    auxiliary: [{ label: "POINTS", value: "100" }],
    back: [{ label: "HELP", value: "support@example.com" }],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WalletWallet mapping", () => {
  it("maps the builder contract to the managed signing API", () => {
    expect(toWalletWalletPayload(builderPass)).toMatchObject({
      barcodeValue: "MEMBER-123",
      barcodeFormat: "QR",
      logoText: "Northstar",
      colorPreset: "green",
      sharingProhibited: false,
      secondaryFields: [
        { label: "NUMBER", value: "123" },
        { label: "POINTS", value: "100" },
      ],
    });
  });

  it("includes custom colors and artwork on Pro plans", () => {
    const payload = toWalletWalletPayload(
      {
        ...builderPass,
        colors: {
          background: "#123456",
          foreground: "#ffffff",
          label: "#eeeeee",
        },
        assets: {
          logo: "data:image/png;base64,bG9nbw==",
          strip: "",
          thumbnail: "",
        },
      },
      { allowProFields: true },
    );

    expect(payload).toMatchObject({
      color: "#123456",
      logoURL: "data:image/png;base64,bG9nbw==",
      iconURL: "data:image/png;base64,bG9nbw==",
    });
    expect(payload).not.toHaveProperty("colorPreset");
  });

  it("selects the nearest free color preset", () => {
    expect(nearestColorPreset("#5B4BDE")).toBe("purple");
    expect(nearestColorPreset("#F04438")).toBe("red");
  });
});

describe("WalletWallet worker", () => {
  it("rejects pass creation from an unknown website", async () => {
    const request = new Request("https://worker.example/api/passes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://attacker.example",
      },
      body: JSON.stringify(builderPass),
    });

    const response = await worker.fetch(request, {
      ALLOWED_ORIGINS: "https://aliomar0.github.io",
      WALLETWALLET_API_KEY: "secret",
    });

    expect(response.status).toBe(403);
  });

  it("reports an unconfigured key without exposing a secret", async () => {
    const request = new Request("https://worker.example/api/health");
    const response = await worker.fetch(request, {
      ALLOWED_ORIGINS: "https://aliomar0.github.io",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      signingConfigured: false,
      provider: "WalletWallet",
    });
  });

  it("returns the hosted install page from WalletWallet", async () => {
    const providerFetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          count: 0,
          limit: 100000,
          remaining: 100000,
          plan: "pro",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          serialNumber: "serial-123",
          googleSaveUrl: "https://pay.google.com/example",
          applePass: "base64-is-not-forwarded",
          shareUrl: "https://api.walletwallet.dev/p/serial-123",
        }),
      );
    vi.stubGlobal("fetch", providerFetch);

    const request = new Request("https://worker.example/api/passes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://aliomar0.github.io",
        "CF-Connecting-IP": "203.0.113.7",
      },
      body: JSON.stringify(builderPass),
    });
    const response = await worker.fetch(request, {
      ALLOWED_ORIGINS: "https://aliomar0.github.io",
      WALLETWALLET_API_KEY: "ww_live_private",
    });
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result.downloadUrl).toBe("https://api.walletwallet.dev/p/serial-123");
    expect(result.appearanceMode).toBe("custom");
    expect(JSON.stringify(result)).not.toContain("base64-is-not-forwarded");
    expect(providerFetch).toHaveBeenLastCalledWith(
      "https://api.walletwallet.dev/api/passes",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer ww_live_private",
        }),
      }),
    );
  });
});
