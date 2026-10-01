import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConsoleLogger } from '../utils/logger.js';
import { generateMenuCommand } from '../core/menu-generator.js';
import { removeAccents } from '../utils/string.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @typedef {import('@/types/commands.d.ts').CommandContext} CommandContext
 * @typedef {import('@/types/commands.d.ts').CommandFunction} CommandFunction
 * @typedef {import('@/types/commands.d.ts').CommandEntry} CommandEntry
 */

export class CommandRegistry {
  constructor() {
    /** @type {Map<string, CommandEntry>} */
    this.commands = new Map();
    /** @type {Map<string, string>} */
    this.aliases = new Map();
  }

  /**
   * @param {CommandEntry} command
   * @returns {void}
   */
  register(command) {
    const canonicalName = command.name.toLowerCase().trim();
    this.commands.set(canonicalName, command);

    if (Array.isArray(command.aliases)) {
      for (const alias of command.aliases) {
        if (!alias) continue;
        const lowerAlias = alias.toLowerCase().trim();
        if (lowerAlias !== canonicalName) {
          this.aliases.set(lowerAlias, canonicalName);
        }
      }
    }
  }

  /**
   * @param {string} nameOrAlias
   * @returns {CommandFunction | undefined}
   */
  get(nameOrAlias) {
    if (!nameOrAlias) return undefined;
    const entry = this.getCommand(nameOrAlias);
    return entry ? entry.execute : undefined;
  }

  /**
   * @param {string} nameOrAlias
   * @returns {CommandEntry | undefined}
   */
  getCommand(nameOrAlias) {
    if (!nameOrAlias) return undefined;
    const lower = nameOrAlias.toLowerCase().trim();

    if (this.commands.has(lower)) {
      return this.commands.get(lower);
    }

    const canonicalName = this.aliases.get(lower);
    if (canonicalName && this.commands.has(canonicalName)) {
      return this.commands.get(canonicalName);
    }

    return undefined;
  }

  /**
   * @param {string} nameOrAlias
   * @returns {boolean}
   */
  has(nameOrAlias) {
    if (!nameOrAlias) return false;
    const lower = nameOrAlias.toLowerCase().trim();
    return this.commands.has(lower) || this.aliases.has(lower);
  }

  /**
   * @returns {CommandEntry[]}
   */
  getAll() {
    return Array.from(this.commands.values());
  }

  /**
   * @param {string} category
   * @returns {CommandEntry[]}
   */
  getByCategory(category) {
    const targetCategory = category.toLowerCase().trim();
    return this.getAll().filter(
      (cmd) => cmd.category.toLowerCase().trim() === targetCategory && !cmd.isSubmenu
    );
  }

  /**
   * @returns {number}
   */
  get size() {
    return this.getAll().filter((cmd) => !cmd.isSubmenu).length;
  }

  /**
   * @returns {void}
   */
  clear() {
    this.commands.clear();
    this.aliases.clear();
  }
}

export const commandRegistry = new CommandRegistry();
export const noPrefixRegistry = new Map();

/**
 * @param {string} category
 * @returns {CommandEntry[]}
 */
export function getByCategory(category) {
  return commandRegistry.getByCategory(category);
}

/**
 * @returns {Promise<void>}
 */
export async function loadCommands() {
  commandRegistry.clear();
  noPrefixRegistry.clear();
  let loadedCount = 0;

  try {
    const commandsDir = path.join(__dirname);
    const folders = fs
      .readdirSync(commandsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory());

    for (const folder of folders) {
      const folderPath = path.join(commandsDir, folder.name);
      const files = fs.readdirSync(folderPath).filter((file) => file.endsWith('.js'));

      for (const file of files) {
        const filePath = path.join(folderPath, file);
        const commandName = file.replace('.js', '').toLowerCase();

        try {
          const module = await import(`file://${filePath}`);

          if (typeof module.default === 'function') {
            const cmdFn = module.default;

            cmdFn.category = folder.name;
            cmdFn.description = module.description || '';

            commandRegistry.register({
              name: commandName,
              category: folder.name,
              description: module.description || '',
              aliases: Array.isArray(module.aliases) ? module.aliases : [],
              isSubmenu: false,
              execute: cmdFn,
            });

            if (module.noPrefixConfig) {
              const normalizedTriggers = module.noPrefixConfig.triggers.map(
                /** @param {string} t */ (t) => removeAccents(t).toLowerCase().trim()
              );

              noPrefixRegistry.set(commandName, {
                config: { ...module.noPrefixConfig, triggers: normalizedTriggers },
                execute: cmdFn,
              });
            }

            loadedCount++;
          }
        } catch (err) {
          const error = /** @type {Error} */ (err);
          ConsoleLogger.dispatch({
            level: 'error',
            lines: [
              { message: `Erro ao carregar ${file}:`, tags: [{ label: 'REGISTRY' }] },
              { message: error.message, omitTimestamp: true },
            ],
          });
        }
      }

      const generatedMenuFn = generateMenuCommand(folder.name);
      commandRegistry.register({
        name: `menu${folder.name.toLowerCase()}`,
        category: folder.name,
        description: `Menu de comandos da categoria ${folder.name}`,
        aliases: [],
        isSubmenu: true,
        execute: generatedMenuFn,
      });
    }

    ConsoleLogger.dispatch({
      level: 'success',
      lines: [
        {
          message: `${loadedCount} comando(s) carregados (${commandRegistry.size} canônicos).`,
          tags: [{ label: 'REGISTRY' }],
        },
      ],
    });
  } catch (err) {
    ConsoleLogger.dispatch({
      level: 'error',
      lines: [
        { message: 'Erro ao ler diretório de comandos:', tags: [{ label: 'REGISTRY' }] },
        { message: String(err), omitTimestamp: true },
      ],
    });
  }
}
