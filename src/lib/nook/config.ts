import type { BusinessConfig } from "./types";

export const defaultBusiness: BusinessConfig = {
  id: "stillroom-tattoo",
  name: "Stillroom Tattoo",
  archetype: "Tattoo studio",
  tagline: "A quieter place to make your mark.",
  location: "Ostergatan 14, Malmo",
  policies: {
    currency: "EUR",
    leadTimeDays: 3,
    horizonDays: 90,
    autoApproveUnder: 900,
    autoApproveMaxDuration: 300,
    cancellationHours: 48,
    depositDueHours: 24,
    reviewNote:
      "Anything large, on tricky placement, or covering old work gets a quick look from Ines before it is confirmed.",
  },
  services: [
    {
      id: "tattoo",
      name: "Custom tattoo",
      blurb: "Original design, drawn for you and tattooed in one or more sittings.",
      basePrice: 180,
      baseDuration: 90,
      depositPercent: 20,
      questions: [
        {
          id: "size",
          label: "Roughly how big is the piece?",
          help: "Longest edge. An estimate is fine, we confirm at the studio.",
          type: "scale",
          min: 3,
          max: 40,
          step: 1,
          unit: "cm",
          pricePerUnit: 16,
          durationPerUnit: 9,
        },
        {
          id: "style",
          label: "What style are you after?",
          type: "single",
          options: [
            {
              id: "fineline",
              label: "Fine line",
              hint: "Delicate, single-needle work",
              requiresSkills: ["fineline"],
            },
            {
              id: "blackwork",
              label: "Blackwork",
              hint: "Bold, solid black shapes",
              priceFactor: 1.1,
              durationFactor: 1.15,
              requiresSkills: ["blackwork"],
            },
            {
              id: "colour",
              label: "Colour / illustrative",
              hint: "Layered colour packing",
              priceFactor: 1.35,
              durationFactor: 1.4,
              requiresSkills: ["colour"],
            },
            {
              id: "lettering",
              label: "Lettering",
              hint: "Script or type-led",
              priceFactor: 0.95,
              requiresSkills: ["lettering"],
            },
          ],
        },
        {
          id: "placement",
          label: "Where on the body?",
          type: "single",
          options: [
            { id: "arm", label: "Arm or leg" },
            { id: "back", label: "Back or chest", durationFactor: 1.15 },
            {
              id: "hand",
              label: "Hand, neck or face",
              hint: "Needs a conversation first",
              priceDelta: 60,
              requiresReview: true,
              requiresSkills: ["exposed-placement"],
            },
            { id: "ribs", label: "Ribs, hip or sternum", priceFactor: 1.15, durationFactor: 1.2 },
          ],
        },
        {
          id: "coverup",
          label: "Is this covering or reworking existing ink?",
          type: "boolean",
          options: [
            {
              id: "yes",
              label: "Yes",
              priceFactor: 1.3,
              durationFactor: 1.35,
              requiresReview: true,
              requiresPhotos: true,
              requiresSkills: ["coverup"],
            },
            { id: "no", label: "No, fresh skin" },
          ],
        },
        {
          id: "extras",
          label: "Anything to add?",
          type: "multi",
          optional: true,
          options: [
            {
              id: "design",
              label: "Extra design round",
              hint: "A second sketch pass",
              priceDelta: 70,
            },
            { id: "evening", label: "Evening sitting", hint: "After 18:00", priceDelta: 40 },
            { id: "numbing", label: "Numbing cream", priceDelta: 10, durationDelta: 5 },
            {
              id: "companion",
              label: "Bring someone with me",
              hint: "Small studio, we just need to know",
            },
          ],
        },
        {
          id: "firsttime",
          label: "Is this your first tattoo?",
          type: "boolean",
          options: [
            { id: "yes", label: "Yes", durationDelta: 20 },
            { id: "no", label: "No" },
          ],
        },
        {
          id: "reference",
          label: "Describe the idea",
          help: "A sentence or two. Add reference pictures at the top of this page.",
          type: "text",
        },
      ],
    },
    {
      id: "flash",
      name: "Flash piece",
      blurb: "Pick a ready-made design from the studio sheet. Quick and fixed price.",
      basePrice: 140,
      baseDuration: 60,
      depositPercent: 20,
      questions: [
        {
          id: "sizeflash",
          label: "Size",
          type: "single",
          options: [
            { id: "s", label: "Small (about 10cm)" },
            { id: "m", label: "Medium (about 15cm)", priceDelta: 70, durationDelta: 30 },
            { id: "l", label: "Large (about 20cm)", priceDelta: 160, durationDelta: 75 },
          ],
        },
        {
          id: "placementflash",
          label: "Placement",
          type: "single",
          options: [
            { id: "arm", label: "Arm or leg" },
            { id: "torso", label: "Torso", durationFactor: 1.1 },
            {
              id: "hand",
              label: "Hand or neck",
              priceDelta: 50,
              requiresReview: true,
              requiresSkills: ["exposed-placement"],
            },
          ],
        },
      ],
    },
    {
      id: "consult",
      name: "Consultation",
      blurb:
        "Twenty minutes to talk through a bigger project. Free, and counts toward your deposit.",
      basePrice: 0,
      baseDuration: 20,
      depositPercent: 0,
      questions: [
        {
          id: "scope",
          label: "What are you thinking about?",
          type: "single",
          options: [
            { id: "sleeve", label: "Sleeve or large project", requiresReview: true },
            { id: "coverup", label: "Cover-up", requiresPhotos: true, requiresSkills: ["coverup"] },
            { id: "unsure", label: "Still figuring it out" },
          ],
        },
        {
          id: "notes",
          label: "Anything we should know beforehand?",
          type: "text",
          optional: true,
        },
      ],
    },
  ],
  team: [
    {
      id: "ines",
      name: "Ines Marrow",
      role: "Owner, blackwork & cover-ups",
      initials: "IM",
      skills: ["blackwork", "coverup", "lettering", "exposed-placement", "fineline"],
      days: [2, 3, 4, 5],
      start: "11:00",
      end: "19:00",
      maxSession: 360,
      portfolioUrl: "https://instagram.com/inesmarrow.ink",
    },
    {
      id: "tove",
      name: "Tove Lind",
      role: "Fine line & botanical",
      initials: "TL",
      skills: ["fineline", "lettering"],
      days: [1, 2, 4, 6],
      start: "10:00",
      end: "17:00",
      maxSession: 240,
      portfolioUrl: "https://instagram.com/tovelind.ink",
    },
    {
      id: "rafa",
      name: "Rafa Osei",
      role: "Colour & illustrative",
      initials: "RO",
      skills: ["colour", "fineline", "blackwork"],
      days: [3, 4, 5, 6],
      start: "12:00",
      end: "20:00",
      maxSession: 300,
      portfolioUrl: "https://instagram.com/rafaosei.ink",
    },
  ],
};

