export const SUBUNIT_OPTIONS = [
  ["dorsum", "Dorsum"],
  ["sidewall", "Sidewall"],
  ["tip", "Tip"],
  ["ala", "Ala"],
  ["soft_triangle", "Soft tissue triangle"],
  ["columella", "Columella"]
] as const;

export const STRUCTURAL_OPTIONS = [
  ["none", "None"],
  ["cartilage", "Cartilage graft"],
  ["lining", "Internal lining"],
  ["cartilage_and_lining", "Cartilage + lining"]
] as const;

export const RECONSTRUCTION_OPTIONS = [
  ["primary_closure", "Primary closure"],
  ["secondary_intention", "Healing by secondary intention"],
  ["full_thickness_skin_graft", "Full-thickness skin graft"],
  ["composite_graft", "Composite graft"],
  ["bilobed_flap", "Bilobed flap"],
  ["island_pedicle_flap", "Island pedicle (V-Y) flap"],
["east_west", "East-West flap"],
["note_flap", "Note flap"],
  ["rieger_flap", "Rieger (dorsal nasal) flap"],
  ["glabellar_flap", "Glabellar flap"],
  ["cheek_advancement_flap", "Cheek advancement flap"],
  ["melolabial_flap", "Melolabial flap"],
  ["interpolated_melolabial_flap", "Interpolated melolabial flap"],
  ["paramedian_forehead_flap", "Paramedian forehead flap"]
] as const;
