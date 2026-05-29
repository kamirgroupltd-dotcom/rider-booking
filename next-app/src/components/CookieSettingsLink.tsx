"use client";

declare global {
  interface Window {
    googlefc?: {
      showRevocationMessage?: () => void;
      callbackQueue?: Array<() => void>;
    };
  }
}

export default function CookieSettingsLink() {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined") {
          if (window.googlefc?.showRevocationMessage) {
            window.googlefc.showRevocationMessage();
          } else {
            alert("Das Cookie-Banner ist derzeit nicht verfügbar. Bitte versuchen Sie es in wenigen Sekunden erneut.");
          }
        }
      }}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        font: "inherit",
        fontSize: 13,
        color: "inherit",
        textAlign: "left",
        cursor: "pointer",
        textDecoration: "underline",
      }}
    >
      Cookie-Einstellungen
    </button>
  );
}
