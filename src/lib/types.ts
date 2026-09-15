import type { ExcalidrawInitialDataState } from '@excalidraw/excalidraw/types';
export type User = { id: string; username: string };
export type DiagramSummary = {
  id: string;
  title: string;
  folder_id: string | null;
  thumbnail: string | null;
  thumbnail_dark: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};
export type Diagram = DiagramSummary & { scene: ExcalidrawInitialDataState };

export type Folder = { id: string; name: string };
