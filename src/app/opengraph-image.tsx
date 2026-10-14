import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/brand";

export const runtime = "nodejs";
export const alt = `${APP_NAME} — daily live yoga classes online`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), "public", "logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 64,
          padding: "48px 80px",
          background: "linear-gradient(135deg, #FFFFFF 0%, #FFF4DC 100%)",
          color: "#10264A",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={470} height={470} alt="" />
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 560 }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", color: "#B5701B" }}>
            Live yoga membership
          </div>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.1, marginTop: 18 }}>{APP_NAME}</div>
          <div style={{ fontSize: 30, marginTop: 24 }}>
            Daily live classes on Google Meet, with a WhatsApp reminder before every session.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
