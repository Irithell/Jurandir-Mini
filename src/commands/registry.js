import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConsoleLogger } from '../utils/logger.js';
import { generateMenuCommand } from '../core/menu-generator.js';
import { removeAccents } from '../utils/string.js';

/** @typedef {import('@/types/commands.d.ts').CommandFunction} CommandFunction */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {Map<string, CommandFunction>} */
export const commandRegistry = new Map();

/** @type {Map<string, any>} */
export const noPrefixRegistry = new Map();

/**
 * @param {string} category
 */
export function getByCategory(category) {
  const cmds = [];
  for (const [name, fn] of commandRegistry.entries()) {
    if (!fn.isAlias && fn.category === category && !name.startsWith('menu')) {
      cmds.push({ name, description: fn.description });
    }
  }
  return cmds;
}

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
            const cmdFn = /** @type {CommandFunction} */ (module.default);

            cmdFn.category = folder.name;
            cmdFn.description = module.description || '';
            cmdFn.isAlias = false;

            commandRegistry.set(commandName, cmdFn);

            if (module.noPrefixConfig) {
              const rawConfig = module.noPrefixConfig;
              noPrefixRegistry.set(commandName, {
                config: {
                  matchType: rawConfig.matchType || 'exact',

                  triggers: (rawConfig.triggers || []).map((t) =>
                    removeAccents(t).toLowerCase().trim()
                  ),
                },
                execute: cmdFn,
              });
            }

            loadedCount++;

            if (module.aliases && Array.isArray(module.aliases)) {
              for (const alias of module.aliases) {
                const aliasFn = /** @type {CommandFunction} */ (async (ctx) => cmdFn(ctx));
                aliasFn.category = folder.name;
                aliasFn.description = cmdFn.description;
                aliasFn.isAlias = true;

                commandRegistry.set(alias.toLowerCase(), aliasFn);
              }
            }
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          ConsoleLogger.dispatch({
            level: 'error',
            lines: [
              { message: `Erro ao carregar o comando ${file}:`, tags: [{ label: 'CMD' }] },
              { message: errorMessage, omitTimestamp: true },
            ],
          });
        }
      }

      const generatedMenuFn = /** @type {CommandFunction} */ (generateMenuCommand(folder.name));
      generatedMenuFn.category = 'info';
      generatedMenuFn.isAlias = false;

      commandRegistry.set(`menu${folder.name.toLowerCase()}`, generatedMenuFn);
    }

    ConsoleLogger.dispatch({
      level: 'success',
      lines: [
        {
          message: `${loadedCount} comandos e submenus gerados automaticamente`,
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
