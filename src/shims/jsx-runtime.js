// JSX automatic-runtime shim implemented over the host React's createElement.
// The host SDK only exposes `React` (not a separate jsx-runtime module), so we
// derive jsx/jsxs/Fragment from React.createElement. `key` arrives separately
// in the automatic runtime, so we fold it back into the props for createElement.
const sdk = window.__HERMES_PLUGIN_SDK__;
if (!sdk || !sdk.React) {
  throw new Error("Hermes plugin SDK / React not available on window");
}
const React = sdk.React;

export const Fragment = React.Fragment;

function jsx(type, props, key) {
  if (key === undefined) return React.createElement(type, props);
  return React.createElement(type, { ...props, key });
}

export { jsx, jsx as jsxs, jsx as jsxDEV };
