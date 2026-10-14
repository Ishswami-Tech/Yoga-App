import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/brand";

export const alt = `${APP_NAME} — daily live yoga classes online`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #FFF4DC 0%, #F8C77A 100%)",
          color: "#3A1F14",
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", color: "#B5451B" }}>
          Live yoga membership
        </div>
        <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1.05, marginTop: 24 }}>{APP_NAME}</div>
        <div style={{ fontSize: 38, marginTop: 32, maxWidth: 900 }}>
          Daily live classes on Google Meet, with a WhatsApp reminder before every session.
        </div>
      </div>
    ),
    size,
  );
}
