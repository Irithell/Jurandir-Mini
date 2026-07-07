import { addonDbGet, addonDbAll, addonDbRun } from '../../configs/addons-db.js';
import {
  install,
  update as updateAddon,
  remove as removeAddon,
  ADDONS_RAW_BASE,
} from '../../core/addon-installer.js';

/** @typedef {import('@/types/commands.d.ts').CommandContext} CommandContext */

export const description = 'Gerencia addons do bot';

export const aliases = [
  'addon_browse',
  'addon_cat',
  'addon_bundle',
  'addon_detail',
  'addon_manage',
  'addon_install',
  'addon_update',
  'addon_installed',
  'addon_toggle',
  'addon_remove',
  'addon_remove_confirm',
  'addon_status',
];

/** @type {Map<string, { category?: string, bundlePath?: string }>} */
const sessions = new Map();

/**
 * @param {string} from
 */
function getSession(from) {
  if (!sessions.has(from)) sessions.set(from, {});
  return sessions.get(from);
}

/**
 * @param {any} obj
 * @param {any} botConfig
 * @returns {string}
 */
function getImage(obj, botConfig) {
  return obj?.image || botConfig.assets.primary.headerImage;
}

async function fetchRegistry() {
  const res = await fetch(`${ADDONS_RAW_BASE}/registry.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * @param {string} bundlePath
 */
async function fetchBundleJson(bundlePath) {
  const res = await fetch(`${ADDONS_RAW_BASE}/${bundlePath}/bundle.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * @param {string} addonPath
 */
async function fetchManifest(addonPath) {
  const res = await fetch(`${ADDONS_RAW_BASE}/${addonPath}/manifest.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * @param {CommandContext} ctx
 */
async function showMainMenu(ctx) {
  const {
    jurandir,
    from,
    info,
    prefix,
    botConfig,
    utils: { react, toUnicodeBoldUpper, sendButton },
  } = ctx;

  if (info.key) await react(jurandir, from, '🧩', info.key);

  const installedCount = addonDbAll(`SELECT name FROM addons WHERE status = 'done'`).length;

  await sendButton(jurandir, from, {
    bodyText: toUnicodeBoldUpper(`${botConfig.name} - CENTRAL DE ADDONS`),
    cards: [
      {
        header: { mediaUrl: botConfig.assets.primary.headerImage, mediaType: 'image' },
        body: toUnicodeBoldUpper(
          `╭══════════════════════╗\n╰╮ 🧩 ADDONS\n╭┤ ${installedCount} instalado(s)\n╰══════════════════════╝`
        ),
        footer: toUnicodeBoldUpper('Selecione uma opção'),
        buttons: [
          {
            type: 'list',
            text: toUnicodeBoldUpper('🧩 MENU'),
            sections: [
              {
                title: toUnicodeBoldUpper('OPÇÕES'),
                rows: [
                  {
                    id: `${prefix}addon_browse`,
                    title: toUnicodeBoldUpper('🔍 Explorar Addons'),
                    description: toUnicodeBoldUpper('Ver addons disponíveis no repositório'),
                  },
                  {
                    id: `${prefix}addon_installed`,
                    title: toUnicodeBoldUpper('📦 Instalados'),
                    description: toUnicodeBoldUpper(`${installedCount} addon(s) instalado(s)`),
                  },
                  {
                    id: `${prefix}addon_status`,
                    title: toUnicodeBoldUpper('⚙️ Status'),
                    description: toUnicodeBoldUpper('Instalações pendentes ou com erro'),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    quotedMessage: info,
  });
}

/**
 * @param {CommandContext} ctx
 */
async function showBrowse(ctx) {
  const {
    jurandir,
    from,
    info,
    prefix,
    botConfig,
    utils: { react, toUnicodeBoldUpper, sendButton, errorReply },
  } = ctx;

  if (info.key) await react(jurandir, from, '🔍', info.key);

  let registry;
  try {
    registry = await fetchRegistry();
  } catch {
    await errorReply(
      jurandir,
      from,
      toUnicodeBoldUpper('Não foi possível acessar o repositório de addons.'),
      info
    );
    return;
  }

  const rows = registry.categories.map((cat) => ({
    id: `${prefix}addon_cat ${cat.name}`,
    title: toUnicodeBoldUpper(`${cat.emoji} ${cat.displayName}`),
    description: toUnicodeBoldUpper(
      `${cat.items.length} ${cat.items.length === 1 ? 'addon' : 'addons'}`
    ),
  }));

  await sendButton(jurandir, from, {
    bodyText: toUnicodeBoldUpper('EXPLORAR ADDONS'),
    cards: [
      {
        header: { mediaUrl: botConfig.assets.primary.headerImage, mediaType: 'image' },
        body: toUnicodeBoldUpper(
          `╭══════════════════════╗\n╰╮ 🔍 CATEGORIAS\n╭┤ Selecione uma categoria\n╰══════════════════════╝`
        ),
        footer: toUnicodeBoldUpper('Repositório oficial de addons'),
        buttons: [
          {
            type: 'list',
            text: toUnicodeBoldUpper('🗂️ CATEGORIAS'),
            sections: [
              {
                title: toUnicodeBoldUpper(`${registry.categories.length} CATEGORIAS`),
                rows,
              },
            ],
          },
        ],
      },
    ],
    quotedMessage: info,
  });
}

/**
 * @param {CommandContext} ctx
 */
async function showCategory(ctx) {
  const {
    jurandir,
    from,
    info,
    args,
    prefix,
    botConfig,
    utils: { react, toUnicodeBoldUpper, sendButton, errorReply },
  } = ctx;

  const categoryName = args[0];
  if (!categoryName) return;

  const session = getSession(from);
  session.category = categoryName;

  if (info.key) await react(jurandir, from, '📂', info.key);

  let registry;
  try {
    registry = await fetchRegistry();
  } catch {
    await errorReply(
      jurandir,
      from,
      toUnicodeBoldUpper('Não foi possível acessar o repositório.'),
      info
    );
    return;
  }

  const category = registry.categories.find((c) => c.name === categoryName);
  if (!category) return;

  const installedNames = new Set(
    addonDbAll(`SELECT name FROM addons WHERE status = 'done'`).map((r) => r.name)
  );

  const bundles = category.items.filter((i) => i.type === 'bundle');
  const standalone = category.items.filter((i) => i.type !== 'bundle');
  const sections = [];

  if (bundles.length) {
    sections.push({
      title: toUnicodeBoldUpper('BUNDLES'),
      highlight_label: toUnicodeBoldUpper('📦 PACOTE'),
      rows: bundles.map((item) => ({
        id: `${prefix}addon_bundle ${item.path}`,
        title: toUnicodeBoldUpper(item.displayName),
        description: toUnicodeBoldUpper(`${item.componentCount} addons`),
      })),
    });
  }

  if (standalone.length) {
    sections.push({
      title: toUnicodeBoldUpper('ADDONS INDIVIDUAIS'),
      highlight_label: toUnicodeBoldUpper('🔧 ADDON'),
      rows: standalone.map((item) => ({
        id: `${prefix}addon_detail ${item.path}`,
        title: toUnicodeBoldUpper(
          `${installedNames.has(item.name) ? '✅ ' : ''}${item.displayName}`
        ),
        description: toUnicodeBoldUpper(item.description),
      })),
    });
  }

  await sendButton(jurandir, from, {
    bodyText: toUnicodeBoldUpper(`${category.emoji} ${category.displayName}`),
    cards: [
      {
        header: { mediaUrl: botConfig.assets.primary.headerImage, mediaType: 'image' },
        body: toUnicodeBoldUpper(
          `╭══════════════════════╗\n╰╮ ${category.emoji} ${category.displayName.toUpperCase()}\n╭┤ ${category.items.length} item(s) disponível(is)\n╰══════════════════════╝`
        ),
        footer: toUnicodeBoldUpper('Selecione um addon'),
        buttons: [
          {
            type: 'list',
            text: toUnicodeBoldUpper('📦 ADDONS'),
            sections,
          },
        ],
      },
    ],
    quotedMessage: info,
  });
}

/**
 * @param {CommandContext} ctx
 */
async function showBundle(ctx) {
  const {
    jurandir,
    from,
    info,
    args,
    prefix,
    botConfig,
    utils: { react, toUnicodeBoldUpper, sendButton, errorReply },
  } = ctx;

  const bundlePath = args[0];
  if (!bundlePath) return;

  const session = getSession(from);
  session.bundlePath = bundlePath;

  if (info.key) await react(jurandir, from, '📦', info.key);

  let bundle, componentManifests;
  try {
    bundle = await fetchBundleJson(bundlePath);
    componentManifests = await Promise.all(
      bundle.components.map((comp) => fetchManifest(`${bundlePath}/${comp}`))
    );
  } catch {
    await errorReply(
      jurandir,
      from,
      toUnicodeBoldUpper('Não foi possível carregar o bundle.'),
      info
    );
    return;
  }

  const installedNames = new Set(
    addonDbAll(`SELECT name FROM addons WHERE status = 'done'`).map((r) => r.name)
  );

  const categoryName = session.category;
  const bundleImage = getImage(bundle, botConfig);

  const firstCard = {
    header: { mediaUrl: bundleImage, mediaType: 'image' },
    body: toUnicodeBoldUpper(
      `╭══════════════════════╗\n╰╮ 📦 ${bundle.displayName}\n╭┤ ${bundle.description}\n╰╮ ${bundle.components.length} addons · v${bundle.version}\n╭┤ Por ${bundle.author}\n╰══════════════════════╝`
    ),
    footer: toUnicodeBoldUpper('Bundle completo'),
    buttons: [
      {
        type: 'reply',
        id: `${prefix}addon_install ${bundlePath}`,
        text: toUnicodeBoldUpper('⬇️ INSTALAR BUNDLE'),
      },
      {
        type: 'reply',
        id: categoryName ? `${prefix}addon_cat ${categoryName}` : `${prefix}addon_browse`,
        text: toUnicodeBoldUpper('◀ VOLTAR'),
      },
    ],
  };

  const componentCards = componentManifests.map((manifest, i) => {
    const compPath = `${bundlePath}/${bundle.components[i]}`;
    const isInstalled = installedNames.has(manifest.name);
    const compImage = getImage(manifest, botConfig);

    return {
      header: { mediaUrl: compImage, mediaType: 'image' },
      body: toUnicodeBoldUpper(
        `╭══════════════════════╗\n╰╮ ${manifest.displayName}\n╭┤ ${manifest.description}\n╰╮ v${manifest.version} · Por ${manifest.author}\n╭┤ ${isInstalled ? '✅ Instalado' : '⬜ Não instalado'}\n╰══════════════════════╝`
      ),
      footer: toUnicodeBoldUpper(manifest.name),
      buttons: [
        {
          type: 'reply',
          id: isInstalled
            ? `${prefix}addon_manage ${manifest.name}`
            : `${prefix}addon_install ${compPath}`,
          text: isInstalled
            ? toUnicodeBoldUpper('⚙️ GERENCIAR')
            : toUnicodeBoldUpper('⬇️ INSTALAR'),
        },
      ],
    };
  });

  await sendButton(jurandir, from, {
    bodyText: toUnicodeBoldUpper(`📦 ${bundle.displayName}`),
    cards: [firstCard, ...componentCards],
    quotedMessage: info,
  });
}

/**
 * @param {CommandContext} ctx
 */
async function showDetail(ctx) {
  const {
    jurandir,
    from,
    info,
    args,
    prefix,
    botConfig,
    utils: { react, toUnicodeBoldUpper, sendButton, errorReply },
  } = ctx;

  const addonPath = args[0];
  if (!addonPath) return;

  if (info.key) await react(jurandir, from, '📋', info.key);

  let manifest;
  try {
    manifest = await fetchManifest(addonPath);
  } catch {
    await errorReply(
      jurandir,
      from,
      toUnicodeBoldUpper('Não foi possível carregar o addon.'),
      info
    );
    return;
  }

  const installed = addonDbGet(
    `SELECT name, enabled FROM addons WHERE name = ? AND status = 'done'`,
    [manifest.name]
  );

  const session = getSession(from);
  const categoryName = session.category;
  const addonImage = getImage(manifest, botConfig);
  const statusText = installed
    ? installed.enabled
      ? '✅ Instalado e ativo'
      : '⏸️ Instalado e inativo'
    : '⬜ Não instalado';

  const changelogEntries = manifest.changelog ? Object.entries(manifest.changelog) : [];
  const latestEntry = changelogEntries[0];
  const changelogLine = latestEntry ? `v${latestEntry[0]}: ${latestEntry[1]}` : null;

  const bodyLines = [
    `╭══════════════════════╗`,
    `╰╮ ${manifest.displayName}`,
    `╭┤ ${manifest.description}`,
    `╰╮ v${manifest.version} · Por ${manifest.author}`,
    `╭┤ ${statusText}`,
    changelogLine ? `╰╮ ${changelogLine}` : null,
    `╰══════════════════════╝`,
  ]
    .filter(Boolean)
    .join('\n');

  const buttons = installed
    ? [
        {
          type: 'reply',
          id: `${prefix}addon_toggle ${manifest.name}`,
          text: installed.enabled
            ? toUnicodeBoldUpper('⏸️ DESATIVAR')
            : toUnicodeBoldUpper('▶️ ATIVAR'),
        },
        {
          type: 'reply',
          id: `${prefix}addon_remove ${manifest.name}`,
          text: toUnicodeBoldUpper('🗑️ REMOVER'),
        },
        {
          type: 'reply',
          id: categoryName ? `${prefix}addon_cat ${categoryName}` : `${prefix}addon_browse`,
          text: toUnicodeBoldUpper('◀ VOLTAR'),
        },
      ]
    : [
        {
          type: 'reply',
          id: `${prefix}addon_install ${addonPath}`,
          text: toUnicodeBoldUpper('⬇️ INSTALAR'),
        },
        {
          type: 'reply',
          id: categoryName ? `${prefix}addon_cat ${categoryName}` : `${prefix}addon_browse`,
          text: toUnicodeBoldUpper('◀ VOLTAR'),
        },
      ];

  await sendButton(jurandir, from, {
    bodyText: toUnicodeBoldUpper(manifest.displayName),
    cards: [
      {
        header: { mediaUrl: addonImage, mediaType: 'image' },
        body: toUnicodeBoldUpper(bodyLines),
        footer: toUnicodeBoldUpper('Selecione uma ação'),
        buttons,
      },
    ],
    quotedMessage: info,
  });
}

/**
 * @param {CommandContext} ctx
 */
async function showManage(ctx) {
  const {
    jurandir,
    from,
    info,
    args,
    prefix,
    botConfig,
    utils: { react, toUnicodeBoldUpper, sendButton, reply },
  } = ctx;

  const addonName = args[0];
  if (!addonName) return;

  const addon = addonDbGet(
    `SELECT name, version, enabled, manifest FROM addons WHERE name = ? AND status = 'done'`,
    [addonName]
  );

  if (!addon) {
    await reply(jurandir, from, toUnicodeBoldUpper('Addon não encontrado.'), info);
    return;
  }

  if (info.key) await react(jurandir, from, '⚙️', info.key);

  const manifest = JSON.parse(addon.manifest);
  const addonImage = getImage(manifest, botConfig);
  const statusText = addon.enabled ? '✅ Ativo' : '⏸️ Inativo';

  await sendButton(jurandir, from, {
    bodyText: toUnicodeBoldUpper(manifest.displayName || addonName),
    cards: [
      {
        header: { mediaUrl: addonImage, mediaType: 'image' },
        body: toUnicodeBoldUpper(
          `╭══════════════════════╗\n╰╮ ⚙️ ${manifest.displayName || addonName}\n╭┤ v${addon.version}\n╰╮ ${statusText}\n╰══════════════════════╝`
        ),
        footer: toUnicodeBoldUpper('Gerenciar addon'),
        buttons: [
          {
            type: 'reply',
            id: `${prefix}addon_toggle ${addonName}`,
            text: addon.enabled
              ? toUnicodeBoldUpper('⏸️ DESATIVAR')
              : toUnicodeBoldUpper('▶️ ATIVAR'),
          },
          {
            type: 'reply',
            id: `${prefix}addon_update ${addonName}`,
            text: toUnicodeBoldUpper('🔄 ATUALIZAR'),
          },
          {
            type: 'reply',
            id: `${prefix}addon_remove ${addonName}`,
            text: toUnicodeBoldUpper('🗑️ REMOVER'),
          },
        ],
      },
    ],
    quotedMessage: info,
  });
}

/**
 * @param {CommandContext} ctx
 */
async function startInstall(ctx) {
  const {
    jurandir,
    from,
    info,
    args,
    utils: { toUnicodeBoldUpper, successReact },
  } = ctx;

  const addonPath = args[0];
  if (!addonPath) return;

  let progressText = 'Iniciando instalação...';
  let stopped = false;

  const { key: msgKey } = await jurandir.sendMessage(
    from,
    { text: toUnicodeBoldUpper(`> ⚙️ ${progressText}`) },
    { quoted: info }
  );

  (async () => {
    while (!stopped) {
      await new Promise((r) => setTimeout(r, 1300));
      if (stopped) break;
      try {
        await jurandir.sendMessage(from, {
          text: toUnicodeBoldUpper(`> ⚙️ ${progressText}`),
          edit: msgKey,
        });
      } catch {}
    }
  })();

  try {
    await install(addonPath, {
      onProgress: (text) => {
        progressText = text;
      },
    });
    stopped = true;
    await jurandir.sendMessage(from, {
      text: toUnicodeBoldUpper('> ✅ Instalação concluída.'),
      edit: msgKey,
    });
    if (info.key) await successReact(jurandir, from, info.key);
  } catch (err) {
    stopped = true;
    const errMsg = err instanceof Error ? err.message : String(err);
    await jurandir.sendMessage(from, {
      text: toUnicodeBoldUpper(`> ❌ Falha na instalação.\n> ${errMsg}`),
      edit: msgKey,
    });
  }
}

/**
 * @param {CommandContext} ctx
 */
async function startUpdate(ctx) {
  const {
    jurandir,
    from,
    info,
    args,
    utils: { toUnicodeBoldUpper, successReact },
  } = ctx;

  const addonName = args[0];
  if (!addonName) return;

  let progressText = `Iniciando atualização de ${addonName}...`;
  let stopped = false;

  const { key: msgKey } = await jurandir.sendMessage(
    from,
    { text: toUnicodeBoldUpper(`> 🔄 ${progressText}`) },
    { quoted: info }
  );

  (async () => {
    while (!stopped) {
      await new Promise((r) => setTimeout(r, 1300));
      if (stopped) break;
      try {
        await jurandir.sendMessage(from, {
          text: toUnicodeBoldUpper(`> 🔄 ${progressText}`),
          edit: msgKey,
        });
      } catch {}
    }
  })();

  try {
    await updateAddon(addonName, {
      onProgress: (text) => {
        progressText = text;
      },
    });
    stopped = true;
    await jurandir.sendMessage(from, {
      text: toUnicodeBoldUpper(`> ✅ ${addonName} atualizado.`),
      edit: msgKey,
    });
    if (info.key) await successReact(jurandir, from, info.key);
  } catch (err) {
    stopped = true;
    const errMsg = err instanceof Error ? err.message : String(err);
    await jurandir.sendMessage(from, {
      text: toUnicodeBoldUpper(`> ❌ Falha na atualização.\n> ${errMsg}`),
      edit: msgKey,
    });
  }
}

/**
 * @param {CommandContext} ctx
 */
async function showInstalled(ctx) {
  const {
    jurandir,
    from,
    info,
    prefix,
    botConfig,
    utils: { react, toUnicodeBoldUpper, sendButton, reply },
  } = ctx;

  if (info.key) await react(jurandir, from, '📦', info.key);

  const installed = addonDbAll(
    `SELECT name, version, enabled FROM addons WHERE status = 'done' ORDER BY name`
  );

  if (!installed.length) {
    await reply(jurandir, from, toUnicodeBoldUpper('Nenhum addon instalado.'), info);
    return;
  }

  const rows = installed.map((addon) => ({
    id: `${prefix}addon_manage ${addon.name}`,
    title: toUnicodeBoldUpper(`${addon.enabled ? '✅' : '⏸️'} ${addon.name}`),
    description: toUnicodeBoldUpper(`v${addon.version}`),
  }));

  await sendButton(jurandir, from, {
    bodyText: toUnicodeBoldUpper('ADDONS INSTALADOS'),
    cards: [
      {
        header: { mediaUrl: botConfig.assets.primary.headerImage, mediaType: 'image' },
        body: toUnicodeBoldUpper(
          `╭══════════════════════╗\n╰╮ 📦 INSTALADOS\n╭┤ ${installed.length} addon(s)\n╰══════════════════════╝`
        ),
        footer: toUnicodeBoldUpper('Selecione para gerenciar'),
        buttons: [
          {
            type: 'list',
            text: toUnicodeBoldUpper('📦 INSTALADOS'),
            sections: [
              {
                title: toUnicodeBoldUpper(`${installed.length} ADDON(S)`),
                rows,
              },
            ],
          },
        ],
      },
    ],
    quotedMessage: info,
  });
}

/**
 * @param {CommandContext} ctx
 */
async function toggleAddon(ctx) {
  const {
    jurandir,
    from,
    info,
    args,
    utils: { toUnicodeBoldUpper, reply },
  } = ctx;

  const addonName = args[0];
  if (!addonName) return;

  const addon = addonDbGet(`SELECT name, enabled FROM addons WHERE name = ? AND status = 'done'`, [
    addonName,
  ]);

  if (!addon) {
    await reply(jurandir, from, toUnicodeBoldUpper('Addon não encontrado.'), info);
    return;
  }

  const newEnabled = addon.enabled ? 0 : 1;
  addonDbRun(`UPDATE addons SET enabled = ? WHERE name = ?`, [newEnabled, addonName]);

  await reply(
    jurandir,
    from,
    toUnicodeBoldUpper(
      `> ✅ ${addonName} ${newEnabled ? 'ativado' : 'desativado'}. Reiniciando...`
    ),
    info
  );

  await new Promise((r) => setTimeout(r, 800));
  process.send?.({ type: 'RESTART' });
}

/**
 * @param {CommandContext} ctx
 */
async function showRemoveConfirm(ctx) {
  const {
    jurandir,
    from,
    info,
    args,
    prefix,
    botConfig,
    utils: { react, toUnicodeBoldUpper, sendButton, reply },
  } = ctx;

  const addonName = args[0];
  if (!addonName) return;

  const addon = addonDbGet(`SELECT name, version FROM addons WHERE name = ?`, [addonName]);
  if (!addon) {
    await reply(jurandir, from, toUnicodeBoldUpper('Addon não encontrado.'), info);
    return;
  }

  if (info.key) await react(jurandir, from, '🗑️', info.key);

  await sendButton(jurandir, from, {
    bodyText: toUnicodeBoldUpper(`REMOVER ${addonName}?`),
    cards: [
      {
        header: { mediaUrl: botConfig.assets.primary.headerImage, mediaType: 'image' },
        body: toUnicodeBoldUpper(
          `╭══════════════════════╗\n╰╮ 🗑️ REMOVER ADDON\n╭┤ ${addonName} v${addon.version}\n╰╮ Os arquivos do addon serão\n╭┤ removidos permanentemente.\n╰══════════════════════╝`
        ),
        footer: toUnicodeBoldUpper('Esta ação não pode ser desfeita'),
        buttons: [
          {
            type: 'reply',
            id: `${prefix}addon_remove_confirm ${addonName}`,
            text: toUnicodeBoldUpper('🗑️ CONFIRMAR'),
          },
          {
            type: 'reply',
            id: `${prefix}addon_installed`,
            text: toUnicodeBoldUpper('◀ CANCELAR'),
          },
        ],
      },
    ],
    quotedMessage: info,
  });
}

/**
 * @param {CommandContext} ctx
 */
async function confirmRemove(ctx) {
  const {
    jurandir,
    from,
    info,
    args,
    utils: { toUnicodeBoldUpper, reply, successReact },
  } = ctx;

  const addonName = args[0];
  if (!addonName) return;

  try {
    await removeAddon(addonName);
    if (info.key) await successReact(jurandir, from, info.key);
    await reply(jurandir, from, toUnicodeBoldUpper(`> ✅ ${addonName} removido.`), info);
    await new Promise((r) => setTimeout(r, 800));
    process.send?.({ type: 'RESTART' });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await reply(jurandir, from, toUnicodeBoldUpper(`> ❌ Falha ao remover: ${errMsg}`), info);
  }
}

/**
 * @param {CommandContext} ctx
 */
async function showStatus(ctx) {
  const {
    jurandir,
    from,
    info,
    botConfig,
    utils: { react, toUnicodeBoldUpper, sendButton, reply },
  } = ctx;

  if (info.key) await react(jurandir, from, '⚙️', info.key);

  const pending = addonDbAll(
    `SELECT name, status, current_step FROM addons WHERE status NOT IN ('done') ORDER BY name`
  );

  if (!pending.length) {
    await reply(jurandir, from, toUnicodeBoldUpper('Nenhuma instalação pendente.'), info);
    return;
  }

  const rows = pending.map((addon) => ({
    id: `addon_info_${addon.name}`,
    title: toUnicodeBoldUpper(addon.name),
    description: toUnicodeBoldUpper(
      `${addon.status}${addon.current_step ? `: ${addon.current_step}` : ''}`
    ),
  }));

  await sendButton(jurandir, from, {
    bodyText: toUnicodeBoldUpper('STATUS DE INSTALAÇÕES'),
    cards: [
      {
        header: { mediaUrl: botConfig.assets.primary.headerImage, mediaType: 'image' },
        body: toUnicodeBoldUpper(
          `╭══════════════════════╗\n╰╮ ⚙️ STATUS\n╭┤ ${pending.length} pendente(s)\n╰══════════════════════╝`
        ),
        footer: toUnicodeBoldUpper('Instalações em andamento ou com erro'),
        buttons: [
          {
            type: 'list',
            text: toUnicodeBoldUpper('⚙️ STATUS'),
            sections: [
              {
                title: toUnicodeBoldUpper(`${pending.length} PENDENTES`),
                rows,
              },
            ],
          },
        ],
      },
    ],
    quotedMessage: info,
  });
}

/** @param {CommandContext} ctx */
export default async (ctx) => {
  const { command } = ctx;

  const handlers = {
    addon: showMainMenu,
    addon_browse: showBrowse,
    addon_cat: showCategory,
    addon_bundle: showBundle,
    addon_detail: showDetail,
    addon_manage: showManage,
    addon_install: startInstall,
    addon_update: startUpdate,
    addon_installed: showInstalled,
    addon_toggle: toggleAddon,
    addon_remove: showRemoveConfirm,
    addon_remove_confirm: confirmRemove,
    addon_status: showStatus,
  };

  const handler = handlers[command];
  if (handler) await handler(ctx);
};
