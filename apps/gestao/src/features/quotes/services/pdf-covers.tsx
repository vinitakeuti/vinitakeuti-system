import { G, Line, Page, Path, Polygon, Svg, Text, View } from "@react-pdf/renderer";
import type { ComponentProps, ReactNode } from "react";
import { ASSIGNMENT_COVER_COLORS, BRAND_MARK_PATHS, BRAND_MARK_TRANSFORM, BRAND_MARK_VIEWBOX, CONTRACT_COVER_COLORS, coverTitleSize, FREE_COVER_COLORS, FREE_COVER_LAYOUT, freeCoverTitleSize, MEMORIAL_COVER_COLORS, MEMORIAL_GRID } from "@/features/quotes/types/brand-mark";

/**
 * Capas do contrato, da cessão, do memorial técnico e do documento livre. Cada uma tem identidade própria, mas todas usam a marca VR,
 * a mesma paleta e as mesmas fontes. As medidas (em pontos) são as mesmas da pré-visualização do editor.
 */
export type CoverData = {
  code: string;
  issuedAt: Date;
  title: string;
  client: { name: string; company?: string | null; document?: string | null };
  professional: { name: string; professionalTitle?: string | null; document?: string | null; website?: string | null };
};

/** Capa do documento livre: o cliente é opcional e o rótulo acima do título é livre. */
export type FreeCoverData = Omit<CoverData, "client"> & { client: CoverData["client"] | null; label: string };

type SvgStyle = ComponentProps<typeof Svg>["style"];

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Maceio" });

function footerText(cover: Pick<CoverData, "professional">) {
  const website = cover.professional.website?.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return [cover.professional.name, website].filter(Boolean).join(" · ").toUpperCase();
}

function clientDetail(cover: CoverData) {
  return [cover.client.company, cover.client.document].filter(Boolean).join(" · ");
}

function Mark({ color, style, outline = false, strokeWidth = 5 }: { color: string; style: SvgStyle; outline?: boolean; strokeWidth?: number }) {
  return <Svg viewBox={BRAND_MARK_VIEWBOX} style={style}><G transform={BRAND_MARK_TRANSFORM}>{BRAND_MARK_PATHS.map((d) => outline ? <Path key={d} d={d} fill="none" stroke={color} strokeWidth={strokeWidth} /> : <Path key={d} d={d} fill={color} />)}</G></Svg>;
}

function Brand({ cover, color, muted, left, top }: { cover: Pick<CoverData, "professional">; color: string; muted: string; left: number; top: number }) {
  return <View style={{ position: "absolute", left, top, flexDirection: "row", alignItems: "center", gap: 12 }}>
    <Mark color={color} style={{ width: 46, height: 34 }} />
    <View style={{ gap: 3 }}>
      <Text style={{ color, fontSize: 10.5, fontWeight: 700 }}>{cover.professional.name}</Text>
      {cover.professional.professionalTitle ? <Text style={{ color: muted, fontSize: 7.5 }}>{cover.professional.professionalTitle}</Text> : null}
    </View>
  </View>;
}

function Meta({ label, value, labelColor, valueColor }: { label: string; value: string; labelColor: string; valueColor: string }) {
  return <View style={{ gap: 5 }}><Text style={{ color: labelColor, fontFamily: "Courier", fontSize: 6.1, letterSpacing: 0.55 }}>{label}</Text><Text style={{ color: valueColor, fontSize: 8.5, fontWeight: 700 }}>{value}</Text></View>;
}

function Party({ role, name, detail, roleColor, nameColor, detailColor }: { role: string; name: string; detail?: string | null; roleColor: string; nameColor: string; detailColor: string }) {
  return <View><Text style={{ color: roleColor, fontFamily: "Courier", fontSize: 6.8, letterSpacing: 0.9 }}>{role}</Text><Text style={{ color: nameColor, fontSize: 11, fontWeight: 700, lineHeight: 1.25, marginTop: 7 }}>{name}</Text>{detail ? <Text style={{ color: detailColor, fontSize: 7.8, lineHeight: 1.35, marginTop: 3 }}>{detail}</Text> : null}</View>;
}

