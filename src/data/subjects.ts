import type { FirestoreQuestion } from "../types";

export const SUBJECT_LIST = [
  "gross_anatomy",
  "embryology",
  "histology",
  "physiology",
  "biochemistry",
  "pharmacology",
  "pathology",
  "community_medicine",
  "behavioural_science",
  "forensics",
  "medicine",
  "surgery",
  "minors",
] as const;

export type SubjectId = typeof SUBJECT_LIST[number];

export const TOTAL_BLOCKS = 15;

/** The one Block that stays free for everyone; every other Block requires a paid pass. */
export const FREE_BLOCK = 3;

export const SUBJECT_META: Record<SubjectId, { label: string; tag: string; short: string; defaultYear: string }> = {
  gross_anatomy: { label: "Gross Anatomy", tag: "Structures, Organs & Bones", short: "GA", defaultYear: "1st Year" },
  embryology: { label: "Embryology", tag: "Development & Congenital", short: "EM", defaultYear: "1st Year" },
  histology: { label: "Histology", tag: "Tissues & Cellular Anatomy", short: "HI", defaultYear: "1st Year" },
  physiology: { label: "Physiology", tag: "Mechanisms & Functions", short: "PH", defaultYear: "1st Year" },
  biochemistry: { label: "Biochemistry", tag: "Metabolism & Genetics", short: "BC", defaultYear: "1st Year" },
  pharmacology: { label: "Pharmacology", tag: "Drugs & Therapeutics", short: "PM", defaultYear: "2nd Year" },
  pathology: { label: "Pathology", tag: "Diseases & Mechanisms", short: "PA", defaultYear: "2nd Year" },
  community_medicine: { label: "Community Medicine", tag: "Public Health & Epi", short: "CM", defaultYear: "3rd Year" },
  behavioural_science: { label: "Behavioural Science", tag: "Medical Ethics & Psychology", short: "BS", defaultYear: "3rd Year" },
  forensics: { label: "Forensic Medicine", tag: "Forensics, Autopsy & Toxicology", short: "FM", defaultYear: "3rd Year" },
  medicine: { label: "Medicine", tag: "Internal Medicine & Specialties", short: "ME", defaultYear: "Final Year" },
  surgery: { label: "Surgery", tag: "General & Operative Surgery", short: "SU", defaultYear: "Final Year" },
  minors: { label: "Minors", tag: "ENT, Ophthalmology, Dermatology & Anaesthesia", short: "MN", defaultYear: "Final Year" },
};

export const isSubjectId = (id: string): id is SubjectId => (SUBJECT_LIST as readonly string[]).includes(id);

export interface ModuleDefinition {
  id: string;
  name: string;
  block: number;
  description?: string;
  subjects: SubjectId[];
}

export interface BlockDefinition {
  block: number;
  title: string;
  year: string;
  description: string;
  modules: ModuleDefinition[];
}

