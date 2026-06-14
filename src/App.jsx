import { useEffect, useMemo, useState } from "react";
import {
  Apple,
  Check,
  ChevronDown,
  CircleAlert,
  Download,
  ImagePlus,
  Layers3,
  LoaderCircle,
  Palette,
  RotateCcw,
  Settings2,
  Sparkles,
  Ticket,
} from "lucide-react";
import FieldEditor from "./components/FieldEditor";
import PassPreview from "./components/PassPreview";
import { apiUrl, hasConfiguredApi } from "./api";
import { cloneTemplate, templates } from "./templates";

const groups = ["header", "primary", "secondary", "auxiliary", "back"];

function ColorInput({ label, value, onChange }) {
  return (
    <label className="color-control">
      <span>{label}</span>
      <div>
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
        <input value={value.toUpperCase()} onChange={(event) => onChange(event.target.value)} />
      </div>
    </label>
  );
}

function ImageUpload({ label, hint, value, onChange }) {
  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <label className="upload-control">
      <div className="upload-icon">
        {value ? <img src={value} alt="" /> : <ImagePlus size={20} />}
      </div>
      <div>
        <strong>{label}</strong>
        <span>{value ? "Image selected · click to replace" : hint}</span>
      </div>
      {value && (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            onChange("");
          }}
        >
          Remove
        </button>
      )}
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} />
    </label>
  );
}

