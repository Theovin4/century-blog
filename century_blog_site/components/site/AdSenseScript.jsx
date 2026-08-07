import Script from "next/script";
import { ADSENSE_SCRIPT_SRC } from "@/lib/adsense";

export function AdSenseScript() {
  return (
    <Script
      id="google-adsense"
      async
      src={ADSENSE_SCRIPT_SRC}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
