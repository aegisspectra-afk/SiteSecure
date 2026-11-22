import { PublicLocaleProvider } from "./PublicLocaleProvider";
import { SiteSecureLanding } from "./marketing/SiteSecureLanding";

export function PublicHome() {
  return (
    <PublicLocaleProvider>
      <SiteSecureLanding />
    </PublicLocaleProvider>
  );
}