/** Contrato: papel claro, faixa lateral, título entre réguas finas e as partes do contrato. */
function ContractCover({ cover }: { cover: CoverData }) {
  const C = CONTRACT_COVER_COLORS;
  return <Page size="A4" style={{ backgroundColor: C.background, color: C.text, fontFamily: "Helvetica" }}>
    <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 16, backgroundColor: C.band }} />
    <View style={{ position: "absolute", left: 16, top: 0, bottom: 0, width: 3, backgroundColor: C.accent }} />
    <Mark color={C.watermark} style={{ position: "absolute", right: -46, bottom: -34, width: 330, height: 246 }} />
    <Brand cover={cover} color={C.text} muted={C.muted} left={60} top={46} />
    <Text style={{ position: "absolute", right: 52, top: 58, color: C.muted, fontFamily: "Courier", fontSize: 7, letterSpacing: 0.9 }}>{cover.code} / {cover.issuedAt.getFullYear()}</Text>
    <View style={{ position: "absolute", left: 60, right: 60, top: 236 }}>
      <Text style={{ color: C.muted, fontFamily: "Courier", fontSize: 7, letterSpacing: 1.1 }}>INSTRUMENTO PARTICULAR</Text>
      <Text style={{ color: C.accent, fontSize: 12, fontWeight: 700, letterSpacing: 1.8, marginTop: 12 }}>CONTRATO DE PRESTAÇÃO DE SERVIÇO</Text>
      <View style={{ width: 56, height: 2, backgroundColor: C.band, marginTop: 18 }} />
      <Text style={{ color: C.text, fontSize: coverTitleSize(cover.title), fontWeight: 700, letterSpacing: -0.6, lineHeight: 1.1, marginTop: 18 }}>{cover.title}</Text>
    </View>
    <View style={{ position: "absolute", left: 60, right: 60, top: 556, flexDirection: "row", borderTopWidth: 1, borderTopColor: C.line, paddingTop: 16 }}>
      <View style={{ flexBasis: 0, flexGrow: 1, paddingRight: 18 }}><Party role="CONTRATADA" name={cover.professional.name} detail={cover.professional.document} roleColor={C.accent} nameColor={C.text} detailColor={C.muted} /></View>
      <View style={{ width: 1, backgroundColor: "#C8C5BC" }} />
      <View style={{ flexBasis: 0, flexGrow: 1, paddingLeft: 18 }}><Party role="CONTRATANTE" name={cover.client.name} detail={clientDetail(cover)} roleColor={C.accent} nameColor={C.text} detailColor={C.muted} /></View>
    </View>
    <View style={{ position: "absolute", left: 60, top: 680, flexDirection: "row", gap: 40 }}>
      <Meta label="DOCUMENTO" value={cover.code} labelColor={C.muted} valueColor={C.text} />
      <Meta label="EMISSÃO" value={date.format(cover.issuedAt)} labelColor={C.muted} valueColor={C.text} />
    </View>
    <Text style={{ position: "absolute", left: 60, bottom: 39, color: C.muted, fontFamily: "Courier", fontSize: 6.2, letterSpacing: 0.4 }}>{footerText(cover)}</Text>
  </Page>;
}

/** Cessão: verde profundo e o diagrama da transferência, do cedente para o cessionário. */
function AssignmentCover({ cover }: { cover: CoverData }) {
  const C = ASSIGNMENT_COVER_COLORS;
  const panel = (children: ReactNode) => <View style={{ width: 210, minHeight: 92, padding: 16, borderRadius: 6, backgroundColor: C.panel }}>{children}</View>;
  return <Page size="A4" style={{ backgroundColor: C.background, color: C.text, fontFamily: "Helvetica" }}>
    <Mark color={C.mark} style={{ position: "absolute", right: -70, top: -40, width: 420, height: 313 }} />
    <Brand cover={cover} color={C.text} muted={C.soft} left={52} top={42} />
    <View style={{ position: "absolute", left: 52, right: 52, top: 236 }}>
      <Text style={{ color: C.muted, fontFamily: "Courier", fontSize: 7, letterSpacing: 0.9 }}>TERMO DE CESSÃO · {cover.code}</Text>
      <Text style={{ color: C.accent, fontSize: 11, fontWeight: 700, letterSpacing: 1.6, marginTop: 14 }}>CESSÃO DE TRANSFERÊNCIA DE PROPRIEDADE</Text>
      <Text style={{ color: C.text, fontSize: coverTitleSize(cover.title), fontWeight: 700, letterSpacing: -0.6, lineHeight: 1.1, marginTop: 12 }}>{cover.title}</Text>
    </View>
    <View style={{ position: "absolute", left: 52, right: 52, top: 500, flexDirection: "row", alignItems: "center" }}>
      {panel(<Party role="CEDENTE" name={cover.professional.name} detail={cover.professional.document} roleColor={C.muted} nameColor={C.text} detailColor={C.soft} />)}
      <Svg viewBox="0 0 71 20" style={{ width: 71, height: 20 }}><Line x1={8} y1={10} x2={56} y2={10} stroke={C.accent} strokeWidth={1.2} /><Polygon points="56,5 64,10 56,15" fill={C.accent} /></Svg>
      {panel(<Party role="CESSIONÁRIO" name={cover.client.name} detail={clientDetail(cover)} roleColor={C.muted} nameColor={C.text} detailColor={C.soft} />)}
    </View>
    <Text style={{ position: "absolute", left: 52, top: 616, width: 380, color: C.soft, fontSize: 8.5, lineHeight: 1.5 }}>Transferência dos direitos patrimoniais sobre o que foi desenvolvido, nos termos descritos neste documento.</Text>
    <View style={{ position: "absolute", left: 52, top: 690, flexDirection: "row", gap: 40 }}>
      <Meta label="DOCUMENTO" value={cover.code} labelColor={C.muted} valueColor={C.text} />
      <Meta label="EMISSÃO" value={date.format(cover.issuedAt)} labelColor={C.muted} valueColor={C.text} />
    </View>
    <Text style={{ position: "absolute", left: 52, bottom: 39, color: C.muted, fontFamily: "Courier", fontSize: 6.2, letterSpacing: 0.4 }}>{footerText(cover)}</Text>
  </Page>;
}

