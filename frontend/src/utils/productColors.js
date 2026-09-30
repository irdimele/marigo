// Shared swatch list + color→image logic for ProductDetail, QuickViewModal
// and admin ProductsPanel — must stay identical everywhere.
export const COLOR_OPTIONS = [
  { name: "White", value: "#FFFFFF" },
  { name: "Black", value: "#000000" },
];

/** Explicit White-first default; fall back to first available if White is absent. */
export function defaultColorIndex(list = COLOR_OPTIONS) {
  const white = list.findIndex((c) => c.name.toLowerCase() === "white");
  return white >= 0 ? white : 0;
}

/**
 * Color-linked gallery: show only images tagged with the active swatch.
 * No match (or colors disabled) → fall back to the full set (primary first)
 * so the main image never breaks.
 */
export function imagesForColor(images, colorEnabled, colorName) {
  const allImages = images.filter((i) => i.image);
  if (!colorEnabled) return allImages;
  const colorImages = allImages.filter(
    (i) =>
      (i.color || "").trim().toLowerCase() === (colorName || "").trim().toLowerCase()
  );
  return colorImages.length ? colorImages : allImages;
}
