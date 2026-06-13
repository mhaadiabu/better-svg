export type Framework = {
  id: string;
  label: string;
  sub: string;
};

export const frameworks: Framework[] = [
  { id: "react", label: "React", sub: "@mhaadi/svg/react" },
  { id: "react-native", label: "React Native", sub: "@mhaadi/svg/react-native" },
  { id: "vue", label: "Vue", sub: "@mhaadi/svg/vue" },
  { id: "svelte", label: "Svelte", sub: "@mhaadi/svg/svelte" },
  { id: "flutter", label: "Flutter", sub: "svg_flutter" },
];

export const frameworkLabels: Record<string, { label: string; sub: string }> = {
  react: frameworks[0],
  "react-native": frameworks[1],
  vue: frameworks[2],
  svelte: frameworks[3],
  flutter: frameworks[4],
};