/** Memorial técnico: prancheta quadriculada, marca em traço de desenho técnico e a ficha do documento. */
function MemorialCover({ cover }: { cover: CoverData }) {
  const C = MEMORIAL_COVER_COLORS;
  const { height, step } = MEMORIAL_GRID;
  const verticals = Array.from({ length: Math.floor(PAGE_WIDTH / step) }, (_, index) => (index + 1) * step);
  const horizontals = Array.from({ length: Math.floor(height / step) }, (_, index) => (index + 1) * step);
  const corners = [[40, 30, 1, 1], [555, 30, -1, 1], [40, height - 30, 1, -1], [555, height - 30, -1, -1]];
  const rows: Array<[string, string]> = [
    ["PROJETO", cover.title],
    ["CLIENTE", [cover.client.name, cover.client.company].filter(Boolean).join(" · ")],
    ["DOCUMENTO", cover.code],
    ["EMISSÃO", date.format(cover.issuedAt)],
    ["RESPONSÁVEL TÉCNICO", [cover.professional.name, cover.professional.document].filter(Boolean).join(" · ")],
  ];
  return <Page size="A4" style={{ backgroundColor: C.background, color: C.text, fontFamily: "Helvetica" }}>
    <View style={{ position: "absolute", left: 0, top: 0, width: PAGE_WIDTH, height, backgroundColor: C.grid }} />
    <Svg viewBox={`0 0 ${PAGE_WIDTH} ${height}`} style={{ position: "absolute", left: 0, top: 0, width: PAGE_WIDTH, height }}>
      {verticals.map((x) => <Line key={`v${x}`} x1={x} y1={0} x2={x} y2={height} stroke={C.gridLine} strokeWidth={0.5} />)}
      {horizontals.map((y) => <Line key={`h${y}`} x1={0} y1={y} x2={PAGE_WIDTH} y2={y} stroke={C.gridLine} strokeWidth={0.5} />)}
      {corners.map(([x, y, dx, dy]) => <G key={`${x}-${y}`}><Line x1={x} y1={y} x2={x + 12 * dx} y2={y} stroke={C.accent} strokeWidth={0.9} /><Line x1={x} y1={y} x2={x} y2={y + 12 * dy} stroke={C.accent} strokeWidth={0.9} /></G>)}
      <Line x1={0} y1={height - 0.5} x2={PAGE_WIDTH} y2={height - 0.5} stroke={C.accent} strokeWidth={1} />
    </Svg>
    <Mark color={C.accent} outline style={{ position: "absolute", left: 352, top: 104, width: 190, height: 142 }} />
    <Brand cover={cover} color={C.text} muted={C.muted} left={52} top={48} />
    <Text style={{ position: "absolute", right: 52, top: 58, color: C.muted, fontFamily: "Courier", fontSize: 7, letterSpacing: 0.9 }}>{cover.code}</Text>
    <View style={{ position: "absolute", left: 52, right: 52, top: 286 }}>
      <Text style={{ color: C.muted, fontFamily: "Courier", fontSize: 7, letterSpacing: 1.1 }}>DOCUMENTAÇÃO DO PROJETO / {cover.issuedAt.getFullYear()}</Text>
      <Text style={{ color: C.accent, fontSize: 12, fontWeight: 700, letterSpacing: 1.8, marginTop: 12 }}>MEMORIAL TÉCNICO</Text>
      <Text style={{ color: C.text, fontSize: coverTitleSize(cover.title), fontWeight: 700, letterSpacing: -0.6, lineHeight: 1.1, marginTop: 12 }}>{cover.title}</Text>
    </View>
    <View style={{ position: "absolute", left: 52, right: 52, top: 500 }}>
      <Text style={{ color: C.muted, fontFamily: "Courier", fontSize: 7, letterSpacing: 1.1, marginBottom: 10 }}>FICHA DO DOCUMENTO</Text>
      {rows.map(([label, value]) => <View key={label} style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: C.line, paddingVertical: 9 }}>
        <Text style={{ width: 150, color: C.muted, fontFamily: "Courier", fontSize: 6.5, letterSpacing: 0.6, paddingTop: 2 }}>{label}</Text>
        <Text style={{ flexBasis: 0, flexGrow: 1, flexShrink: 1, color: C.text, fontSize: 9.5, fontWeight: 700, lineHeight: 1.3 }}>{value}</Text>
      </View>)}
      <View style={{ borderTopWidth: 1, borderTopColor: C.line }} />
    </View>
    <Text style={{ position: "absolute", left: 52, bottom: 39, color: C.muted, fontFamily: "Courier", fontSize: 6.2, letterSpacing: 0.4 }}>{footerText(cover)}</Text>
  </Page>;
}

