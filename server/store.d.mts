import type { DatabaseSync } from 'node:sqlite';
import type { User, Diagram, DiagramSummary, Folder } from '../src/lib/types';
export function db(): DatabaseSync;
export function hashPassword(password: string): Promise<string>;
export function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean>;
export function normalizeUsername(username: string): string;
export function createUser(username: string, password: string): Promise<User>;
export function changePassword(
  username: string,
  password: string,
): Promise<void>;
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string);
}
export function login(
  username: string,
  password: string,
): Promise<{ token: string; user: User }>;
export function sessionUser(token?: string): User | null;
export function logout(token?: string): void;
export function listDiagrams(userId: string): DiagramSummary[];
export function createDiagram(
  userId: string,
  title: string,
  folderId?: string | null,
): Diagram;
export function getDiagram(userId: string, id: string): Diagram;
export function saveDiagram(
  userId: string,
  id: string,
  data: Pick<
    Diagram,
    'title' | 'scene' | 'version' | 'thumbnail' | 'thumbnail_dark'
  >,
): Diagram;
export function deleteDiagram(userId: string, id: string): void;

export function listFolders(userId: string): Folder[];
export function getFolder(userId: string, id: string): Folder;
export function createFolder(userId: string, name: string): Folder;
export function renameFolder(userId: string, id: string, name: string): Folder;
export function deleteFolder(userId: string, id: string): void;
export function moveDiagram(
  userId: string,
  id: string,
  folderId: string | null,
): Diagram;

export function renameDiagram(
  userId: string,
  id: string,
  title: string,
  version: number,
): Diagram;
