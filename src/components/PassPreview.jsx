import { QRCodeSVG } from "qrcode.react";

const Barcode = ({ barcode, foreground }) => {
  if (barcode.format === "PKBarcodeFormatQR") {
    return (
      <div className="qr-code">
        <QRCodeSVG value={barcode.message || "WALLET-STUDIO"} size={94} level="M" />
      </div>
    );
  }

  const bars = Array.from({ length: 52 }, (_, index) => {
    const width = ((barcode.message.charCodeAt(index % Math.max(barcode.message.length, 1)) || index) % 3) + 1;
    return <i key={index} style={{ width }} />;
  });

  return (
    <div className={`linear-code ${barcode.format === "PKBarcodeFormatPDF417" ? "pdf-code" : ""}`}>
      <div className="bars" style={{ color: foreground }}>{bars}</div>
    </div>
  );
};

const Field = ({ item, labelColor, primary = false }) => (
  <div className={`preview-field ${primary ? "preview-primary" : ""}`}>
    <span style={{ color: labelColor }}>{item.label}</span>
    <strong>{item.value}</strong>
  </div>
);

export default function PassPreview({ pass }) {
  const { colors, fields } = pass;
  const isBoarding = pass.passType === "boardingPass";
  const stripImage = pass.assets?.strip;

  return (
    <div className="device-frame">
      <div className="device-speaker" />
      <div className="pass-card" style={{ backgroundColor: colors.background, color: colors.foreground }}>
        <div className="pass-glow" />
        <header className="pass-header">
          <div className="pass-brand">
            {pass.assets?.logo ? (
              <img src={pass.assets.logo} alt="" />
            ) : (
              <div className="brand-mark" style={{ color: colors.background }}>W</div>
            )}
            <strong>{pass.logoText}</strong>
          </div>
          <div className="header-fields">
            {fields.header.slice(0, 2).map((item) => (
              <Field item={item} labelColor={colors.label} key={item.key} />
            ))}
          </div>
        </header>

        {stripImage && !isBoarding && (
          <div className="pass-strip" style={{ backgroundImage: `url(${stripImage})` }} />
        )}

        <div className={`primary-fields ${isBoarding ? "boarding-route" : ""}`}>
          {fields.primary.slice(0, isBoarding ? 2 : 1).map((item, index) => (
            <div className="route-wrap" key={item.key}>
              <Field item={item} labelColor={colors.label} primary />
              {isBoarding && index === 0 && <span className="route-line">→</span>}
            </div>
          ))}
        </div>

        <div className="secondary-fields">
          {fields.secondary.slice(0, 3).map((item) => (
            <Field item={item} labelColor={colors.label} key={item.key} />
          ))}
        </div>

        <div className="auxiliary-fields">
          {fields.auxiliary.slice(0, 4).map((item) => (
            <Field item={item} labelColor={colors.label} key={item.key} />
          ))}
        </div>

        <div className="barcode-shell">
          <Barcode barcode={pass.barcode} foreground={colors.foreground} />
          <span>{pass.barcode.altText || pass.barcode.message}</span>
        </div>
        <div className="info-dot">i</div>
      </div>
      <p className="preview-caption">Live preview · appearance varies slightly by device</p>
    </div>
  );
}
