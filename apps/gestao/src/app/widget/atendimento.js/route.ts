import { ATTENDANCE_WIDGET_SOURCE } from "@/features/ai/widget/attendance-widget";

/** Script do widget de atendimento do site. Público; o site o carrega com uma tag <script>. */
export function GET() {
  return new Response(ATTENDANCE_WIDGET_SOURCE, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300, stale-while-revalidate=3600",
      "access-control-allow-origin": "*",
      "x-content-type-options": "nosniff",
    },
  });
}
