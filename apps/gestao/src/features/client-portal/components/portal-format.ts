const moneyFormat = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dayFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Maceio" });
const longDayFormat = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: "America/Maceio" });

export const money = (cents: number) => moneyFormat.format(cents / 100);
export const day = (date: Date) => dayFormat.format(date);
export const longDay = (date: Date) => longDayFormat.format(date);
