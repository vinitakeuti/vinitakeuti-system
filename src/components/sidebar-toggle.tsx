"use client";

import { useEffect, useState } from "react";

type SidebarToggleProps = {
  location: "header" | "sidebar";
  hideWhenOpen?: boolean;
};

function isMobile() {
  return window.matchMedia("(max-width: 640px)").matches;
}

export function SidebarToggle({ location, hideWhenOpen = true }: SidebarToggleProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const sync = () => {
      const mobile = isMobile();
      setIsMobileViewport(mobile);
      setIsOpen(mobile ? document.body.classList.contains("sidebar-open") : !document.body.classList.contains("sidebar-collapsed"));
    };
    const saved = window.localStorage.getItem("vr-sidebar-collapsed");
    if (!isMobile() && saved === "true") document.body.classList.add("sidebar-collapsed");
    sync();
    window.addEventListener("vr-sidebar-change", sync);
    window.addEventListener("resize", sync);
    if (location === "sidebar") {
      const closeOnNavigation = (event: MouseEvent) => {
        if (!isMobile()) return;
        const target = event.target as Element | null;
        if (!target?.closest(".nav-item, .sidebar-profile-link")) return;
        document.body.classList.remove("sidebar-open");
        window.dispatchEvent(new Event("vr-sidebar-change"));
      };
      document.addEventListener("click", closeOnNavigation);
      return () => {
        window.removeEventListener("vr-sidebar-change", sync);
        window.removeEventListener("resize", sync);
        document.removeEventListener("click", closeOnNavigation);
      };
    }
    return () => {
      window.removeEventListener("vr-sidebar-change", sync);
      window.removeEventListener("resize", sync);
    };
  }, [location]);

  function toggle() {
    if (isMobile()) {
      document.body.classList.toggle("sidebar-open");
    } else {
      document.body.classList.toggle("sidebar-collapsed");
      window.localStorage.setItem("vr-sidebar-collapsed", String(document.body.classList.contains("sidebar-collapsed")));
    }
    window.dispatchEvent(new Event("vr-sidebar-change"));
  }

  const label = isOpen ? "Ocultar navegação" : "Exibir navegação";

  if (location === "header" && hideWhenOpen && isOpen && !isMobileViewport) return null;

  return (
    <button className={`sidebar-toggle sidebar-toggle-${location}`} type="button" onClick={toggle} aria-label={label} aria-expanded={isOpen}>
      <span aria-hidden="true"><i /><i /></span>
      <b>{location === "sidebar" ? "RECOLHER" : isOpen ? "RECOLHER" : "EXIBIR MENU"}</b>
    </button>
  );
}
