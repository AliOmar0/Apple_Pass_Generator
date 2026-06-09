import crypto from "node:crypto";
import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { createPass, signingConfiguration } from "./pass-service.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.resolve(currentDirectory, "../dist");
const generatedPasses = new Map();
const passLifetimeMs = 5 * 60 * 1000;

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [token, generatedPass] of generatedPasses) {
    if (generatedPass.expiresAt <= now) generatedPasses.delete(token);
  }
}, 60 * 1000);
cleanupTimer.unref();

app.disable("x-powered-by");
app.use((request, response, next) => {
  const origin = request.get("origin");
  const configuredOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const localOrigins = ["http://localhost:5173", "http://localhost:3001"];
  const allowedOrigins = new Set([...configuredOrigins, ...localOrigins]);

  if (origin && allowedOrigins.has(origin.replace(/\/+$/, ""))) {
    response.set({
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    });
  }

  if (request.method === "OPTIONS") return response.sendStatus(204);
  return next();
});
app.use(express.json({ limit: "12mb" }));

app.get("/api/health", (_request, response) => {
  const config = signingConfiguration();
  response.json({
    ok: true,
    signingConfigured: config.configured,
    missing: config.missing,
  });
});

app.post("/api/passes", async (request, response) => {
  try {
    const buffer = await createPass(request.body);
    const token = crypto.randomBytes(24).toString("base64url");
    generatedPasses.set(token, {
      buffer,
      expiresAt: Date.now() + passLifetimeMs,
    });
    response
      .status(201)
      .set("Cache-Control", "no-store")
      .json({ downloadUrl: `/api/passes/${token}.pkpass`, expiresInSeconds: passLifetimeMs / 1000 });
  } catch (error) {
    const status = error instanceof ZodError ? 400 : error.statusCode || 500;
    const message = error instanceof ZodError
      ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
      : error.message || "The pass could not be generated.";
    console.error("Pass generation failed:", error);
    response.status(status).json({ message });
  }
});

app.get("/api/passes/:token.pkpass", (request, response) => {
  const generatedPass = generatedPasses.get(request.params.token);
  if (!generatedPass || generatedPass.expiresAt <= Date.now()) {
    generatedPasses.delete(request.params.token);
    return response.status(404).json({ message: "This pass download has expired. Generate it again." });
  }

  generatedPasses.delete(request.params.token);
  return response
    .status(200)
    .set({
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": 'inline; filename="wallet-pass.pkpass"',
      "Content-Length": generatedPass.buffer.length,
      "Cache-Control": "no-store",
    })
    .send(generatedPass.buffer);
});

app.use(express.static(distDirectory));
app.get("/{*path}", (_request, response) => {
  response.sendFile(path.join(distDirectory, "index.html"));
});

app.listen(port, () => {
  const config = signingConfiguration();
  console.log(`Wallet Studio server listening on http://localhost:${port}`);
  console.log(config.configured ? "Apple pass signing is configured." : `Preview mode. Missing: ${config.missing.join(", ")}`);
});
