/** Ícones da navegação: desenho próprio em traço único de 1,6px sobre grade de 24px, sem preenchimento. */
const paths = {
  overview: <><rect x="3.5" y="3.5" width="7" height="8" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="5" rx="1.5" /><rect x="13.5" y="11.5" width="7" height="9" rx="1.5" /><rect x="3.5" y="14.5" width="7" height="6" rx="1.5" /></>,
  assistant: <><path d="M12 3.5l1.6 4.4 4.4 1.6-4.4 1.6L12 15.5l-1.6-4.4L6 9.5l4.4-1.6z" /><path d="M18.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></>,
  attendances: <><path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3.5v-3.5h0a1.5 1.5 0 0 1-1.5-1.5z" /><path d="M8.5 9h7M8.5 12h4.5" /></>,
  agenda: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /><path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2" /></>,
  projects: <><rect x="3.5" y="4" width="17" height="16" rx="2" /><path d="M9.2 4v16M14.8 4v16" /><path d="M5.6 8h1.5M11.2 8h1.6M11.2 11.5h1.6M16.9 8h1.5" /></>,
  clients: <><circle cx="9.5" cy="8.5" r="3.5" /><path d="M3.5 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5" /><path d="M15.5 5.3a3.3 3.3 0 0 1 0 6.4M17.5 14.8c1.6.6 2.7 2.1 3 4.7" /></>,
  finance: <><rect x="3.5" y="6" width="17" height="12.5" rx="2" /><path d="M3.5 10h17" /><path d="M7 14.5h3.5" /></>,
  documents: <><path d="M6.5 3.5h7l4 4v11.5a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z" /><path d="M13.5 3.5V7.5h4M8.5 12h7M8.5 15.5h7" /></>,
  sales: <><path d="M4 19.5h16" /><path d="M6.5 16V12M11 16V8.5M15.5 16v-5M20 16V5.5" /></>,
  services: <><path d="M12 3.5l8 4.5-8 4.5-8-4.5z" /><path d="M4 12l8 4.5 8-4.5" /><path d="M4 16l8 4.5 8-4.5" /></>,
  monitoring: <><path d="M3.5 12h3.5l2.5-6 4 12 2.5-6h4.5" /></>,
  integrations: <><path d="M9 7.5V4M15 7.5V4" /><path d="M6.5 7.5h11v4a5.5 5.5 0 0 1-11 0z" /><path d="M12 17v3.5" /></>,
  settings: <><circle cx="12" cy="12" r="2.8" /><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" /></>,
  home: <><path d="M4 10.5 12 4l8 6.5" /><path d="M6 9v10.5h12V9" /><path d="M10 19.5v-5h4v5" /></>,
  payments: <><rect x="3.5" y="6" width="17" height="12.5" rx="2" /><path d="M3.5 10h17" /><path d="M7 14.5h3.5" /></>,
} as const;

export type NavIconName = keyof typeof paths;

export function NavIcon({ name }: { name: NavIconName }) {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
