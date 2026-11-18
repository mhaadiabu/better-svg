declare module "*.svg?better-svg" {
  const Svg: import("react").ForwardRefExoticComponent<
    import("../../dist/react-static.js").StaticSvgProps &
      import("react").RefAttributes<SVGSVGElement>
  >;
  export default Svg;
}
