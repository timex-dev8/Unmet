import type { ReactNode } from "react";

// default font on purpose, no remote font fetch
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

const SHADOW = "0 2px 28px rgba(7, 58, 139, 0.35)";

export function OgFrame({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 80px",
        background: "linear-gradient(165deg, #2c6ad6 0%, #84b8ef 62%, #ffffff 100%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <svg width="48" height="48" viewBox="0 0 32 32">
          <rect x="7" y="21" width="14" height="6" rx="2.5" fill="#ffffff" opacity="0.55" />
          <rect x="5" y="17.5" width="18" height="6" rx="2.5" fill="#ffffff" opacity="0.8" />
          <rect x="3" y="7" width="22" height="13" rx="3.5" fill="#ffffff" />
          <path d="M26 2 L27.2 5.8 L31 7 L27.2 8.2 L26 12 L24.8 8.2 L21 7 L24.8 5.8 Z" fill="#073a8b" />
        </svg>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: "#ffffff", textShadow: SHADOW }}>Unmet</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>{children}</div>
      <div style={{ display: "flex", alignItems: "center", fontSize: 28, color: "#073a8b" }}>{footer ?? "unmet-ten.vercel.app"}</div>
    </div>
  );
}

export function OgHeadline({ children, size }: { children: ReactNode; size: number }) {
  return (
    <div style={{ display: "flex", fontSize: size, fontWeight: 700, lineHeight: 1.1, color: "#ffffff", textShadow: SHADOW, letterSpacing: -1 }}>
      {children}
    </div>
  );
}

export function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
