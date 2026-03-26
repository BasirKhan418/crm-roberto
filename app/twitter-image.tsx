import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "CRM Roberto social card";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "linear-gradient(160deg, #f4f9ff 0%, #cfe5ff 40%, #001e3c 100%)",
          color: "#001e3c",
          padding: "64px",
          fontFamily: "Arial",
        }}
      >
        <div style={{ fontSize: "30px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          CRM Roberto
        </div>
        <div style={{ marginTop: "24px", fontSize: "72px", fontWeight: 800, lineHeight: 1.04 }}>
          Business context,
          <br />
          always ready.
        </div>
        <div style={{ marginTop: "20px", fontSize: "30px", color: "rgba(0,30,60,0.82)" }}>
          Dashboard, clients, suppliers, notes, and follow-up tracking.
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