/** Documento livre: página escura, a marca em traço fino recortada pela borda, o título no terço de baixo e uma linha de dados no rodapé. */
export function FreeDocumentCover({ cover }: { cover: FreeCoverData }) {
  const C = FREE_COVER_COLORS;
  const { mark, titleBottom, infoTop } = FREE_COVER_LAYOUT;
  const info: Array<[string, string, string]> = [
    ...(cover.client ? [["PREPARADO PARA", cover.client.name, [cover.client.company, cover.client.document].filter(Boolean).join(" · ")] as [string, string, string]] : []),
    ["DOCUMENTO", cover.code, ""],
    ["EMISSÃO", date.format(cover.issuedAt), ""],
  ];
  return <Page size="A4" style={{ backgroundColor: C.background, color: C.text, fontFamily: "Helvetica" }}>
    <Mark color={C.mark} outline strokeWidth={mark.stroke} style={{ position: "absolute", left: mark.left, top: mark.top, width: mark.width, height: mark.height }} />
    <Brand cover={cover} color={C.text} muted={C.soft} left={52} top={48} />
    <View style={{ position: "absolute", left: 52, right: 52, bottom: titleBottom }}>
      <Text style={{ color: C.muted, fontFamily: "Courier", fontSize: 7, letterSpacing: 0.9 }}>{cover.code} / {cover.issuedAt.getFullYear()}</Text>
      {cover.label ? <Text style={{ color: C.label, fontSize: 11, fontWeight: 700, letterSpacing: 1.8, marginTop: 14 }}>{cover.label.toUpperCase()}</Text> : null}
      <Text style={{ color: C.text, fontSize: freeCoverTitleSize(cover.title), fontWeight: 700, letterSpacing: -1.2, lineHeight: 1.04, marginTop: cover.label ? 10 : 14 }}>{cover.title}</Text>
    </View>
    <View style={{ position: "absolute", left: 52, right: 52, top: infoTop, flexDirection: "row", borderTopWidth: 1, borderTopColor: C.line }}>
      {info.map(([label, value, detail], index) => <View key={label} style={{ flexBasis: 0, flexGrow: index === 0 && cover.client ? 2 : 1, paddingTop: 16, paddingRight: 16, paddingLeft: index ? 16 : 0, borderLeftWidth: index ? 1 : 0, borderLeftColor: C.line }}>
        <Text style={{ color: C.muted, fontFamily: "Courier", fontSize: 6.4, letterSpacing: 0.8 }}>{label}</Text>
        <Text style={{ color: C.text, fontSize: 9.5, fontWeight: 700, lineHeight: 1.25, marginTop: 7 }}>{value}</Text>
        {detail ? <Text style={{ color: C.soft, fontSize: 7.6, lineHeight: 1.35, marginTop: 3 }}>{detail}</Text> : null}
      </View>)}
    </View>
    <Text style={{ position: "absolute", left: 52, bottom: 39, color: C.muted, fontFamily: "Courier", fontSize: 6.2, letterSpacing: 0.4 }}>{footerText(cover)}</Text>
  </Page>;
}

export function TextDocumentCover({ kind, cover }: { kind: "contract" | "assignment" | "memorial"; cover: CoverData }) {
  if (kind === "contract") return <ContractCover cover={cover} />;
  if (kind === "assignment") return <AssignmentCover cover={cover} />;
  return <MemorialCover cover={cover} />;
}

export const COVER_PAGE_SIZE = { width: PAGE_WIDTH, height: PAGE_HEIGHT };
