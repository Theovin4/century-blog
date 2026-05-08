import TermsAndConditionsPage from "@/app/terms-and-conditions/page";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Terms",
  description:
    "Read the Century Blog terms for site usage, content rules, and publishing disclaimers.",
  path: "/terms",
  keywords: ["Century Blog terms", "site usage rules", "content policy", "website conditions"]
});

export default TermsAndConditionsPage;
