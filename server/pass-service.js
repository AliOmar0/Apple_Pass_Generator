import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PKPass } from "passkit-generator";
import sharp from "sharp";
import { z } from "zod";

const fieldSchema = z.object({
  key: z.string().min(1).max(64),
  label: z.string().max(128),
  value: z.union([z.string(), z.number()]),
});

const requestSchema = z.object({
  passType: z.enum(["generic", "eventTicket", "coupon", "storeCard", "boardingPass"]),
  logoText: z.string().min(1).max(64),
  organizationName: z.string().min(1).max(128),
  passDescription: z.string().min(1).max(256),
  colors: z.object({
    background: z.string().regex(/^#[0-9a-f]{6}$/i),
    foreground: z.string().regex(/^#[0-9a-f]{6}$/i),
    label: z.string().regex(/^#[0-9a-f]{6}$/i),
  }),
  barcode: z.object({
    format: z.enum([
      "PKBarcodeFormatQR",
      "PKBarcodeFormatPDF417",
      "PKBarcodeFormatAztec",
      "PKBarcodeFormatCode128",
    ]),
    message: z.string().min(1).max(2048),
    altText: z.string().max(256).optional().default(""),
  }),
  fields: z.object({
    header: z.array(fieldSchema).max(3),
    primary: z.array(fieldSchema).max(2),
    secondary: z.array(fieldSchema).max(4),
    auxiliary: z.array(fieldSchema).max(5),
    back: z.array(fieldSchema).max(20),
  }),
  assets: z.object({
    logo: z.string().max(10_000_000).optional().default(""),
    strip: z.string().max(10_000_000).optional().default(""),
    thumbnail: z.string().max(10_000_000).optional().default(""),
  }),
  relevantDate: z.string().optional().default(""),
  expirationDate: z.string().optional().default(""),
  advancedJson: z.string().max(50_000).optional().default("{}"),
});

const protectedKeys = new Set([
  "formatVersion",
  "passTypeIdentifier",
  "serialNumber",
  "teamIdentifier",
  "organizationName",
  "description",
  "generic",
  "eventTicket",
  "coupon",
  "storeCard",
  "boardingPass",
]);

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return `rgb(${Number.parseInt(value.slice(0, 2), 16)}, ${Number.parseInt(value.slice(2, 4), 16)}, ${Number.parseInt(value.slice(4, 6), 16)})`;
}

function readCredential(pathName, base64Name) {
  if (process.env[base64Name]) {
    return Buffer.from(process.env[base64Name], "base64");
  }

  const credentialPath = process.env[pathName];
  if (!credentialPath) return null;
  return fs.readFileSync(path.resolve(credentialPath));
}

export function signingConfiguration() {
  const requiredValues = [
    process.env.APPLE_PASS_TYPE_IDENTIFIER,
    process.env.APPLE_TEAM_IDENTIFIER,
    process.env.APPLE_WWDR_CERT_PATH || process.env.APPLE_WWDR_CERT_BASE64,
    process.env.APPLE_SIGNER_CERT_PATH || process.env.APPLE_SIGNER_CERT_BASE64,
    process.env.APPLE_SIGNER_KEY_PATH || process.env.APPLE_SIGNER_KEY_BASE64,
  ];

  return {
    configured: requiredValues.every(Boolean),
    missing: [
      ["APPLE_PASS_TYPE_IDENTIFIER", process.env.APPLE_PASS_TYPE_IDENTIFIER],
      ["APPLE_TEAM_IDENTIFIER", process.env.APPLE_TEAM_IDENTIFIER],
      ["APPLE_WWDR_CERT", process.env.APPLE_WWDR_CERT_PATH || process.env.APPLE_WWDR_CERT_BASE64],
      ["APPLE_SIGNER_CERT", process.env.APPLE_SIGNER_CERT_PATH || process.env.APPLE_SIGNER_CERT_BASE64],
      ["APPLE_SIGNER_KEY", process.env.APPLE_SIGNER_KEY_PATH || process.env.APPLE_SIGNER_KEY_BASE64],
    ].filter(([, value]) => !value).map(([name]) => name),
  };
}

function dataUrlBuffer(dataUrl) {
  if (!dataUrl) return null;
  const match = dataUrl.match(/^data:image\/(?:png|jpeg|webp);base64,(.+)$/);
  if (!match) throw new Error("Images must be PNG, JPEG, or WebP files.");
  return Buffer.from(match[1], "base64");
}

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  })[character]);
}

