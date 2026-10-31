import { ImageResponse } from "next/og";
import { OG_SIZE, OG_TYPE, OgFrame, OgHeadline } from "@/lib/og";

export const alt = "Unmet: build what people are already asking for";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return new ImageResponse(
    <OgFrame>
      <OgHeadline size={92}>Build what people are already asking for</OgHeadline>
      <div style={{ display: "flex", fontSize: 32, color: "#ffffff", textShadow: "0 2px 20px rgba(7, 58, 139, 0.35)" }}>
        Real complaints, with the proof.
      </div>
    </OgFrame>,
    { ...size },
  );
}
