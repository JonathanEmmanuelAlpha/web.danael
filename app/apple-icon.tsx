import { ImageResponse } from "next/og";

export const contentType = "image/png";

/**
 * Apple touch icon for Danaël (180×180).
 * Generated dynamically with the lime-green mark on a navy gradient.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a1b43 0%, #060e1e 100%)",
          fontSize: 0,
        }}
      >
        <div
          style={{
            width: 128,
            height: 128,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#93d91a",
            borderRadius: 32,
            color: "#0a1b43",
            fontSize: 82,
            fontWeight: 800,
            fontFamily: "sans-serif",
            letterSpacing: -0.04,
          }}
        >
          D
        </div>
      </div>
    ),
    {
      width: 180,
      height: 180,
    },
  );
}
