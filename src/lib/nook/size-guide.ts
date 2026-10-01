import type { BusinessConfig } from "@/lib/nook/types";
import small from "@/assets/size-guide/small.jpg";
import medium from "@/assets/size-guide/medium.jpg";
import large from "@/assets/size-guide/large.jpg";

/** Question the size guide belongs to (the flash size question in the default setup). */
export const SIZE_GUIDE_QUESTION_ID = "sizeflash";

/** Ruler pictures keyed by option id, so they keep working when the owner renames the options. */
export const sizeGuide: Record<string, { src: string; cm: number }> = {
  s: { src: small, cm: 10 },
  m: { src: medium, cm: 15 },
  l: { src: large, cm: 20 },
};

const outdatedLabels: Record<string, { from: string; to: string }> = {
  s: { from: "Small (up to 7cm)", to: "Small (about 10cm)" },
  m: { from: "Medium (7–14cm)", to: "Medium (about 15cm)" },
  l: { from: "Large (14cm+)", to: "Large (about 20cm)" },
};

/**
 * The ruler pictures show 10, 15 and 20 cm. Setups saved with the first default labels get the
 * matching text; labels the owner has edited are left alone.
 */
export function alignSizeGuideLabels(business: BusinessConfig): BusinessConfig {
  return {
    ...business,
    services: business.services.map((service) => ({
      ...service,
      questions: service.questions.map((question) =>
        question.id !== SIZE_GUIDE_QUESTION_ID || !question.options
          ? question
          : {
              ...question,
              options: question.options.map((option) => {
                const outdated = outdatedLabels[option.id];
                return outdated && option.label === outdated.from
                  ? { ...option, label: outdated.to }
                  : option;
              }),
            },
      ),
    })),
  };
}