async function fallbackIcon(background, text) {
  const initials = text
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const svg = `
    <svg width="174" height="174" viewBox="0 0 174 174" xmlns="http://www.w3.org/2000/svg">
      <rect width="174" height="174" rx="38" fill="${background}"/>
      <text x="87" y="105" text-anchor="middle" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#fff">${escapeXml(initials || "W")}</text>
    </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function resizeAsset(input, width, height, fit = "contain") {
  return sharp(input)
    .resize(width, height, { fit, withoutEnlargement: false })
    .png()
    .toBuffer();
}

function parseAdvancedJson(value) {
  let parsed;
  try {
    parsed = JSON.parse(value || "{}");
  } catch {
    throw new Error("Additional PassKit JSON is not valid JSON.");
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Additional PassKit JSON must be an object.");
  }
  for (const key of protectedKeys) delete parsed[key];
  return parsed;
}

export async function createPass(payload) {
  const data = requestSchema.parse(payload);
  const config = signingConfiguration();
  if (!config.configured) {
    const error = new Error(`Apple signing is not configured. Missing: ${config.missing.join(", ")}.`);
    error.statusCode = 503;
    throw error;
  }

  const certificates = {
    wwdr: readCredential("APPLE_WWDR_CERT_PATH", "APPLE_WWDR_CERT_BASE64"),
    signerCert: readCredential("APPLE_SIGNER_CERT_PATH", "APPLE_SIGNER_CERT_BASE64"),
    signerKey: readCredential("APPLE_SIGNER_KEY_PATH", "APPLE_SIGNER_KEY_BASE64"),
    signerKeyPassphrase: process.env.APPLE_SIGNER_KEY_PASSPHRASE || undefined,
  };

  const style = {
    headerFields: data.fields.header,
    primaryFields: data.fields.primary,
    secondaryFields: data.fields.secondary,
    auxiliaryFields: data.fields.auxiliary,
    backFields: data.fields.back,
  };
  if (data.passType === "boardingPass") style.transitType = "PKTransitTypeAir";

  const advanced = parseAdvancedJson(data.advancedJson);
  const props = {
    ...advanced,
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_IDENTIFIER,
    teamIdentifier: process.env.APPLE_TEAM_IDENTIFIER,
    serialNumber: crypto.randomUUID(),
    organizationName: data.organizationName,
    description: data.passDescription,
    logoText: data.logoText,
    backgroundColor: hexToRgb(data.colors.background),
    foregroundColor: hexToRgb(data.colors.foreground),
    labelColor: hexToRgb(data.colors.label),
    [data.passType]: style,
  };

  if (data.relevantDate) props.relevantDate = new Date(data.relevantDate).toISOString();
  if (data.expirationDate) props.expirationDate = new Date(data.expirationDate).toISOString();

  const pass = new PKPass({}, certificates, props);
  pass.setBarcodes({
    format: data.barcode.format,
    message: data.barcode.message,
    messageEncoding: "iso-8859-1",
    altText: data.barcode.altText || undefined,
  });

  const logoInput = dataUrlBuffer(data.assets.logo);
  const iconInput = logoInput || await fallbackIcon(data.colors.background, data.logoText);
  pass.addBuffer("icon.png", await resizeAsset(iconInput, 29, 29, "cover"));
  pass.addBuffer("icon@2x.png", await resizeAsset(iconInput, 58, 58, "cover"));
  pass.addBuffer("icon@3x.png", await resizeAsset(iconInput, 87, 87, "cover"));

  if (logoInput) {
    pass.addBuffer("logo.png", await resizeAsset(logoInput, 160, 50));
    pass.addBuffer("logo@2x.png", await resizeAsset(logoInput, 320, 100));
    pass.addBuffer("logo@3x.png", await resizeAsset(logoInput, 480, 150));
  }

  const stripInput = dataUrlBuffer(data.assets.strip);
  if (stripInput && data.passType !== "boardingPass") {
    pass.addBuffer("strip.png", await resizeAsset(stripInput, 375, 123, "cover"));
    pass.addBuffer("strip@2x.png", await resizeAsset(stripInput, 750, 246, "cover"));
    pass.addBuffer("strip@3x.png", await resizeAsset(stripInput, 1125, 369, "cover"));
  }

  const thumbnailInput = dataUrlBuffer(data.assets.thumbnail);
  if (thumbnailInput) {
    pass.addBuffer("thumbnail.png", await resizeAsset(thumbnailInput, 90, 90, "cover"));
    pass.addBuffer("thumbnail@2x.png", await resizeAsset(thumbnailInput, 180, 180, "cover"));
    pass.addBuffer("thumbnail@3x.png", await resizeAsset(thumbnailInput, 270, 270, "cover"));
  }

  return pass.getAsBuffer();
}
