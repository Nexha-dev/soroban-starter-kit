/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

declare module '*.svg' {
  const content: string;
  export default content;
}

interface Window {
  __REDUX_DEVTOOLS_EXTENSION__?: () => unknown;
}
