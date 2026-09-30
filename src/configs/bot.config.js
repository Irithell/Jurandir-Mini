import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, 'config.json');

const _cfg = JSON.parse(readFileSync(configPath, 'utf-8'));

export const botConfig = {
  name: _cfg.name,
  prefix: _cfg.prefix,
  buttons: _cfg.buttons !== undefined ? _cfg.buttons : 2,
  owner: {
    name: _cfg.owner.name,
    phones: _cfg.owner.phones,
  },
  consoleLogs: {
    enabled: _cfg.consoleLogs.enabled,
  },
  sessionId: _cfg.sessionId,
  timezone: _cfg.timezone,
  assets: _cfg.assets,
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || _cfg.gemini?.apiKey || '',
  },
};

/**
 * @param {string} section
 * @param {string} asset
 * @returns {string}
 */
export const getAssetUrl = (section, asset) => (/** @type {any} */ (botConfig.assets))[section]?.[asset];

export const Assets = {
  primary: botConfig.assets.primary,
  profile: botConfig.assets.profile,
};
