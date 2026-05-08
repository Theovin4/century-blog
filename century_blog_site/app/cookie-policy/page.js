import CookiesPolicyPage from "@/app/cookies-policy/page";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Cookie Policy",
  description:
    "Read the Century Blog cookie policy to understand how cookies support analytics, ads, and site performance.",
  path: "/cookie-policy",
  keywords: ["Century Blog cookies", "cookie policy", "analytics cookies", "advertising cookies"]
});

export default CookiesPolicyPage;