export const DEFAULT_BLOCK_DEFINITIONS: BlockDefinition[] = [
  {
    block: 1,
    title: "Block I",
    year: "1st Year",
    description: "Foundation and Hematopoietic system.",
    modules: [
      { id: "mod-1", name: "Foundation-I", block: 1, subjects: ["gross_anatomy", "histology", "embryology", "physiology", "biochemistry"] },
      { id: "mod-2", name: "Hematopoietic & Lymphatic", block: 1, subjects: ["physiology", "biochemistry", "histology", "gross_anatomy"] },
    ],
  },
  {
    block: 2,
    title: "Block II",
    year: "1st Year",
    description: "Musculoskeletal and Locomotion system.",
    modules: [
      { id: "mod-3", name: "Musculoskeletal & Locomotion-I", block: 2, subjects: ["gross_anatomy", "histology", "embryology", "physiology"] },
    ],
  },
  {
    block: 3,
    title: "Block III",
    year: "1st Year",
    description: "Cardiovascular and Respiratory systems.",
    modules: [
      { id: "mod-4", name: "Cardiovascular-I", block: 3, subjects: ["gross_anatomy", "histology", "embryology", "physiology", "biochemistry"] },
      { id: "mod-5", name: "Respiratory-I", block: 3, subjects: ["gross_anatomy", "histology", "embryology", "physiology", "biochemistry"] },
    ],
  },
  {
    block: 4,
    title: "Block IV",
    year: "2nd Year",
    description: "Gastrointestinal and Renal systems.",
    modules: [
      { id: "mod-6", name: "GIT & Nutrition-I", block: 4, subjects: ["gross_anatomy", "histology", "embryology", "physiology", "biochemistry"] },
      { id: "mod-7", name: "Renal-I", block: 4, subjects: ["gross_anatomy", "histology", "embryology", "physiology", "biochemistry"] },
    ],
  },
  {
    block: 5,
    title: "Block V",
    year: "2nd Year",
    description: "Endocrinology, Reproduction, Head & Neck and Special Senses.",
    modules: [
      { id: "mod-8", name: "Endocrinology & Reproduction-I", block: 5, subjects: ["gross_anatomy", "histology", "embryology", "physiology", "biochemistry"] },
      { id: "mod-9", name: "Head & Neck, Special Senses", block: 5, subjects: ["gross_anatomy", "histology", "embryology", "physiology"] },
    ],
  },
  {
    block: 6,
    title: "Block VI",
    year: "2nd Year",
    description: "Neurosciences and Inflammation.",
    modules: [
      { id: "mod-10", name: "Neurosciences-I", block: 6, subjects: ["gross_anatomy", "histology", "embryology", "physiology"] },
      { id: "mod-11", name: "Inflammation", block: 6, subjects: ["pathology", "pharmacology", "biochemistry"] },
    ],
  },
  {
    block: 7,
    title: "Block VII",
    year: "3rd Year",
    description: "Foundation-2, Pharmacology, Hematopoietic, Forensic Medicine, Neoplasia.",
    modules: [
      { id: "mod-12", name: "Foundation-2 & EBM", block: 7, subjects: ["pharmacology", "pathology", "biochemistry", "community_medicine"] },
      { id: "mod-13", name: "General & Clinical Pharmacology", block: 7, subjects: ["pharmacology", "pathology"] },
      { id: "mod-14", name: "Hematopoietic & Immunity & Transplant", block: 7, subjects: ["pathology", "pharmacology"] },
      { id: "mod-15", name: "Forensic Medicine & Toxicology-I", block: 7, subjects: ["forensics", "pathology"] },
      { id: "mod-16", name: "Neoplasia", block: 7, subjects: ["pathology", "pharmacology"] },
    ],
  },
  {
    block: 8,
    title: "Block VIII",
    year: "3rd Year",
    description: "Infectious Disease, Musculoskeletal-II, Forensic Medicine-II.",
    modules: [
      { id: "mod-17", name: "Infectious Disease", block: 8, subjects: ["pathology", "pharmacology"] },
      { id: "mod-18", name: "Musculoskeletal & Locomotion-II", block: 8, subjects: ["pathology", "pharmacology", "surgery"] },
      { id: "mod-19", name: "Forensic Medicine & Toxicology-II", block: 8, subjects: ["forensics"] },
    ],
  },
  {
    block: 9,
    title: "Block IX",
    year: "3rd Year",
    description: "Cardiovascular-II, Respiratory-II, Community Medicine, Forensic Medicine-III.",
    modules: [
      { id: "mod-20", name: "Cardiovascular-II", block: 9, subjects: ["pathology", "pharmacology", "medicine"] },
      { id: "mod-21", name: "Respiratory-II", block: 9, subjects: ["pathology", "pharmacology", "medicine"] },
      { id: "mod-22", name: "Community Medicine & Family Health", block: 9, subjects: ["community_medicine"] },
      { id: "mod-23", name: "Forensic Medicine & Toxicology-III", block: 9, subjects: ["forensics"] },
    ],
  },
  {
    block: 10,
    title: "Block X",
    year: "4th Year",
    description: "Community Medicine-II, GIT & Nutrition-II, Eye & ENT-I.",
    modules: [
      { id: "mod-24", name: "Community Medicine & Family Health-II", block: 10, subjects: ["community_medicine"] },
      { id: "mod-25", name: "GIT & Nutrition-II", block: 10, subjects: ["pathology", "pharmacology", "surgery", "medicine"] },
      { id: "mod-26", name: "Eye & ENT-I", block: 10, subjects: ["surgery", "medicine", "pharmacology", "minors"] },
    ],
  },
  {
    block: 11,
    title: "Block XI",
    year: "4th Year",
    description: "Neurosciences-II, Psychiatry, Renal-II, Eye & ENT-II.",
    modules: [
      { id: "mod-27", name: "Neurosciences-II", block: 11, subjects: ["pathology", "pharmacology", "medicine", "surgery"] },
      { id: "mod-28", name: "Psychiatry & Behavioral Sciences", block: 11, subjects: ["behavioural_science", "medicine"] },
      { id: "mod-29", name: "Renal-II", block: 11, subjects: ["pathology", "pharmacology", "medicine"] },
      { id: "mod-30", name: "Eye & ENT-II", block: 11, subjects: ["surgery", "medicine", "pharmacology", "minors"] },
    ],
  },
  {
    block: 12,
    title: "Block XII",
    year: "4th Year",
    description: "Endocrinology-II, Dermatology, Eye & ENT-III.",
    modules: [
      { id: "mod-31", name: "Endocrinology & Reproduction-II", block: 12, subjects: ["medicine", "pathology", "pharmacology", "surgery"] },
      { id: "mod-32", name: "Dermatology", block: 12, subjects: ["medicine", "pharmacology", "minors"] },
      { id: "mod-33", name: "Eye & ENT-III", block: 12, subjects: ["surgery", "medicine", "pharmacology", "minors"] },
    ],
  },
  {
    block: 13,
    title: "Block XIII",
    year: "Final Year",
    description: "Surgery.",
    modules: [
      { id: "mod-34", name: "Surgery", block: 13, subjects: ["surgery", "pathology"] },
    ],
  },
  {
    block: 14,
    title: "Block XIV",
    year: "Final Year",
    description: "Gynecology & Obstetrics.",
    modules: [
      { id: "mod-35", name: "Gynecology & Obstetrics", block: 14, subjects: ["surgery", "medicine", "pathology"] },
    ],
  },
  {
    block: 15,
    title: "Block XV",
    year: "Final Year",
    description: "Medicine and Pediatrics.",
    modules: [
      { id: "mod-36", name: "Medicine", block: 15, subjects: ["medicine", "pharmacology"] },
      { id: "mod-37", name: "Pediatrics", block: 15, subjects: ["medicine", "community_medicine"] },
    ],
  },
];

