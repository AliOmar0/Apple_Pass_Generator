const WALLETWALLET_API = "https://api.walletwallet.dev";
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 10;

const requestHistory = new Map();

const barcodeFormats = {
  PKBarcodeFormatQR: "QR",
  PKBarcodeFormatPDF417: "PDF417",
  PKBarcodeFormatAztec: "Aztec",
  PKBarcodeFormatCode128: "Code128",
};

function allowedOrigins(env) {
  return new Set(
    (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  );
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin")?.replace(/\/+$/, "");
  if (!origin || !allowedOrigins(env).has(origin)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data, status, request, env) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...corsHeaders(request, env),
    },
  });
}

function isAllowedBrowserRequest(request, env) {
  const origin = request.headers.get("Origin")?.replace(/\/+$/, "");
  return Boolean(origin && allowedOrigins(env).has(origin));
}

function checkRateLimit(request) {
  const address = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const recent = (requestHistory.get(address) || []).filter(
    (timestamp) => now - timestamp < RATE_WINDOW_MS,
  );

  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  requestHistory.set(address, recent);
  return true;
}

function hexToHsl(hex) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16) / 255;
  const green = Number.parseInt(value.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const lightness = (maximum + minimum) / 2;
  const delta = maximum - minimum;

  if (delta === 0) return { hue: 0, saturation: 0, lightness };

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue;
  if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
  else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
  else hue = 60 * ((red - green) / delta + 4);

  return { hue: hue < 0 ? hue + 360 : hue, saturation, lightness };
}

export function nearestColorPreset(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || "")) return "dark";
  const { hue, saturation, lightness } = hexToHsl(hex);

  if (lightness < 0.2 || saturation < 0.15) return "dark";
  if (hue < 15 || hue >= 345) return "red";
  if (hue < 50) return "orange";
  if (hue < 170) return "green";
  if (hue < 235) return "blue";
  return "purple";
}

function cleanFields(fields, maximum) {
  if (!Array.isArray(fields)) return [];
  return fields.slice(0, maximum).map((field) => ({
    label: String(field?.label || "").slice(0, 64),
    value: String(field?.value ?? "").slice(0, 512),
  }));
}

function expirationDays(expirationDate) {
  if (!expirationDate) return undefined;
  const timestamp = new Date(expirationDate).getTime();
  if (!Number.isFinite(timestamp)) return undefined;

  const days = Math.ceil((timestamp - Date.now()) / 86_400_000);
  return Math.min(3650, Math.max(1, days));
}

function supportedImage(value) {
  if (!value) return undefined;
  if (!/^data:image\/png;base64,/i.test(value)) {
    throw new Error("Artwork must be cropped to PNG before publishing.");
  }
  if (value.length > 7_000_000) {
    throw new Error("Each artwork file must be smaller than 5 MB.");
  }
  return value;
}

