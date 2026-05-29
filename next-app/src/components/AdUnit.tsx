"use client";
import { useEffect } from "react";

type Props = {
  slot: string;
  format?: "auto" | "fluid" | "rectangle";
  layout?: string;
  className?: string;
  responsive?: boolean;
};

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";

export default function AdUnit({ slot, format = "auto", layout, className, responsive = true }: Props) {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* AdSense not loaded yet — fine */
    }
  }, []);

  if (!ADSENSE_CLIENT) return null;
  return (
    <ins
      className={`adsbygoogle ${className ?? ""}`}
      style={{ display: "block" }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      {...(layout ? { "data-ad-layout": layout } : {})}
      data-full-width-responsive={responsive ? "true" : "false"}
    />
  );
}
