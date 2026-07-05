import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, 'config.json');

const _cfg = JSON.parse(readFileSync(configPath, 'utf-8'));

export const botConfig = {
  name: _cfg.name,
  prefix: _cfg.prefix,
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

export const getAssetUrl = (section, asset) => botConfig.assets[section][asset];

export const Assets = {
  primary: botConfig.assets.primary,
  profile: botConfig.assets.profile,
};