export function toWalletWalletPayload(builderPass, options = {}) {
  if (!builderPass || typeof builderPass !== "object") {
    throw new Error("Pass data is required.");
  }

  const barcodeValue = String(builderPass.barcode?.message || "").trim();
  const barcodeFormat = barcodeFormats[builderPass.barcode?.format];
  const logoText = String(builderPass.logoText || "").trim();

  if (!barcodeValue) throw new Error("A barcode value is required.");
  if (barcodeValue.length > 512) throw new Error("The barcode value cannot exceed 512 characters.");
  if (!barcodeFormat) throw new Error("The selected barcode format is not supported.");
  if (!logoText && !builderPass.fields?.primary?.length) {
    throw new Error("Logo text or a primary field is required.");
  }

  const auxiliaryFields = cleanFields(builderPass.fields?.auxiliary, 4);
  const secondaryFields = [
    ...cleanFields(builderPass.fields?.secondary, 4),
    ...auxiliaryFields,
  ].slice(0, 4);

  const payload = {
    barcodeValue,
    barcodeFormat,
    logoText: logoText.slice(0, 64),
    description: String(builderPass.passDescription || logoText || "Wallet pass").slice(0, 256),
    organizationName: String(builderPass.organizationName || "").slice(0, 64) || undefined,
    headerFields: cleanFields(builderPass.fields?.header, 3),
    primaryFields: cleanFields(builderPass.fields?.primary, 2),
    secondaryFields,
    backFields: cleanFields(builderPass.fields?.back, 20),
    colorPreset: nearestColorPreset(builderPass.colors?.background),
    expirationDays: expirationDays(builderPass.expirationDate),
    sharingProhibited: false,
  };

  if (options.allowProFields) {
    payload.color = builderPass.colors?.background;
    payload.logoURL = supportedImage(builderPass.assets?.logo);
    payload.iconURL = payload.logoURL;
    payload.stripURL = supportedImage(builderPass.assets?.strip);
    payload.thumbnailURL = supportedImage(builderPass.assets?.thumbnail);
    delete payload.colorPreset;
  }

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

async function walletWalletRequest(pathname, env, init = {}) {
  if (!env.WALLETWALLET_API_KEY) {
    return { response: null, error: "WalletWallet API key is not configured." };
  }

  const response = await fetch(`${WALLETWALLET_API}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.WALLETWALLET_API_KEY}`,
      ...init.headers,
    },
  });

  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function health(request, env) {
  if (!env.WALLETWALLET_API_KEY) {
    return json(
      {
        ok: true,
        signingConfigured: false,
        provider: "WalletWallet",
        message: "WalletWallet API key is not configured.",
      },
      200,
      request,
      env,
    );
  }

  try {
    const { response, body } = await walletWalletRequest("/api/auth/usage", env);
    if (!response?.ok) {
      return json(
        {
          ok: false,
          signingConfigured: false,
          provider: "WalletWallet",
          message: body?.error || "WalletWallet authentication failed.",
        },
        502,
        request,
        env,
      );
    }

    return json(
      {
        ok: true,
        signingConfigured: true,
        provider: "WalletWallet",
        usage: body,
      },
      200,
      request,
      env,
    );
  } catch {
    return json(
      {
        ok: false,
        signingConfigured: false,
        provider: "WalletWallet",
        message: "WalletWallet is temporarily unavailable.",
      },
      502,
      request,
      env,
    );
  }
}

async function createPass(request, env) {
  if (!isAllowedBrowserRequest(request, env)) {
    return json({ message: "This origin is not allowed." }, 403, request, env);
  }
  if (!checkRateLimit(request)) {
    return json(
      { message: "Too many passes were requested from this device. Try again later." },
      429,
      request,
      env,
    );
  }

  let builderPass;
  try {
    builderPass = await request.json();
  } catch (error) {
    return json({ message: error.message || "Pass data is not valid JSON." }, 400, request, env);
  }

  try {
    const usageResult = await walletWalletRequest("/api/auth/usage", env);
    if (!usageResult.response) {
      return json({ message: usageResult.error }, 503, request, env);
    }
    if (!usageResult.response.ok) {
      return json(
        { message: usageResult.body?.error || "WalletWallet authentication failed." },
        usageResult.response.status,
        request,
        env,
      );
    }

    const isPro = usageResult.body?.plan === "pro";
    let payload;
    try {
      payload = toWalletWalletPayload(builderPass, { allowProFields: isPro });
    } catch (error) {
      return json({ message: error.message }, 400, request, env);
    }

    const { response, body, error } = await walletWalletRequest("/api/passes", env, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!response) return json({ message: error }, 503, request, env);
    if (!response.ok) {
      return json(
        {
          message: body?.error || body?.message || "WalletWallet could not create the pass.",
        },
        response.status,
        request,
        env,
      );
    }

    return json(
      {
        downloadUrl: body.shareUrl,
        shareUrl: body.shareUrl,
        googleSaveUrl: body.googleSaveUrl,
        serialNumber: body.serialNumber,
        provider: "WalletWallet",
        appearanceMode: isPro ? "custom" : "preset",
        appliedColorPreset: payload.colorPreset,
        limitations: isPro
          ? []
          : [
              "Free managed signing uses a WalletWallet color preset.",
              "Uploaded artwork requires WalletWallet Pro and was not sent.",
            ],
      },
      201,
      request,
      env,
    );
  } catch {
    return json(
      { message: "The managed signing service is temporarily unavailable." },
      502,
      request,
      env,
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      if (!isAllowedBrowserRequest(request, env)) {
        return json({ message: "This origin is not allowed." }, 403, request, env);
      }
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      return health(request, env);
    }

    if (request.method === "POST" && url.pathname === "/api/passes") {
      return createPass(request, env);
    }

    return json({ message: "Not found." }, 404, request, env);
  },
};
