"use client";

import { useEffect, useState } from "react";

type SidebarToggleProps = {
  location: "header" | "sidebar";
  hideWhenOpen?: boolean;
};

function isMobile() {
  return window.matchMedia("(max-width: 640px)").matches;
}

export function SidebarToggle({ location, hideWhenOpen = false }: SidebarToggleProps) {
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
    return () => {
      window.removeEventListener("vr-sidebar-change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

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
