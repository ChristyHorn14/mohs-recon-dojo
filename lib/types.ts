export type CaseStatus = "draft" | "reviewed" | "final";
export type Difficulty = "easy" | "moderate" | "advanced";
export type ImageView = "frontal" | "lateral" | "worms_eye" | "composite";
export type StructuralRequirement = "none" | "cartilage" | "lining" | "cartilage_and_lining";

export interface CaseImage {
  src: string;
  view: ImageView;
  label: string;
  alt: string;
}

export interface AcceptableAlternative {
  id: string;
  label: string;
  rationale: string;
}

export interface MohsCase {
  caseId: string;
  title: string;
  module: "nose";
  status: CaseStatus;
  difficulty: Difficulty;
  vignette: {
    text: string;
    defectSize: string;
    laterality: "midline" | "left" | "right" | "unspecified";
    depth: string;
    cartilageStatus: string;
    patientContext: string;
  };
  images: CaseImage[];
  answers: {
    subunits: string[];
    structuralRequirement: StructuralRequirement;
    preferredReconstruction: string;
  };
  feedback: {
    preferredLabel: string;
    preferredRationale: string;
    acceptableAlternatives: AcceptableAlternative[];
    teachingPearl: string;
  };
}
