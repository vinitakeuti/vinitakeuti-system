import { BRAND_TITLE } from "@/features/professional-profile/types/brand";

export function Logo() {
  return (
    <div className="brand" aria-label="Vinicius Riudi">
      <img className="brand-mark" src="/assets/images/logo-vr.svg" alt="" aria-hidden="true" />
      <span className="brand-copy"><strong>Vinicius Riudi</strong><small>{BRAND_TITLE}</small></span>
    </div>
  );
}