export interface MasterModuleDef {
  id: string;
  num: number;
  name: string;
  suggestedBlock?: number;
}

export const MASTER_MODULES: MasterModuleDef[] = [
  { id: "mod-1", num: 1, name: "Foundation-I", suggestedBlock: 1 },
  { id: "mod-2", num: 2, name: "Hematopoietic & Lymphatic", suggestedBlock: 1 },
  { id: "mod-3", num: 3, name: "Musculoskeletal & Locomotion-I", suggestedBlock: 2 },
  { id: "mod-4", num: 4, name: "Cardiovascular-I", suggestedBlock: 3 },
  { id: "mod-5", num: 5, name: "Respiratory-I", suggestedBlock: 3 },
  { id: "mod-6", num: 6, name: "GIT & Nutrition-I", suggestedBlock: 4 },
  { id: "mod-7", num: 7, name: "Renal-I", suggestedBlock: 4 },
  { id: "mod-8", num: 8, name: "Endocrinology & Reproduction-I", suggestedBlock: 5 },
  { id: "mod-9", num: 9, name: "Head & Neck, Special Senses", suggestedBlock: 5 },
  { id: "mod-10", num: 10, name: "Neurosciences-I", suggestedBlock: 6 },
  { id: "mod-11", num: 11, name: "Inflammation", suggestedBlock: 6 },
  { id: "mod-12", num: 12, name: "Foundation-2 & EBM", suggestedBlock: 7 },
  { id: "mod-13", num: 13, name: "General & Clinical Pharmacology", suggestedBlock: 7 },
  { id: "mod-14", num: 14, name: "Hematopoietic & Immunity & Transplant", suggestedBlock: 7 },
  { id: "mod-15", num: 15, name: "Forensic Medicine & Toxicology-I", suggestedBlock: 7 },
  { id: "mod-16", num: 16, name: "Neoplasia", suggestedBlock: 7 },
  { id: "mod-17", num: 17, name: "Infectious Disease", suggestedBlock: 8 },
  { id: "mod-18", num: 18, name: "Musculoskeletal & Locomotion-II", suggestedBlock: 8 },
  { id: "mod-19", num: 19, name: "Forensic Medicine & Toxicology-II", suggestedBlock: 8 },
  { id: "mod-20", num: 20, name: "Cardiovascular-II", suggestedBlock: 9 },
  { id: "mod-21", num: 21, name: "Respiratory-II", suggestedBlock: 9 },
  { id: "mod-22", num: 22, name: "Community Medicine & Family Health", suggestedBlock: 9 },
  { id: "mod-23", num: 23, name: "Forensic Medicine & Toxicology-III", suggestedBlock: 9 },
  { id: "mod-24", num: 24, name: "Community Medicine & Family Health-II", suggestedBlock: 10 },
  { id: "mod-25", num: 25, name: "GIT & Nutrition-II", suggestedBlock: 10 },
  { id: "mod-26", num: 26, name: "Eye & ENT-I", suggestedBlock: 10 },
  { id: "mod-27", num: 27, name: "Neurosciences-II", suggestedBlock: 11 },
  { id: "mod-28", num: 28, name: "Psychiatry & Behavioral Sciences", suggestedBlock: 11 },
  { id: "mod-29", num: 29, name: "Renal-II", suggestedBlock: 11 },
  { id: "mod-30", num: 30, name: "Eye & ENT-II", suggestedBlock: 11 },
  { id: "mod-31", num: 31, name: "Endocrinology & Reproduction-II", suggestedBlock: 12 },
  { id: "mod-32", num: 32, name: "Dermatology", suggestedBlock: 12 },
  { id: "mod-33", num: 33, name: "Eye & ENT-III", suggestedBlock: 12 },
  { id: "mod-34", num: 34, name: "Surgery", suggestedBlock: 13 },
  { id: "mod-35", num: 35, name: "Gynecology & Obstetrics", suggestedBlock: 14 },
  { id: "mod-36", num: 36, name: "Medicine", suggestedBlock: 15 },
  { id: "mod-37", num: 37, name: "Pediatrics", suggestedBlock: 15 },
];

