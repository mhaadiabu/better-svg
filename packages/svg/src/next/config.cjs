function withSvg(config, options) {
  return async (phase, context) => {
    const integration = await import("../../dist/next/index.js");
    return integration.withSvg(config, options)(phase, context);
  };
}

module.exports = withSvg;
module.exports.withSvg = withSvg;
