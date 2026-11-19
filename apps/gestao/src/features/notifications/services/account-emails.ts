import { renderBrandEmail, type EmailProfessional } from "@/features/notifications/templates/brand-email";

/** E-mails da própria conta (gestão ou área do cliente), disparados por quem está entrando, não pela gestão. */

export function passwordResetEmail({ name, email, link, minutes, client, professional }: { name: string; email: string; link: string; minutes: number; client: boolean; professional: EmailProfessional }) {
  return renderBrandEmail({
    layout: "noturno",
    subject: "Redefinição de senha",
    preheader: `Use o link em até ${minutes} minutos para criar uma nova senha.`,
    kicker: client ? "ÁREA DO CLIENTE" : "VR GESTÃO",
    title: "Crie uma nova senha.",
    paragraphs: [name ? `Olá, ${name}.` : "Olá.", `Recebemos um pedido para redefinir a senha ${client ? "da sua área do cliente" : "do seu acesso à gestão"}. Pelo botão abaixo você cria uma nova e já entra.`],
    details: [["Conta", email]],
    action: { label: "Criar nova senha", href: link },
    closing: [`O link vale por ${minutes} minutos e funciona uma única vez.`, "Se não foi você que pediu, ignore este e-mail: a senha atual continua valendo."],
    signOff: client ? "Abraço," : undefined,
    reason: client ? "Você recebe este e-mail porque alguém pediu a redefinição de senha da sua área do cliente." : "Aviso automático da VR Gestão · Acesso.",
    professional,
  });
}
