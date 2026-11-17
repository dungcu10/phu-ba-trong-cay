import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildContentPack, loadContentPack, type ContentPack, type RawContent } from '../src/core/content.ts';
import { createNewGame, type GameState } from '../src/core/state.ts';

export const CONTENT_DIR = join(import.meta.dirname, '..', 'content', 'base');
export const T0 = Date.UTC(2026, 10, 16, 3, 0, 0);
export const SEC = 1000;
export const MIN = 60 * SEC;
export const HOUR = 60 * MIN;

export async function readRaw(): Promise<RawContent> {
  const read = async (f: string) => JSON.parse(await readFile(join(CONTENT_DIR, f), 'utf8')) as unknown;
  const manifest = (await read('manifest.json')) as { contentVersion: number; files: Record<string, string> };
  return {
    contentVersion: manifest.contentVersion,
    config: await read(manifest.files.config!),
    floors: await read(manifest.files.floors!),
    pots: await read(manifest.files.pots!),
    crops: await read(manifest.files.crops!),
    bugs: await read(manifest.files.bugs!),
    orders: await read(manifest.files.orders!),
    surprises: await read(manifest.files.surprises!),
    neighbors: await read(manifest.files.neighbors!),
    potsets: await read(manifest.files.potsets!),
    missions: await read(manifest.files.missions!),
    materials: await read(manifest.files.materials!),
    events: await read(manifest.files.events!),
    quests: await read(manifest.files.quests!),
    features: await read(manifest.files.features!),
    tutorials: await read(manifest.files.tutorials!),
  };
}

export async function loadBase(): Promise<ContentPack> {
  return loadContentPack(async (f) => JSON.parse(await readFile(join(CONTENT_DIR, f), 'utf8')));
}

export { buildContentPack };

export function newGame(content: ContentPack, overrides: Partial<GameState['player']> = {}, entropy = 42): GameState {
  const s = createNewGame(content, T0, entropy);
  Object.assign(s.player, overrides);
  return s;
}

export const DAISY = 'base:crop.cotton-daisy';
export const TOMATO = 'base:crop.cherry-tomato';
export const MINT = 'base:crop.cloud-mint';
export const BUG = 'base:bug.ladybird';
