import { ImageResponse } from "next/og";

// The app/icon.svg mark on white, as the 180×180 home-screen icon.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
      <svg width="132" height="132" viewBox="0 0 32 32">
        <rect x="7" y="21" width="14" height="6" rx="2.5" fill="#073a8b" opacity="0.45" />
        <rect x="5" y="17.5" width="18" height="6" rx="2.5" fill="#83caec" />
        <rect x="3" y="7" width="22" height="13" rx="3.5" fill="#073a8b" />
        <path d="M26 2 L27.2 5.8 L31 7 L27.2 8.2 L26 12 L24.8 8.2 L21 7 L24.8 5.8 Z" fill="#369adf" />
      </svg>
    </div>,
    { ...size },
  );
}
