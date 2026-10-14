import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

/** SVG de QR — onboarding (hoja de QRs por mesa) y carta. Sin deps cliente. */
export async function GET(req: NextRequest) {
  const data = req.nextUrl.searchParams.get("data");
  if (!data) return NextResponse.json({ error: "data requerido" }, { status: 400 });
  const svg = await QRCode.toString(data, { type: "svg", margin: 1, width: 240 });
  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
  });
}