export const DEFAULT_SUBJECT_MODULE_IDS: Record<SubjectId, string[]> = {
  gross_anatomy: ["mod-1", "mod-3", "mod-4", "mod-5", "mod-6", "mod-7", "mod-8", "mod-9", "mod-10", "mod-18"],
  embryology: ["mod-1", "mod-4", "mod-5", "mod-6", "mod-7", "mod-8", "mod-9", "mod-10"],
  histology: ["mod-1", "mod-2", "mod-3", "mod-4", "mod-5", "mod-6", "mod-7", "mod-8", "mod-9", "mod-10"],
  biochemistry: ["mod-1", "mod-2", "mod-6", "mod-7", "mod-8", "mod-11", "mod-12"],
  physiology: ["mod-1", "mod-2", "mod-3", "mod-4", "mod-5", "mod-6", "mod-7", "mod-8", "mod-9", "mod-10"],
  pathology: ["mod-11", "mod-12", "mod-13", "mod-14", "mod-15", "mod-16", "mod-17", "mod-18", "mod-20", "mod-21", "mod-25", "mod-27", "mod-29", "mod-31", "mod-34", "mod-35"],
  pharmacology: ["mod-11", "mod-12", "mod-13", "mod-14", "mod-16", "mod-17", "mod-18", "mod-20", "mod-21", "mod-25", "mod-26", "mod-27", "mod-29", "mod-30", "mod-31", "mod-32", "mod-33", "mod-36"],
  community_medicine: ["mod-12", "mod-22", "mod-24", "mod-37"],
  behavioural_science: ["mod-28"],
  forensics: ["mod-15", "mod-19", "mod-23"],
  medicine: ["mod-20", "mod-21", "mod-25", "mod-26", "mod-27", "mod-28", "mod-29", "mod-30", "mod-31", "mod-32", "mod-33", "mod-35", "mod-36", "mod-37"],
  surgery: ["mod-18", "mod-25", "mod-26", "mod-27", "mod-30", "mod-31", "mod-33", "mod-34", "mod-35"],
  minors: ["mod-26", "mod-30", "mod-32", "mod-33"],
};


