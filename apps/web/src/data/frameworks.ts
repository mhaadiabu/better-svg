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
