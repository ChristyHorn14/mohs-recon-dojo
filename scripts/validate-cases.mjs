import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const cases = JSON.parse(
  fs.readFileSync(path.join(root, "data/cases.json"), "utf8")
);

const allowedStatuses = new Set([
  "draft",
  "reviewed",
  "final",
]);

const allowedDifficulties = new Set([
  "easy",
  "moderate",
  "advanced",
]);

const allowedLaterality = new Set([
  "left",
  "right",
  "midline",
  "unspecified",
]);

const allowedDepths = new Set([
  "superficial",
  "subcutaneous_fat",
  "perichondrium",
  "cartilage",
  "full_thickness",
]);

const allowedCartilageStatus = new Set([
  "intact_not_exposed",
  "intact",
  "exposed",
  "partial_loss",
  "cartilage_loss",
]);

const allowedSubunits = new Set([
  "tip",
  "ala",
  "soft_triangle",
  "sidewall",
  "dorsum",
  "supratip",
  "columella",
]);

const allowedStructural = new Set([
  "none",
  "cartilage",
  "lining",
  "cartilage_and_lining",
]);

const allowedReconstructions = new Set([
  "primary_closure",
  "secondary_intention",
  "full_thickness_skin_graft",
  "composite_graft",
  "bilobed_flap",
  "island_pedicle_flap",
  "rieger_flap",
  "glabellar_flap",
  "cheek_advancement_flap",
  "melolabial_flap",
  "interpolated_melolabial_flap",
  "paramedian_forehead_flap",
"east_west",
"note_flap"
]);

const allowedViews = new Set([
  "frontal",
  "worms_eye",
  "lateral",
  "oblique",
  "composite",
]);

const ids = new Set();
const errors = [];

function error(caseId, field, value, expected) {
  errors.push(
    [
      "",
      "===================================",
      `Case: ${caseId}`,
      `Field: ${field}`,
      `Value: ${JSON.stringify(value)}`,
      expected
        ? `Expected: ${expected}`
        : "",
      "===================================",
    ]
      .filter(Boolean)
      .join("\n")
  );
}

for (const item of cases) {

  //----------------------------------
  // duplicate ids
  //----------------------------------

  if (ids.has(item.caseId)) {
    error(item.caseId, "caseId", item.caseId, "unique caseId");
  }

  ids.add(item.caseId);

  //----------------------------------
  // status
  //----------------------------------

  if (!allowedStatuses.has(item.status)) {
    error(
      item.caseId,
      "status",
      item.status,
      [...allowedStatuses].join(", ")
    );
  }

  //----------------------------------
  // difficulty
  //----------------------------------

  if (!allowedDifficulties.has(item.difficulty)) {
    error(
      item.caseId,
      "difficulty",
      item.difficulty,
      [...allowedDifficulties].join(", ")
    );
  }

  //----------------------------------
  // vignette
  //----------------------------------

  if (!item.vignette?.defectSize) {
    error(item.caseId, "defectSize", "", "required");
  }

  if (!allowedLaterality.has(item.vignette?.laterality)) {
    error(
      item.caseId,
      "laterality",
      item.vignette?.laterality,
      [...allowedLaterality].join(", ")
    );
  }

  if (!allowedDepths.has(item.vignette?.depth)) {
    error(
      item.caseId,
      "depth",
      item.vignette?.depth,
      [...allowedDepths].join(", ")
    );
  }

  if (!allowedCartilageStatus.has(item.vignette?.cartilageStatus)) {
    error(
      item.caseId,
      "cartilageStatus",
      item.vignette?.cartilageStatus,
      [...allowedCartilageStatus].join(", ")
    );
  }

  //----------------------------------
  // images
  //----------------------------------

  if (!item.images?.length) {
    error(item.caseId, "images", "", "at least one image");
  }

  for (const image of item.images ?? []) {

    if (!allowedViews.has(image.view)) {
      error(
        item.caseId,
        "image view",
        image.view,
        [...allowedViews].join(", ")
      );
    }

    const diskPath = path.join(
      root,
      "public",
      image.src.replace(/^\//, "")
    );

    if (!fs.existsSync(diskPath)) {
      error(
        item.caseId,
        "image",
        image.src,
        "existing image file"
      );
    }
  }

  //----------------------------------
  // subunits
  //----------------------------------

  if (!item.answers?.subunits?.length) {
    error(item.caseId, "subunits", "", "at least one");
  }

  for (const subunit of item.answers?.subunits ?? []) {

    if (!allowedSubunits.has(subunit)) {

      error(
        item.caseId,
        "subunit",
        subunit,
        [...allowedSubunits].join(", ")
      );

    }

  }

  //----------------------------------
  // structural
  //----------------------------------

  if (
    !allowedStructural.has(
      item.answers?.structuralRequirement
    )
  ) {

    error(
      item.caseId,
      "structuralRequirement",
      item.answers?.structuralRequirement,
      [...allowedStructural].join(", ")
    );

  }

  //----------------------------------
  // reconstruction
  //----------------------------------

  if (
    !allowedReconstructions.has(
      item.answers?.preferredReconstruction
    )
  ) {

    error(
      item.caseId,
      "preferredReconstruction",
      item.answers?.preferredReconstruction,
      [...allowedReconstructions].join(", ")
    );

  }

  //----------------------------------
  // alternatives
  //----------------------------------

  for (
    const alt of
    item.feedback?.acceptableAlternatives ?? []
  ) {

    if (!allowedReconstructions.has(alt.id)) {

      error(
        item.caseId,
        "acceptableAlternative",
        alt.id,
        [...allowedReconstructions].join(", ")
      );

    }

  }

}

if (errors.length) {

  console.error("");
  console.error("======================================");
  console.error("MOHS RECON VALIDATION FAILED");
  console.error("======================================");
  console.error("");

  console.error(errors.join("\n"));

  console.error("");
  console.error(`${errors.length} validation error(s) found.`);
  console.error("");

  process.exit(1);

}

console.log(
  `Validated ${cases.length} cases successfully.`
);