export interface DefaultModuleDef {
  id: string;
  subjectId: string;
  name: string;
  order: number;
}

export function buildDefaultModules(): Record<string, DefaultModuleDef[]> {
  const result: Record<string, DefaultModuleDef[]> = {};
  const masterMap = new Map(MASTER_MODULES.map((m) => [m.id, m]));

  for (const [subjectId, moduleIds] of Object.entries(DEFAULT_SUBJECT_MODULE_IDS)) {
    result[subjectId] = moduleIds
      .map((id, index) => {
        const master = masterMap.get(id);
        if (!master) return null;
        return {
          id: `${subjectId}-${master.id}`,
          subjectId,
          name: master.name,
          order: index,
        };
      })
      .filter((m): m is DefaultModuleDef => m !== null);
  }
  return result;
}

export const DEFAULT_MODULES: Record<string, DefaultModuleDef[]> = buildDefaultModules();

export const DEFAULT_QUESTIONS: FirestoreQuestion[] = [
  {
    id: "q-sample-1",
    subjectId: "gross_anatomy",
    moduleId: "mod-1",
    moduleName: "Foundation-I",
    block: 1,
    difficulty: "medium",
    status: "published",
    q: "A 45-year-old male presents with deep tendon reflex abnormalities. Which fundamental anatomical concept relates to the stretch reflex arc?",
    options: ["Spinal cord dorsal and ventral roots", "Cranial nerve ganglia", "Autonomic chain ganglia", "Prevertebral ganglia", "Basal ganglia"],
    correct: 0,
    explanation: "The stretch reflex arc involves afferent sensory neurons entering the spinal cord via dorsal roots and efferent motor neurons exiting via ventral roots.",
    createdAt: Date.now(),
  },
  {
    id: "q-sample-2",
    subjectId: "gross_anatomy",
    moduleId: "mod-1",
    moduleName: "Foundation-I",
    block: 1,
    difficulty: "medium",
    status: "published",
    q: "During a surgical procedure, the anatomical snuffbox is exposed. Which of the following bones forms the floor of this structure?",
    options: ["Scaphoid", "Lunate", "Triquetrum", "Pisiform", "Hamate"],
    correct: 0,
    explanation: "The scaphoid and trapezium form the floor of the anatomical snuffbox, which is of clinical importance due to the risk of scaphoid fractures and avascular necrosis.",
    createdAt: Date.now(),
  },
  {
    id: "q-sample-3",
    subjectId: "gross_anatomy",
    moduleId: "mod-1",
    moduleName: "Foundation-I",
    block: 1,
    difficulty: "medium",
    status: "published",
    q: "Which specific cell type is primarily responsible for the synthesis of the organic matrix of bone?",
    options: ["Osteoclasts", "Osteoblasts", "Osteocytes", "Chondrocytes", "Fibroblasts"],
    correct: 1,
    explanation: "Osteoblasts are responsible for synthesizing osteoid, the unmineralized organic portion of the bone matrix that forms prior to the maturation of bone tissue.",
    createdAt: Date.now(),
  }
];
