type LogoProps = {
  /* light for dark bg, dark for white bg */
  tone?: "light" | "dark";
  size?: number;
  withName?: boolean;
};

function LogoMark({ tone = "dark", size = 26 }: Omit<LogoProps, "withName">) {
  const main = tone === "light" ? "#ffffff" : "#073a8b";
  const spark = tone === "light" ? "#83caec" : "#369adf";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="7" y="21" width="14" height="6" rx="2.5" fill={main} opacity={tone === "light" ? 0.5 : 0.45} />
      <rect x="5" y="17.5" width="18" height="6" rx="2.5" fill="#83caec" />
      <rect x="3" y="7" width="22" height="13" rx="3.5" fill={main} />
      <path d="M26 2 L27.2 5.8 L31 7 L27.2 8.2 L26 12 L24.8 8.2 L21 7 L24.8 5.8 Z" fill={spark} />
    </svg>
  );
}

export default function Logo({ tone = "dark", size = 26, withName = true }: LogoProps) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em" }}>
      <LogoMark tone={tone} size={size} />
      {withName && "Unmet"}
    </span>
  );
}
