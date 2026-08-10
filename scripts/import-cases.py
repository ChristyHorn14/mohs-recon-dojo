#!/usr/bin/env python3
"""Generate data/cases.json from docs/JSONReadyGuide.docx.

Uses only the Python standard library so it can run during local Next.js
development and Vercel builds without installing Python packages.

Publication rule:
  draft              -> skipped
  reviewed or final  -> validated and exported

Authoring behavior:
  * Reconstruction IDs are the source of truth.
  * Reconstruction labels are generated automatically.
  * Acceptable alternative labels are not required.
  * Separate acceptable-alternative rationale is not required.
  * All reconstruction teaching text may be placed in "Why preferred".
  * Each case has exactly one image.
  * The image is found automatically from the Case ID.
      nasal_006 -> public/cases/nasal_006.webp
  * "Image prompt ID" is informational only and is ignored during import.
  * "Image files and views" is informational only and is ignored during import.

Safety behavior:
  * All publishable cases are validated before cases.json is replaced.
  * Validation reports all detected problems.
  * The case image must exist in public/cases.
  * If every case is draft, the existing cases.json is preserved.
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


READY_STATUSES = {
    "reviewed",
    "final",
}

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W_NS}


REQUIRED_PUBLISH_FIELDS = [
    "Title",
    "Difficulty",
    "Clinical vignette (learner-facing)",
    "Defect size",
    "Laterality",
    "Defect depth ID",
    "Cartilage status ID",
    "Aesthetic subunit IDs",
    "Structural requirement ID",
    "Preferred reconstruction ID",
    "Why preferred",
    "Teaching pearl",
]


ALLOWED_DIFFICULTIES = {
    "easy",
    "moderate",
    "advanced",
}


ALLOWED_LATERALITIES = {
    "midline",
    "left",
    "right",
    "unspecified",
}


ALLOWED_DEPTHS = {
    "superficial",
    "subcutaneous_fat",
    "perichondrium",
    "cartilage",
    "full_thickness",
}


ALLOWED_CARTILAGE_STATUSES = {
    "intact_not_exposed",
    "intact",
    "exposed",
    "partial_loss",
    "cartilage_loss",
}


ALLOWED_SUBUNITS = {
    "tip",
    "ala",
    "soft_triangle",
    "sidewall",
    "dorsum",
    "supratip",
    "columella",
}


ALLOWED_STRUCTURAL_REQUIREMENTS = {
    "none",
    "cartilage",
    "lining",
    "cartilage_and_lining",
}


ALLOWED_RECONSTRUCTIONS = {
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
}


IMAGE_EXTENSIONS = (
    "webp",
    "png",
    "jpg",
    "jpeg",
)


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def normalize_id(value: str) -> str:
    return clean_text(value).lower()


def cell_text(cell: ET.Element) -> str:
    paragraphs: list[str] = []

    for paragraph in cell.findall(".//w:p", NS):
        bits: list[str] = []

        for node in paragraph.iter():
            if node.tag == f"{{{W_NS}}}t" and node.text:
                bits.append(node.text)

            elif node.tag == f"{{{W_NS}}}tab":
                bits.append("\t")

            elif node.tag in {
                f"{{{W_NS}}}br",
                f"{{{W_NS}}}cr",
            }:
                bits.append("\n")

        text = "".join(bits).strip()

        if text:
            paragraphs.append(text)

    return clean_text("\n".join(paragraphs))


def read_docx_tables(
    docx_path: Path,
) -> list[list[list[str]]]:

    try:
        with zipfile.ZipFile(docx_path) as archive:
            xml_bytes = archive.read("word/document.xml")

    except (
        FileNotFoundError,
        KeyError,
        zipfile.BadZipFile,
    ) as exc:
        raise ValueError(
            f"Unable to read Word document: {docx_path}: {exc}"
        ) from exc

    root = ET.fromstring(xml_bytes)

    tables: list[list[list[str]]] = []

    for table in root.findall(".//w:tbl", NS):
        rows: list[list[str]] = []

        for row in table.findall("./w:tr", NS):
            cells = [
                cell_text(cell)
                for cell in row.findall("./w:tc", NS)
            ]

            if cells:
                rows.append(cells)

        if rows:
            tables.append(rows)

    return tables


def rows_to_dict(
    rows: list[list[str]],
) -> dict[str, str]:

    result: dict[str, str] = {}

    for cells in rows:
        if len(cells) < 2:
            continue

        key = clean_text(cells[0])
        value = clean_text(cells[1])

        if key:
            result[key] = value

    return result


def is_tbd(value: str) -> bool:
    return bool(
        re.search(
            r"\bTBD\b",
            value or "",
            flags=re.IGNORECASE,
        )
    )


def split_ids(value: str) -> list[str]:

    omitted = {
        "",
        "none_listed",
        "none listed",
        "—",
        "-",
    }

    return [
        normalize_id(part)
        for part in re.split(r"[,;]", value or "")
        if normalize_id(part) not in omitted
    ]


def humanize_id(value: str) -> str:
    """Convert canonical reconstruction ID to learner-facing label."""

    labels = {
        "primary_closure": "Primary closure",
        "secondary_intention": "Secondary intention",
        "full_thickness_skin_graft": "Full-thickness skin graft",
        "composite_graft": "Composite graft",
        "bilobed_flap": "Bilobed flap",
        "island_pedicle_flap": "Island pedicle (V-Y) flap",
        "rieger_flap": "Rieger (dorsal nasal) flap",
        "glabellar_flap": "Glabellar flap",
        "cheek_advancement_flap": "Cheek advancement flap",
        "melolabial_flap": "Melolabial flap",
        "interpolated_melolabial_flap": "Interpolated melolabial flap",
        "paramedian_forehead_flap": "Paramedian forehead flap",
        "east_west": "East-West flap",
        "note_flap": "Note flap"
    }

    return labels.get(
        value,
        value.replace("_", " ").title(),
    )


def suggestion(
    value: str,
    allowed: set[str],
) -> str:

    matches = difflib.get_close_matches(
        value,
        sorted(allowed),
        n=1,
        cutoff=0.55,
    )

    if matches:
        return f" Did you mean '{matches[0]}'?"

    return ""


def invalid_value_message(
    field: str,
    value: str,
    allowed: set[str],
) -> str:

    normalized = normalize_id(value)
    expected = ", ".join(sorted(allowed))

    return (
        f"{field}: invalid value '{value}'."
        f"{suggestion(normalized, allowed)} "
        f"Expected one of: {expected}"
    )


def validate_allowed_value(
    problems: list[str],
    field: str,
    value: str,
    allowed: set[str],
) -> None:

    if normalize_id(value) not in allowed:
        problems.append(
            invalid_value_message(
                field,
                value,
                allowed,
            )
        )


def find_case_image(
    case_id: str,
    public_cases_dir: Path,
) -> Path:
    """
    Find the single image associated with a case.

    Example:
        nasal_006 -> public/cases/nasal_006.webp

    Exactly one matching image must exist.
    """

    matches: list[Path] = []

    for extension in IMAGE_EXTENSIONS:
        candidate = (
            public_cases_dir
            / f"{case_id}.{extension}"
        )

        if candidate.is_file():
            matches.append(candidate)

    if not matches:
        expected = ", ".join(
            f"{case_id}.{extension}"
            for extension in IMAGE_EXTENSIONS
        )

        raise ValueError(
            "image: no image found for this Case ID in "
            f"public/cases. Expected one of: {expected}"
        )

    if len(matches) > 1:
        filenames = ", ".join(
            match.name
            for match in matches
        )

        raise ValueError(
            "image: multiple images found for this Case ID: "
            f"{filenames}. Each case must have exactly one image."
        )

    return matches[0]


def validate_publishable_row(
    case_id: str,
    status: str,
    row: dict[str, str],
) -> list[str]:

    problems: list[str] = []

    # ----------------------------------
    # Required fields
    # ----------------------------------

    for field in REQUIRED_PUBLISH_FIELDS:
        value = row.get(field, "")

        if not value:
            problems.append(
                f"{field}: missing required value"
            )

        elif is_tbd(value):
            problems.append(
                f"{field}: still contains TBD"
            )

    # ----------------------------------
    # Difficulty
    # ----------------------------------

    validate_allowed_value(
        problems,
        "Difficulty",
        row.get("Difficulty", ""),
        ALLOWED_DIFFICULTIES,
    )

    # ----------------------------------
    # Laterality
    # ----------------------------------

    validate_allowed_value(
        problems,
        "Laterality",
        row.get("Laterality", ""),
        ALLOWED_LATERALITIES,
    )

    # ----------------------------------
    # Defect depth
    # ----------------------------------

    validate_allowed_value(
        problems,
        "Defect depth ID",
        row.get("Defect depth ID", ""),
        ALLOWED_DEPTHS,
    )

    # ----------------------------------
    # Cartilage status
    # ----------------------------------

    validate_allowed_value(
        problems,
        "Cartilage status ID",
        row.get("Cartilage status ID", ""),
        ALLOWED_CARTILAGE_STATUSES,
    )

    # ----------------------------------
    # Structural requirement
    # ----------------------------------

    validate_allowed_value(
        problems,
        "Structural requirement ID",
        row.get(
            "Structural requirement ID",
            "",
        ),
        ALLOWED_STRUCTURAL_REQUIREMENTS,
    )

    # ----------------------------------
    # Preferred reconstruction
    # ----------------------------------

    validate_allowed_value(
        problems,
        "Preferred reconstruction ID",
        row.get(
            "Preferred reconstruction ID",
            "",
        ),
        ALLOWED_RECONSTRUCTIONS,
    )

    # ----------------------------------
    # Aesthetic subunits
    # ----------------------------------

    subunits = split_ids(
        row.get(
            "Aesthetic subunit IDs",
            "",
        )
    )

    if not subunits:
        problems.append(
            "Aesthetic subunit IDs: no valid IDs were found"
        )

    for subunit in subunits:
        if subunit not in ALLOWED_SUBUNITS:
            problems.append(
                invalid_value_message(
                    "Aesthetic subunit ID",
                    subunit,
                    ALLOWED_SUBUNITS,
                )
            )

    # ----------------------------------
    # Acceptable alternatives
    #
    # Only IDs matter.
    # No labels or rationale are required.
    # ----------------------------------

    alt_ids = split_ids(
        row.get(
            "Acceptable alternative IDs",
            "",
        )
    )

    for alternative_id in alt_ids:
        if alternative_id not in ALLOWED_RECONSTRUCTIONS:
            problems.append(
                invalid_value_message(
                    "Acceptable alternative ID",
                    alternative_id,
                    ALLOWED_RECONSTRUCTIONS,
                )
            )

    return [
        f"{case_id} [{status}]: {problem}"
        for problem in problems
    ]


def build_image(
    case_id: str,
    public_cases_dir: Path,
) -> list[dict[str, str]]:
    """
    Build the image array expected by the current app.

    The learner/author does not need to specify a view.
    """

    image_path = find_case_image(
        case_id,
        public_cases_dir,
    )

    return [
        {
            "src": f"/cases/{image_path.name}",
            "view": "composite",
            "label": "Clinical image",
            "alt": f"Clinical image for {case_id}",
        }
    ]


def build_case(
    row: dict[str, str],
    public_cases_dir: Path,
) -> dict:

    case_id = row["Case ID"]

    # ----------------------------------
    # Preferred reconstruction
    # ----------------------------------

    preferred_reconstruction_id = normalize_id(
        row["Preferred reconstruction ID"]
    )

    preferred_reconstruction_label = humanize_id(
        preferred_reconstruction_id
    )

    # ----------------------------------
    # Acceptable alternatives
    # ----------------------------------

    alt_ids = split_ids(
        row.get(
            "Acceptable alternative IDs",
            "",
        )
    )

    alternatives = [
        {
            "id": alternative_id,
            "label": humanize_id(
                alternative_id
            ),
            "rationale": "",
        }
        for alternative_id in alt_ids
    ]

    # ----------------------------------
    # Final case object
    # ----------------------------------

    return {
        "caseId": case_id,

        "title": row["Title"],

        "module": normalize_id(
            row.get(
                "Module",
                "nose",
            )
        ),

        "status": normalize_id(
            row["Status"]
        ),

        "difficulty": normalize_id(
            row["Difficulty"]
        ),

        "vignette": {
            "text": row[
                "Clinical vignette (learner-facing)"
            ],

            "defectSize": row[
                "Defect size"
            ],

            "laterality": normalize_id(
                row["Laterality"]
            ),

            "depth": normalize_id(
                row["Defect depth ID"]
            ),

            "cartilageStatus": normalize_id(
                row["Cartilage status ID"]
            ),

            "patientContext": row.get(
                "Patient preference/context",
                "",
            ),
        },

        "images": build_image(
            case_id,
            public_cases_dir,
        ),

        "answers": {
            "subunits": split_ids(
                row[
                    "Aesthetic subunit IDs"
                ]
            ),

            "structuralRequirement": normalize_id(
                row[
                    "Structural requirement ID"
                ]
            ),

            "preferredReconstruction": (
                preferred_reconstruction_id
            ),
        },

        "feedback": {
            "preferredLabel": (
                preferred_reconstruction_label
            ),

            "preferredRationale": row[
                "Why preferred"
            ],

            "acceptableAlternatives": (
                alternatives
            ),

            "teachingPearl": row[
                "Teaching pearl"
            ],
        },
    }


def atomic_write_json(
    output_path: Path,
    data: list[dict],
) -> None:

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=output_path.parent,
        delete=False,
        suffix=".json",
    ) as handle:

        json.dump(
            data,
            handle,
            indent=2,
            ensure_ascii=False,
        )

        handle.write("\n")

        temp_path = Path(
            handle.name
        )

    temp_path.replace(
        output_path
    )


def format_validation_report(
    errors: list[str],
) -> str:

    lines = [
        "=" * 56,
        "MOHS RECON NINJA CASE VALIDATION FAILED",
        "=" * 56,
        f"Found {len(errors)} error(s):",
        "",
    ]

    lines.extend(
        f"  - {error}"
        for error in errors
    )

    lines.extend(
        [
            "",
            "cases.json was not changed.",
        ]
    )

    return "\n".join(lines)


def import_cases(
    input_path: Path,
    output_path: Path,
    public_cases_dir: Path,
) -> int:

    tables = read_docx_tables(
        input_path
    )

    rows = [
        rows_to_dict(table)
        for table in tables
    ]

    case_rows = [
        row
        for row in rows
        if row.get("Case ID")
    ]

    exported: list[dict] = []
    skipped: list[str] = []
    validation_errors: list[str] = []
    seen_ids: set[str] = set()

    for row in case_rows:

        case_id = row["Case ID"]

        # ----------------------------------
        # Duplicate Case IDs
        # ----------------------------------

        if case_id in seen_ids:
            validation_errors.append(
                f"{case_id}: duplicate Case ID in guide"
            )
            continue

        seen_ids.add(case_id)

        # ----------------------------------
        # Publication status
        # ----------------------------------

        status = normalize_id(
            row.get(
                "Status",
                "draft",
            )
        )

        if status == "draft":
            skipped.append(case_id)
            continue

        if status not in READY_STATUSES:
            validation_errors.append(
                f"{case_id}: invalid Status "
                f"'{row.get('Status', '')}'. "
                "Use draft, reviewed, or final."
            )
            continue

        # ----------------------------------
        # Validate authored data
        # ----------------------------------

        case_errors = validate_publishable_row(
            case_id,
            status,
            row,
        )

        if case_errors:
            validation_errors.extend(
                case_errors
            )
            continue

        # ----------------------------------
        # Build case + validate image
        # ----------------------------------

        try:
            exported.append(
                build_case(
                    row,
                    public_cases_dir,
                )
            )

        except Exception as exc:
            validation_errors.append(
                f"{case_id} [{status}]: {exc}"
            )

    # ----------------------------------
    # Abort before changing cases.json
    # ----------------------------------

    if validation_errors:
        raise ValueError(
            format_validation_report(
                validation_errors
            )
        )

    # ----------------------------------
    # Preserve JSON if all cases are draft
    # ----------------------------------

    if not exported:
        print(
            f"Case import: found {len(case_rows)} case(s), "
            "but all are draft. "
            f"Keeping the existing {output_path} unchanged."
        )
        return 0

    # ----------------------------------
    # Write cases.json
    # ----------------------------------

    atomic_write_json(
        output_path,
        exported,
    )

    print(
        f"Case import: exported "
        f"{len(exported)} reviewed/final case(s); "
        f"skipped {len(skipped)} draft(s)."
    )

    return 0


def main() -> int:

    parser = argparse.ArgumentParser(
        description=(
            "Import publishable Mohs cases "
            "from the Word guide."
        )
    )

    parser.add_argument(
        "--input",
        default="docs/JSONReadyGuide.docx",
    )

    parser.add_argument(
        "--output",
        default="data/cases.json",
    )

    parser.add_argument(
        "--images",
        default="public/cases",
    )

    args = parser.parse_args()

    try:
        return import_cases(
            Path(args.input),
            Path(args.output),
            Path(args.images),
        )

    except Exception as exc:
        print(
            f"\nCASE IMPORT FAILED\n{exc}\n",
            file=sys.stderr,
        )

        return 1


if __name__ == "__main__":
    raise SystemExit(
        main()
    )
