import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('static/excalidraw-assets', { recursive: true });
cpSync(
  'node_modules/@excalidraw/excalidraw/dist/prod/fonts',
  'static/excalidraw-assets/fonts',
  { recursive: true },
);
