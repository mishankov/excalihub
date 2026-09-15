import type { User } from './lib/types';
declare global {
  namespace App {
    interface Locals {
      user: User | null;
    }
  }
  interface Window {
    EXCALIDRAW_ASSET_PATH: string;
  }
}
export {};