export default function App() {
  const [pass, setPass] = useState(() => ({
    ...cloneTemplate(templates[0]),
    assets: { logo: "", strip: "", thumbnail: "" },
    relevantDate: "",
    expirationDate: "",
    advancedJson: "{}",
  }));
  const [activePanel, setActivePanel] = useState("design");
  const [signingInfo, setSigningInfo] = useState(null);
  const [downloadState, setDownloadState] = useState("idle");
  const [notice, setNotice] = useState("");
  const signingReady = Boolean(signingInfo?.signingConfigured);

  useEffect(() => {
    const healthUrl = apiUrl("/api/health");
    if (!healthUrl) {
      setSigningInfo({
        signingConfigured: false,
        provider: "WalletWallet",
        message: "The managed signing proxy has not been deployed.",
      });
      return;
    }

    fetch(healthUrl)
      .then((response) => response.json())
      .then((data) => setSigningInfo(data))
      .catch(() =>
        setSigningInfo({
          signingConfigured: false,
          provider: "WalletWallet",
          message: "The managed signing service is unavailable.",
        }),
      );
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === pass.id),
    [pass.id],
  );

  const update = (property, value) => setPass((current) => ({ ...current, [property]: value }));
  const updateNested = (group, property, value) =>
    setPass((current) => ({ ...current, [group]: { ...current[group], [property]: value } }));

  const selectTemplate = (template) => {
    const assets = pass.assets;
    setPass({
      ...cloneTemplate(template),
      assets,
      relevantDate: "",
      expirationDate: "",
      advancedJson: "{}",
    });
    setNotice("");
  };

  const downloadPass = async () => {
    const passesUrl = apiUrl("/api/passes");
    if (!passesUrl) {
      setDownloadState("error");
      setNotice("Connect a hosted signing API before generating Wallet passes.");
      return;
    }

    setDownloadState("loading");
    setNotice("");
    try {
      const response = await fetch(passesUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pass,
          assets: { logo: "", strip: "", thumbnail: "" },
          advancedJson: "{}",
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "The pass could not be generated.");
      }

      const result = await response.json();
      const { downloadUrl } = result;
      const passDownloadUrl = downloadUrl.startsWith("http")
        ? downloadUrl
        : new URL(downloadUrl, passesUrl).toString();
      setDownloadState("done");
      setNotice(
        result.provider === "WalletWallet"
          ? `Managed pass created with the ${result.appliedColorPreset} color preset.`
          : "Signed pass created. Open it on an Apple device to add it to Wallet.",
      );
      window.location.assign(passDownloadUrl);
    } catch (error) {
      setDownloadState("error");
      setNotice(error.message);
    }
  };

  const exportProject = () => {
    const blob = new Blob([JSON.stringify(pass, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${pass.logoText.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "wallet-pass"}.wallet-project.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNotice("Project exported. You can keep designing while Apple enrollment is pending.");
    setDownloadState("done");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#">
          <span><Ticket size={21} /></span>
          Wallet Studio
        </a>
        <div className="topbar-meta">
          <span className={`status-pill ${signingReady ? "ready" : ""}`}>
            <i />
            {signingInfo === null
              ? "Checking signer"
              : signingReady
                ? `${signingInfo.provider || "Signer"} connected`
                : hasConfiguredApi
                  ? "Signer unavailable"
                  : "Pages preview mode"}
          </span>
          <a href="#setup">Signing setup</a>
        </div>
      </header>

      <main className="workspace">
        <aside className="template-sidebar">
          <div className="sidebar-heading">
            <div>
              <span className="step-label">STEP 1</span>
              <h2>Choose a starting point</h2>
            </div>
            <Sparkles size={19} />
          </div>
          <div className="template-list">
            {templates.map((template) => (
              <button
                className={`template-card ${pass.id === template.id ? "selected" : ""}`}
                type="button"
                key={template.id}
                onClick={() => selectTemplate(template)}
              >
                <span className="template-swatch" style={{ background: template.colors.background }}>
                  <Ticket size={18} />
                </span>
                <span>
                  <small>{template.eyebrow}</small>
                  <strong>{template.name}</strong>
                  <p>{template.description}</p>
                </span>
                {pass.id === template.id && <Check className="selected-check" size={16} />}
              </button>
            ))}
          </div>
          <div className="template-note">
            <Layers3 size={18} />
            <p><strong>Every template is editable.</strong> Change fields, colors, imagery, barcode data, and advanced PassKit properties.</p>
          </div>
        </aside>

        <section className="editor-panel">
          <div className="editor-title">
            <div>
              <span className="step-label">STEP 2</span>
              <h1>Customize your pass</h1>
              <p>Editing <strong>{selectedTemplate?.name}</strong></p>
            </div>
            <button className="reset-button" type="button" onClick={() => selectTemplate(selectedTemplate)}>
              <RotateCcw size={15} /> Reset
            </button>
          </div>

          <div className="panel-tabs">
            <button className={activePanel === "design" ? "active" : ""} onClick={() => setActivePanel("design")}>
              <Palette size={16} /> Design
            </button>
            <button className={activePanel === "content" ? "active" : ""} onClick={() => setActivePanel("content")}>
              <Ticket size={16} /> Content
            </button>
            <button className={activePanel === "advanced" ? "active" : ""} onClick={() => setActivePanel("advanced")}>
              <Settings2 size={16} /> Advanced
            </button>
          </div>

          <div className="editor-scroll">
            {activePanel === "design" && (
              <>
                <section className="control-section">
                  <div className="section-heading">
                    <div><h3>Identity</h3><p>Your organization and pass branding.</p></div>
                  </div>
                  <label className="text-control">
                    <span>Logo text</span>
                    <input value={pass.logoText} onChange={(event) => update("logoText", event.target.value)} />
                  </label>
                  <label className="text-control">
                    <span>Organization name</span>
                    <input value={pass.organizationName} onChange={(event) => update("organizationName", event.target.value)} />
                  </label>
                  <label className="text-control">
                    <span>Pass description</span>
                    <input value={pass.passDescription} onChange={(event) => update("passDescription", event.target.value)} />
                  </label>
                  <label className="text-control">
                    <span>Pass style</span>
                    <div className="select-wrap">
                      <select value={pass.passType} onChange={(event) => update("passType", event.target.value)}>
                        <option value="generic">Generic</option>
                        <option value="eventTicket">Event ticket</option>
                        <option value="coupon">Coupon</option>
                        <option value="storeCard">Store card</option>
                        <option value="boardingPass">Boarding pass</option>
                      </select>
                      <ChevronDown size={16} />
                    </div>
                  </label>
                  <p className="provider-note">The style changes this preview and project export. WalletWallet Free currently issues its standard managed layout.</p>
                </section>

                <section className="control-section">
                  <div className="section-heading">
                    <div><h3>Colors</h3><p>Wallet supports RGB pass colors.</p></div>
                  </div>
                  <div className="color-grid">
                    <ColorInput label="Background" value={pass.colors.background} onChange={(value) => updateNested("colors", "background", value)} />
                    <ColorInput label="Text" value={pass.colors.foreground} onChange={(value) => updateNested("colors", "foreground", value)} />
                    <ColorInput label="Labels" value={pass.colors.label} onChange={(value) => updateNested("colors", "label", value)} />
                  </div>
                  <p className="provider-note">WalletWallet Free maps the background to its nearest preset: dark, blue, green, red, purple, or orange.</p>
                </section>

                <section className="control-section">
                  <div className="section-heading">
                    <div><h3>Artwork</h3><p>PNG, JPEG, or WebP. Images are resized on the server.</p></div>
                  </div>
                  <div className="upload-list">
                    <ImageUpload label="Logo" hint="Recommended: wide transparent image" value={pass.assets.logo} onChange={(value) => updateNested("assets", "logo", value)} />
                    <ImageUpload label="Strip image" hint="Optional banner artwork" value={pass.assets.strip} onChange={(value) => updateNested("assets", "strip", value)} />
                    <ImageUpload label="Thumbnail" hint="Optional event or person image" value={pass.assets.thumbnail} onChange={(value) => updateNested("assets", "thumbnail", value)} />
                  </div>
                  <p className="provider-note">Artwork remains in exported projects. WalletWallet requires Pro before these images can appear on managed passes.</p>
                </section>
              </>
            )}

            {activePanel === "content" && (
              <>
                {groups.map((group) => (
                  <FieldEditor
                    group={group}
                    fields={pass.fields[group]}
                    onChange={(fields) => updateNested("fields", group, fields)}
                    key={group}
                  />
                ))}
              </>
            )}

            {activePanel === "advanced" && (
              <>
                <section className="control-section">
                  <div className="section-heading">
                    <div><h3>Barcode</h3><p>Used for scanning, validation, or redemption.</p></div>
                  </div>
                  <label className="text-control">
                    <span>Format</span>
                    <div className="select-wrap">
                      <select value={pass.barcode.format} onChange={(event) => updateNested("barcode", "format", event.target.value)}>
                        <option value="PKBarcodeFormatQR">QR code</option>
                        <option value="PKBarcodeFormatPDF417">PDF417</option>
                        <option value="PKBarcodeFormatAztec">Aztec</option>
                        <option value="PKBarcodeFormatCode128">Code 128</option>
                      </select>
                      <ChevronDown size={16} />
                    </div>
                  </label>
                  <label className="text-control">
                    <span>Encoded message</span>
                    <input value={pass.barcode.message} onChange={(event) => updateNested("barcode", "message", event.target.value)} />
                  </label>
                  <label className="text-control">
                    <span>Human-readable text</span>
                    <input value={pass.barcode.altText} onChange={(event) => updateNested("barcode", "altText", event.target.value)} />
                  </label>
                </section>

                <section className="control-section">
                  <div className="section-heading">
                    <div><h3>Dates</h3><p>ISO date values control relevance and expiration.</p></div>
                  </div>
                  <label className="text-control">
                    <span>Relevant date</span>
                    <input type="datetime-local" value={pass.relevantDate} onChange={(event) => update("relevantDate", event.target.value)} />
                  </label>
                  <label className="text-control">
                    <span>Expiration date</span>
                    <input type="datetime-local" value={pass.expirationDate} onChange={(event) => update("expirationDate", event.target.value)} />
                  </label>
                  <p className="provider-note">Managed signing applies the expiration date. Relevant dates remain available in project exports.</p>
                </section>

                <section className="control-section">
                  <div className="section-heading">
                    <div><h3>Additional PassKit JSON</h3><p>Preserved in project exports. WalletWallet managed signing ignores unsupported raw PassKit properties.</p></div>
                  </div>
                  <textarea
                    className="json-editor"
                    spellCheck="false"
                    value={pass.advancedJson}
                    onChange={(event) => update("advancedJson", event.target.value)}
                  />
                </section>
              </>
            )}
          </div>
        </section>

        <aside className="preview-panel">
          <div className="preview-heading">
            <div>
              <span className="step-label">STEP 3</span>
              <h2>Preview & publish</h2>
            </div>
            <span className="live-pill"><i /> LIVE</span>
          </div>

          <PassPreview pass={pass} />

          <div className="publish-card">
            {!signingReady && signingInfo !== null && (
              <div className="setup-warning">
                <CircleAlert size={18} />
                <span>
                  <strong>{hasConfiguredApi ? "Managed signing isn’t ready." : "The WalletWallet proxy isn’t connected."}</strong>{" "}
                  {signingInfo?.message || "Deploy the Cloudflare Worker to generate signed passes."}
                </span>
              </div>
            )}
            {signingReady && signingInfo?.usage && (
              <div className="provider-summary">
                <span>WalletWallet {signingInfo.usage.plan || "free"}</span>
                <strong>{signingInfo.usage.remaining} of {signingInfo.usage.limit} passes remaining this month</strong>
              </div>
            )}
            <button className="wallet-button" type="button" onClick={downloadPass} disabled={downloadState === "loading"}>
              {downloadState === "loading" ? <LoaderCircle className="spinner" size={24} /> : <Apple fill="currentColor" size={25} />}
              <span><small>{signingReady ? "Create managed pass" : "Requires signer to"}</small>Add to Apple Wallet</span>
            </button>
            <button className="secondary-button" type="button" onClick={signingReady ? downloadPass : exportProject} disabled={downloadState === "loading"}>
              <Download size={17} /> {signingReady ? "Open device install page" : "Export pass project"}
            </button>
            {notice && <p className={`notice ${downloadState === "error" ? "error" : ""}`}>{notice}</p>}
            <p className="privacy-note">The WalletWallet API key stays encrypted in Cloudflare and is never included in this website.</p>
          </div>
        </aside>
      </main>

      <section className="setup-section" id="setup">
        <div>
          <span className="step-label">MANAGED SIGNING</span>
          <h2>WalletWallet signs the pass for you</h2>
          <p>No Apple Developer membership or certificate is needed. A Cloudflare Worker keeps the WalletWallet API key private and sends users to a hosted page that selects Apple Wallet, Google Wallet, or a desktop QR code.</p>
        </div>
        <ol>
          <li><span>1</span>Create a free WalletWallet API key.</li>
          <li><span>2</span>Store it as an encrypted Cloudflare Worker secret.</li>
          <li><span>3</span>Use up to 1,000 managed passes each month on the free tier.</li>
        </ol>
      </section>
    </div>
  );
}
