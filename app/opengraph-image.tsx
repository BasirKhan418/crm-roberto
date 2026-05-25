import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Roby - Executive CRM Platform";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, #001e3c 0%, #003a70 45%, #f2f8ff 100%)",
          color: "#ffffff",
          padding: "64px 36px",
          fontFamily: "Arial",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              height: "56px",
              width: "56px",
              borderRadius: "14px",
              background: "rgba(255,255,255,0.16)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
              fontWeight: 700,
            }}
          >
            R
          </div>
          <div style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "0.03em" }}>
            Roby
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "900px" }}>
          <div style={{ fontSize: "62px", fontWeight: 800, lineHeight: 1.05 }}>
            Executive CRM Platform
          </div>
          <div style={{ fontSize: "30px", color: "rgba(255,255,255,0.9)", lineHeight: 1.25 }}>
            Manage clients, suppliers, notes, and follow-ups in one workspace.
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", color: "rgba(0,30,60,0.95)" }}>
          {["Clients", "Suppliers", "Notes", "Dashboard"].map((item) => (
            <div
              key={item}
              style={{
                fontSize: "22px",
                fontWeight: 700,
                background: "#ffffff",
                borderRadius: "999px",
                padding: "10px 18px",
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
