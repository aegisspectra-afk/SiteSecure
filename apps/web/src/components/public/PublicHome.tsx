import { PublicLocaleProvider } from "./PublicLocaleProvider";
import { EnterpriseHome } from "./marketing/enterprise/EnterpriseHome";

export function PublicHome() {
  return (
    <PublicLocaleProvider>
      <EnterpriseHome />
    </PublicLocaleProvider>
  );
}
