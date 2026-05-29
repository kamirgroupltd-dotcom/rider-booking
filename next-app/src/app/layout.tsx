import type { Metadata } from "next";
import Script from "next/script";
import { Sora, DM_Mono, Anton } from "next/font/google";
import "./globals.css";

const sora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const dmMono = DM_Mono({ variable: "--font-mono-dm", subsets: ["latin"], weight: ["400", "500"] });
const bsd = Anton({ variable: "--font-display-bsd", subsets: ["latin"], weight: "400" });

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

export const metadata: Metadata = {
  title: { default: "Nourmas Shift Booking — Lieferschichten that fit your week", template: "%s · Nourmas Shift Booking" },
  description:
    "Flexible food delivery work across Germany. Pick your shifts five weeks ahead, set your own hours, monthly payroll. Apply online in under two minutes.",
  metadataBase: new URL("https://example.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${sora.variable} ${dmMono.variable} ${bsd.variable}`}>
      <head>
        {/* Google Consent Mode v2 — default-denied for EEA/UK/CH, must load before AdSense */}
        <Script id="consent-mode-init" strategy="beforeInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('consent', 'default', {
              ad_storage: 'denied',
              ad_user_data: 'denied',
              ad_personalization: 'denied',
              analytics_storage: 'denied',
              functionality_storage: 'granted',
              security_storage: 'granted',
              wait_for_update: 500,
              region: ['EEA', 'GB', 'CH']
            });
          `}
        </Script>

        {ADSENSE_CLIENT && (
          <>
            {/* Google Funding Choices CMP — delivers the consent banner; configured in AdSense console under Privacy & messaging */}
            <Script
              id="funding-choices"
              async
              strategy="afterInteractive"
              src={`https://fundingchoicesmessages.google.com/i/${ADSENSE_CLIENT}?ers=1`}
            />
            <Script id="funding-choices-iframe" strategy="afterInteractive">
              {`
                (function() {
                  function signalGooglefcPresent() {
                    if (!window.frames['googlefcPresent']) {
                      if (document.body) {
                        var iframe = document.createElement('iframe');
                        iframe.style = 'width: 0; height: 0; border: none; z-index: -1000; left: -1000px; top: -1000px;';
                        iframe.style.display = 'none';
                        iframe.name = 'googlefcPresent';
                        document.body.appendChild(iframe);
                      } else {
                        setTimeout(signalGooglefcPresent, 0);
                      }
                    }
                  }
                  signalGooglefcPresent();
                })();
              `}
            </Script>

            {/* AdSense loader */}
            <Script
              id="adsense"
              async
              strategy="afterInteractive"
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
              crossOrigin="anonymous"
            />
          </>
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
