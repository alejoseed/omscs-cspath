export interface RequirementGroup {
  label: string;
  from: string[];
}

export type Requirement =
  | { id: string; type: "oneOf"; label: string; from: string[] }
  | { id: string; type: "all"; label: string; from: string[] }
  | { id: string; type: "nOf"; label: string; n: number; from: string[] }
  | {
      id: string;
      type: "nOfWithEach";
      label: string;
      n: number;
      groups: RequirementGroup[];
    };

export interface SpecializationSeed {
  id: string;
  name: string;
  shortName: string;
  credits: number;
  blurb: string;
  url: string;
  requirements: Requirement[];
  /** Courses that only count as electives; used for tie-breaking flavour. */
  flavourTags: string[];
}

const AI_CORE = [
  "CS-6476",
  "CS-6601",
  "CS-7637",
  "CS-7641",
  "CS-7643",
  "CS-7650",
];

const CS_ELECTIVES = [
  "CS-6035",
  "CS-6200",
  "CS-6211",
  "CS-6238",
  "CS-6260",
  "CS-6261",
  "CS-6262",
  "CS-6263",
  "CS-6264",
  "CS-6291",
  "CS-6310",
  "CS-6340",
  "CS-6422",
  "CS-6675",
  "CS-6747",
  "CS-7210",
  "CS-7280",
  "CS-7295",
  "CS-7400",
  "CS-8803-O08",
  "CSE-6220",
];

const CS_CORE = ["CS-6210", "CS-6250", "CS-6290", "CS-6300", "CS-6400"];

const GRAPHICS_POOL = ["CS-6457", "CS-6475", "CS-6476", "CS-6491", "CS-7496"];

const HCI_DESIGN = ["CS-6435", "CS-6457", "CS-6460", "CS-6795"];
const HCI_TECH = ["CS-6440", "CS-7470", "CS-7632", "CS-7711"];

const ML_ELECTIVES = [
  "CS-6476",
  "CS-6601",
  "CS-6603",
  "CS-7280",
  "CS-7632",
  "CS-7637",
  "CS-7642",
  "CS-7643",
  "CS-7646",
  "CS-7650",
  "CSE-6242",
  "CSE-6250",
  "ISYE-6420",
];

/**
 * The six specializations offered by OMSCS, with the online-offered courses that
 * satisfy each requirement. Rules mirror the OMSCS specialization pages (only
 * courses actually listed as offered online are included).
 */
