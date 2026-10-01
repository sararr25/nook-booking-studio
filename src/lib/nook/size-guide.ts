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
