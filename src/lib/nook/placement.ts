import type { BusinessConfig, Option, Question } from "./types";

/** Body parts added after the first release, plus a free-text "custom" placement the owner must review. */
export const extraPlacementOptions: Option[] = [
  { id: "shoulder", label: "Shoulder or collarbone" },
  { id: "wrist", label: "Wrist or ankle" },
  { id: "stomach", label: "Stomach", durationFactor: 1.1 },
  { id: "foot", label: "Foot or toes", hint: "Heals slower, touch-ups likely", priceDelta: 30 },
  {
    id: "custom",
    label: "Custom placement",
    hint: "You describe it next. The studio reviews it before confirming.",
    requiresReview: true,
  },
];

/** Placement question id -> the free-text question shown when "custom" is chosen. */
const customFollowUps: Record<string, string> = {
  placement: "placementcustom",
  placementflash: "placementflashcustom",
};

export const customPlacementQuestion = (placementId: string): Question => ({
  id: customFollowUps[placementId] ?? `${placementId}custom`,
  label: "Describe the placement",
  help: "Where exactly, and roughly how large. For example: inner thigh, behind the ear.",
  type: "text",
  showIf: { questionId: placementId, values: ["custom"] },
});

/**
 * Setups saved before the extra body parts existed get them added, so the customer form and the
 * server-side price check agree. Skipped once a question already has a "custom" option.
 */
export function addCustomPlacement(business: BusinessConfig): BusinessConfig {
  return {
    ...business,
    services: business.services.map((service) => {
      const questions = service.questions.flatMap((question) => {
        if (
          !(question.id in customFollowUps) ||
          !question.options ||
          question.options.some((option) => option.id === "custom")
        )
          return [question];
        const known = new Set(question.options.map((option) => option.id));
        const widened = {
          ...question,
          options: [
            ...question.options,
            ...extraPlacementOptions.filter((option) => !known.has(option.id)),
          ],
        };
        return service.questions.some((q) => q.id === customFollowUps[question.id])
          ? [widened]
          : [widened, customPlacementQuestion(question.id)];
      });
      return { ...service, questions };
    }),
  };
}
