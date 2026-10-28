// Augment point for generated catalog name types. The generated
// svg-catalog.d.ts adds one entry per scan-seen collection here, keyed
// by collection prefix, so `SvgName` widens to `collection:icon` unions
// while staying open to any string (dynamic names, unknown
// collections, the fetch fallback).
//
// Module augmentation merges only into the declaring module, which is
// why this interface lives here rather than in a re-exporting wrapper.
// The public augmentation path is `@mhaadi/svg/catalog-types`.

export interface SvgCatalogIcons {}

export type CatalogSvgName = {
  [C in keyof SvgCatalogIcons & string]: `${C}:${SvgCatalogIcons[C] & string}`;
}[keyof SvgCatalogIcons & string];

export type SvgName = CatalogSvgName | (string & {});
export type SvgNameInput = SvgName;
