// The only React boundary: Excalidraw provides a React component, mounted inside Svelte.
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Excalidraw,
  exportToBlob,
  serializeAsJSON,
} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
export type Snapshot = {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
};
export function mountCanvas(
  target: HTMLElement,
  initialData: ExcalidrawInitialDataState,
  onChange: (snapshot: Snapshot) => void,
) {
  window.EXCALIDRAW_ASSET_PATH = '/excalidraw-assets/';
  const root = createRoot(target);
  let api: ExcalidrawImperativeAPI | null = null;
  const render = () =>
    root.render(
      createElement(Excalidraw, {
        theme:
          document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
        initialData: { ...initialData, scrollToContent: true },
        excalidrawAPI: (value) => {
          api = value;
        },
        onChange: (elements, appState, files) =>
          onChange({
            elements,
            files,
            appState: {
              viewBackgroundColor: appState.viewBackgroundColor,
              gridSize: appState.gridSize,
              gridStep: appState.gridStep,
              gridModeEnabled: appState.gridModeEnabled,
            },
          }),
      }),
    );
  render();
  const observer = new MutationObserver(render);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return {
    destroy: () => {
      observer.disconnect();
      root.unmount();
    },
    download: (title: string) => {
      if (!api) return;
      const content = serializeAsJSON(
        api.getSceneElementsIncludingDeleted(),
        api.getAppState(),
        api.getFiles(),
        'local',
      );
      const url = URL.createObjectURL(
        new Blob([content], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'diagram'}.excalidraw`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  };
}
export async function thumbnail(
  snapshot: Snapshot,
  theme: 'light' | 'dark',
): Promise<string | null> {
  if (!snapshot.elements.some((e) => !e.isDeleted)) return null;
  const savedBackground = snapshot.appState.viewBackgroundColor?.toLowerCase();
  const defaultBackground =
    !savedBackground ||
    savedBackground === '#ffffff' ||
    savedBackground === '#121212';
  const blob = await exportToBlob({
    elements: snapshot.elements,
    appState: {
      ...snapshot.appState,
      theme,
      exportWithDarkMode: theme === 'dark',
      viewBackgroundColor: defaultBackground
        ? theme === 'dark'
          ? '#121212'
          : '#ffffff'
        : savedBackground,
      exportBackground: true,
    },
    files: snapshot.files,
    mimeType: 'image/png',
    maxWidthOrHeight: 560,
  });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
