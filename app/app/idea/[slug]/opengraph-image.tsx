import { ImageResponse } from "next/og";
import { getCard } from "@/lib/cards";
import { clip, OG_SIZE, OG_TYPE, OG_VERDICT, OgFrame, OgHeadline } from "@/lib/og";

export const alt = "An idea on Unmet, backed by real complaints";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = await getCard(slug);

  // Unknown idea: the same image as the landing page.
  if (!card) {
    return new ImageResponse(
      <OgFrame>
        <OgHeadline size={92}>Build what people are already asking for</OgHeadline>
      </OgFrame>,
      { ...size },
    );
  }

  const headline = clip(card.headline, 120);
  const verdict = card.report ? OG_VERDICT[card.report.verdict] : null;
  const sources = card.evidence.threads;
  return new ImageResponse(
    <OgFrame footer={`${card.category} · unmet-ten.vercel.app`}>
      <OgHeadline size={headline.length > 80 ? 56 : headline.length > 50 ? 68 : 80}>{headline}</OgHeadline>
      <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 30 }}>
        {verdict && (
          <div style={{ display: "flex", background: "#ffffff", color: "#2c6ad6", padding: "10px 26px", borderRadius: 999, fontWeight: 700 }}>
            {verdict}
          </div>
        )}
        <div style={{ display: "flex", color: "#ffffff", textShadow: "0 2px 20px rgba(7, 58, 139, 0.35)" }}>
          {sources} {sources === 1 ? "source" : "sources"}
        </div>
      </div>
    </OgFrame>,
    { ...size },
  );
}
