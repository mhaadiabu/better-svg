declare module "*.svg?better-svg" {
  const Svg: import("react").ForwardRefExoticComponent<
    import("@mhaadi/svg/react/static").StaticSvgProps & import("react").RefAttributes<SVGSVGElement>
  >;
  export default Svg;
}