/**
 * Illustrative rules for the landing-page demo. They show how the same engine
 * reads for different trades; each real business writes its own.
 */
export type TradeDemoOption = {
  label: string;
  price: string;
  length: string;
  who: string;
  review: boolean;
  note?: string;
};

export type TradeDemo = {
  id: string;
  name: string;
  question: string;
  options: TradeDemoOption[];
};

export const tradeDemos: TradeDemo[] = [
  {
    id: "groomer",
    name: "Pet groomer",
    question: "What's the coat like?",
    options: [
      {
        label: "Short and tidy",
        price: "€45-55",
        length: "1 hr",
        who: "Any groomer",
        review: false,
      },
      {
        label: "Long, a few tangles",
        price: "€65-80",
        length: "1 hr 30 min",
        who: "Any groomer",
        review: false,
      },
      {
        label: "Matted double coat",
        price: "€95-120",
        length: "2 hr 15 min",
        who: "Senior groomer",
        review: true,
        note: "Matting is checked before the appointment.",
      },
    ],
  },
  {
    id: "photographer",
    name: "Photographer",
    question: "Where is the shoot?",
    options: [
      {
        label: "In the studio",
        price: "€220-260",
        length: "1 hr",
        who: "Lead photographer",
        review: false,
      },
      {
        label: "On location, in town",
        price: "€340-400",
        length: "2 hr 30 min",
        who: "Lead photographer",
        review: false,
      },
      {
        label: "Two hours away or more",
        price: "€620-780",
        length: "5 hr",
        who: "Lead + second shooter",
        review: true,
        note: "Travel is confirmed by the studio first.",
      },
    ],
  },
  {
    id: "tattoo",
    name: "Tattoo studio",
    question: "How big is the piece?",
    options: [
      {
        label: "Up to 5 cm",
        price: "€160-200",
        length: "1 hr 30 min",
        who: "Fine line artist",
        review: false,
      },
      {
        label: "5 to 15 cm",
        price: "€260-340",
        length: "2 hr 30 min",
        who: "Fine line artist",
        review: false,
      },
      {
        label: "Covering old work",
        price: "€480-650",
        length: "4 hr",
        who: "Cover-up specialist",
        review: true,
        note: "Cover-ups get a look before they're confirmed.",
      },
    ],
  },
  {
    id: "contractor",
    name: "Contractor",
    question: "How do materials get in?",
    options: [
      {
        label: "Ground floor or lift",
        price: "€850-1,100",
        length: "1 day",
        who: "Two-person crew",
        review: false,
      },
      {
        label: "Stairs only",
        price: "€1,050-1,350",
        length: "1.5 days",
        who: "Three-person crew",
        review: false,
      },
      {
        label: "Not sure yet",
        price: "After site visit",
        length: "Site visit first",
        who: "Project lead",
        review: true,
        note: "A short site visit is booked before pricing.",
      },
    ],
  },
  {
    id: "beauty",
    name: "Hair studio",
    question: "What's the colour situation?",
    options: [
      {
        label: "Natural, no colour",
        price: "€85-110",
        length: "1 hr 30 min",
        who: "Any stylist",
        review: false,
      },
      {
        label: "Refresh my colour",
        price: "€120-150",
        length: "2 hr",
        who: "Colourist",
        review: false,
      },
      {
        label: "Colour correction",
        price: "€220-320",
        length: "2 visits",
        who: "Senior colourist",
        review: true,
        note: "Starts with a patch test and a short consult.",
      },
    ],
  },
];
