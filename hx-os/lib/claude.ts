// Optional: richer ideas via the Claude API when ANTHROPIC_API_KEY is set.
// Any failure falls back to the offline engine (the caller handles that).
import Anthropic from "@anthropic-ai/sdk";
import type { Carousel, Pillar, ReelScript } from "./content-types";
import type { DraftIdea } from "./idea-engine";
import { BRAND } from "./idea-engine";

export const claudeEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

export type FullIdea = DraftIdea & { carousel: Carousel; reel: ReelScript };

const str = { type: "string" } as const;
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ideas"],
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pillar", "title", "angle", "hook", "audience", "occasion", "carousel", "reel"],
        properties: {
          pillar: { type: "string", enum: ["gifts", "architecture", "products"] },
          title: str,
          angle: str,
          hook: str,
          audience: str,
          occasion: str,
          carousel: {
            type: "object",
            additionalProperties: false,
            required: ["slides", "caption", "hashtags"],
            properties: {
              slides: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["kicker", "title", "body"],
                  properties: { kicker: str, title: str, body: str },
                },
              },
              caption: str,
              hashtags: { type: "array", items: str },
            },
          },
          reel: {
            type: "object",
            additionalProperties: false,
            required: ["title", "scenes", "cta", "music", "keyword", "gift"],
            properties: {
              title: str,
              cta: str,
              music: str,
              keyword: str,
              gift: str,
              scenes: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["seconds", "visual", "onScreen", "voiceover"],
                  properties: { seconds: { type: "integer" }, visual: str, onScreen: str, voiceover: str },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

const SYSTEM = `You are the content strategist for ${BRAND.name} (${BRAND.handle}), a 3D printing studio in Dubai.
Services: corporate gifts and awards with client branding, architectural scale models for developers/architects/brokers, product prototypes and small-batch products. Multicolour printing (Bambu Lab + AMS), PLA/PETG/TPU, fast delivery across the UAE.
Write in natural Gulf-friendly Arabic suitable for Instagram in the UAE; English terms are fine where Dubai marketers use them.
Never invent client names, awards or statistics.
Never state, estimate, suggest or hint at any price, price range, cost or discount: only the owner sets prices. For pricing questions the CTA is to request a quotation.`;

export async function generateWithClaude(opts: {
  date: string;
  occasions: string[];
  avoidTitles: string[];
}): Promise<FullIdea[]> {
  const client = new Anthropic();
  const prompt = `Today in Dubai is ${opts.date}. Current occasions: ${opts.occasions.join("، ") || "none"}.
Create exactly 3 Instagram content ideas: one per pillar — gifts (هدايا الشركات), architecture (مجسمات معمارية), products (منتجات ونماذج).
For each: a scroll-stopping hook, the angle (e.g. behind the scenes, comparison, how to request a quotation), target audience,
occasion (empty string if none), a 6-slide carousel (slide 1 = hook, last slide = CTA "${BRAND.cta}" with ${BRAND.handle}),
an Instagram caption with emojis, 8-12 hashtags, and a 50-70 second reel script of 6-8 scenes: chapter-style points ("أولاً/ثانياً/ثالثاً"),
on-screen text in Gulf-friendly Arabic without emoji, voiceover in correct Modern Standard Arabic written as one continuous narration,
what to film (no faces or people), and a final scene "هدية مجانية — اكتب في التعليقات" with a one-word comment keyword (keyword) and what it gets (gift).
Set music to "بدون موسيقى" (the brand forbids music).
Do not repeat these recent titles: ${opts.avoidTitles.slice(0, 30).join(" | ") || "none"}.`;

  const res = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude declined the request");
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const parsed = JSON.parse(text) as { ideas: (FullIdea & { pillar: Pillar })[] };
  return parsed.ideas.slice(0, 3).map((i) => ({ ...i, occasion: i.occasion || undefined }));
}