export const SPECIALIZATIONS: SpecializationSeed[] = [
  {
    id: "ai",
    name: "Artificial Intelligence",
    shortName: "AI",
    credits: 15,
    blurb:
      "Search, learning, language and reasoning — the closest fit for anyone who wants to build intelligent systems.",
    url: "https://omscs.gatech.edu/specialization-artificial-intelligence-formerly-interactive-intelligence",
    flavourTags: ["AI", "machine learning", "reasoning", "NLP"],
    requirements: [
      {
        id: "alg",
        type: "oneOf",
        label: "Algorithms & design (1 of 2)",
        from: ["CS-6300", "CS-6515"],
      },
      {
        id: "core",
        type: "nOf",
        label: "AI core (2 of 6)",
        n: 2,
        from: AI_CORE,
      },
      {
        id: "electives",
        type: "nOf",
        label: "AI methods / cognition & ethics (2 of 6)",
        n: 2,
        from: [
          ...AI_CORE,
          "CS-7632",
          "CS-6440",
          "CS-6460",
          "CS-6603",
          "CS-6750",
          "CS-6795",
        ],
      },
    ],
  },
  {
    id: "cpr",
    name: "Computational Perception and Robotics",
    shortName: "CPR",
    credits: 15,
    blurb:
      "Vision, sensing and autonomy. The path for robotics, self-driving and perception work.",
    url: "https://omscs.gatech.edu/specialization-computational-perception-and-robotics",
    flavourTags: ["robotics", "vision", "AI", "sensing"],
    requirements: [
      {
        id: "alg",
        type: "oneOf",
        label: "Algorithms (1)",
        from: ["CS-6515"],
      },
      {
        id: "aior",
        type: "oneOf",
        label: "AI or ML (1 of 2)",
        from: ["CS-6601", "CS-7641"],
      },
      {
        id: "electives",
        type: "nOfWithEach",
        label: "Perception + robotics electives (3, at least 1 each)",
        n: 3,
        groups: [
          {
            label: "Perception",
            from: ["CS-6475", "CS-6476", "CS-7639", "CS-7650", "CS-7711"],
          },
          { label: "Robotics", from: ["CS-7638"] },
        ],
      },
    ],
  },
  {
    id: "graphics",
    name: "Computer Graphics",
    shortName: "Graphics",
    credits: 15,
    blurb:
      "Rendering, animation and games. A tight, studio-like curriculum built around five graphics courses.",
    url: "https://omscs.gatech.edu/specialization-computer-graphics",
    flavourTags: ["graphics", "animation", "games", "vision"],
    requirements: [
      {
        id: "core",
        type: "oneOf",
        label: "Graphics core (1 of 3)",
        from: ["CS-6457", "CS-6491", "CS-7496"],
      },
      {
        id: "alg",
        type: "oneOf",
        label: "Algorithms (1)",
        from: ["CS-6515"],
      },
      {
        id: "electives",
        type: "nOf",
        label: "Graphics electives (3 of 5)",
        n: 3,
        from: GRAPHICS_POOL,
      },
    ],
  },
  {
    id: "systems",
    name: "Computing Systems",
    shortName: "Systems",
    credits: 18,
    blurb:
      "Operating systems, networks, architecture, databases and security. The broadest, most infrastructure-heavy track.",
    url: "https://omscs.gatech.edu/specialization-computing-systems",
    flavourTags: ["systems", "networking", "security", "databases", "distributed"],
    requirements: [
      {
        id: "alg",
        type: "oneOf",
        label: "Algorithms (1)",
        from: ["CS-6515"],
      },
      {
        id: "core",
        type: "nOf",
        label: "Systems core (2 of 5)",
        n: 2,
        from: CS_CORE,
      },
      {
        id: "electives",
        type: "nOf",
        label: "Systems electives (3)",
        n: 3,
        from: [...CS_CORE, ...CS_ELECTIVES],
      },
    ],
  },
  {
    id: "hci",
    name: "Human-Computer Interaction",
    shortName: "HCI",
    credits: 15,
    blurb:
      "Design, evaluation and interactive technology. Best for product-facing, design-literate engineers.",
    url: "https://omscs.gatech.edu/specialization-human-computer-interaction",
    flavourTags: ["HCI", "design", "health", "education", "research methods"],
    requirements: [
      {
        id: "core",
        type: "all",
        label: "HCI core (CS 6750 + CS 7470)",
        from: ["CS-6750", "CS-7470"],
      },
      {
        id: "electives",
        type: "nOfWithEach",
        label: "Design + interactive technology electives (3, at least 1 each)",
        n: 3,
        groups: [
          { label: "Design & evaluation", from: HCI_DESIGN },
          { label: "Interactive technology", from: HCI_TECH },
        ],
      },
    ],
  },
  {
    id: "ml",
    name: "Machine Learning",
    shortName: "ML",
    credits: 15,
    blurb:
      "Statistical learning, deep learning and the mathematics behind them. The heaviest maths track.",
    url: "https://omscs.gatech.edu/specialization-machine-learning",
    flavourTags: ["machine learning", "deep learning", "math", "statistics"],
    requirements: [
      {
        id: "core",
        type: "all",
        label: "ML core (CS 6515 + CS 7641)",
        from: ["CS-6515", "CS-7641"],
      },
      {
        id: "electives",
        type: "nOf",
        label: "ML electives (3)",
        n: 3,
        from: ML_ELECTIVES,
      },
    ],
  },
];

export const BUCKETS = [
  {
    id: "high",
    name: "Highly interested",
    weight: 10,
    hint: "Courses you would take even if they were not on a path.",
  },
  {
    id: "medium",
    name: "Moderately interested",
    weight: 5,
    hint: "Good options — take them if the plan wants them.",
  },
  {
    id: "low",
    name: "Barely interested",
    weight: 2,
    hint: "Fallbacks you would tolerate to finish the degree.",
  },
] as const;

export type BucketId = (typeof BUCKETS)[number]["id"];
export const UNASSIGNED_WEIGHT = 0.5;
