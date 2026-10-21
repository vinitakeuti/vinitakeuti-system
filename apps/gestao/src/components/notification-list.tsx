"use client";

import Link from "next/link";
import { useState } from "react";

export type DashboardNotification = {
  id: string;
  title: string;
  detail: string;
  state: "attention" | "neutral" | "info";
  /** Onde resolver a notificação (opcional). */
  href?: string;
};

export function NotificationList({ notifications }: { notifications: DashboardNotification[] }) {
  const [visibleNotifications, setVisibleNotifications] = useState(notifications);

  if (!visibleNotifications.length) {
    return <p className="list-empty">Nenhuma notificação relevante no momento.</p>;
  }

  return (
    <div className="notification-list scroll-region" aria-label="Lista de notificações relevantes">
      {visibleNotifications.map((notification) => (
        <div className="notification-row" key={notification.id}>
          <span className={`signal ${notification.state}`} />
          <div>{notification.href ? <Link className="text-link-inline" href={notification.href}><b>{notification.title}</b></Link> : <b>{notification.title}</b>}<small>{notification.detail}</small></div>
          <button className="notification-dismiss" type="button" onClick={() => setVisibleNotifications((items) => items.filter((item) => item.id !== notification.id))}>DESCARTAR</button>
        </div>
      ))}
    </div>
  );
}
