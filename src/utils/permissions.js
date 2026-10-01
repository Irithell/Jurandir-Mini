/**
 * @typedef {import('@whiskeysockets/baileys').GroupMetadata} GroupMetadata
 * @typedef {import('@whiskeysockets/baileys').WASocket} WASocket
 */

/**
 * @param {string | undefined | null} jid
 * @returns {string}
 */
export function extractId(jid) {
  if (!jid) return '';
  return jid.split('@')[0].split(':')[0].replace(/^\+/, '').trim();
}

/**
 * @param {string | undefined | null} sender
 * @param {string[]} phones
 * @returns {boolean}
 */
export function isOwner(sender, phones) {
  if (!sender || !Array.isArray(phones)) return false;
  const id = extractId(sender);
  if (!id) return false;
  return phones.some((phone) => {
    const cleanPhone = extractId(phone);
    return cleanPhone === id || phone === sender;
  });
}

/**
 * @param {string | undefined | null} sender
 * @param {GroupMetadata | undefined | null} groupMetadata
 * @returns {boolean}
 */
export function isAdmin(sender, groupMetadata) {
  if (!groupMetadata?.participants || !sender) return false;
  const id = extractId(sender);
  if (!id) return false;

  return groupMetadata.participants.some((p) => {
    const pId = extractId(p.id);
    const pAny = /** @type {any} */ (p);
    const pLid = extractId(pAny.lid);
    const pPhone = extractId(pAny.phoneNumber);
    const hasAdmin =
      p.admin === 'admin' ||
      p.admin === 'superadmin' ||
      pAny.isAdmin === true ||
      pAny.isSuperAdmin === true;

    return hasAdmin && (pId === id || (pLid && pLid === id) || (pPhone && pPhone === id));
  });
}

/**
 * @param {WASocket | undefined | null} jurandir
 * @param {GroupMetadata | undefined | null} groupMetadata
 * @returns {boolean}
 */
export function isBotAdmin(jurandir, groupMetadata) {
  if (!jurandir?.user || !groupMetadata?.participants) return false;
  const botId = extractId(jurandir.user.id);
  const userAny = /** @type {any} */ (jurandir.user);
  const botLid = extractId(userAny.lid);

  return groupMetadata.participants.some((p) => {
    const pId = extractId(p.id);
    const pAny = /** @type {any} */ (p);
    const pLid = extractId(pAny.lid);
    const pPhone = extractId(pAny.phoneNumber);
    const hasAdmin =
      p.admin === 'admin' ||
      p.admin === 'superadmin' ||
      pAny.isAdmin === true ||
      pAny.isSuperAdmin === true;

    return (
      hasAdmin &&
      ((botId && (pId === botId || pPhone === botId)) ||
        (botLid && (pLid === botLid || pId === botLid)))
    );
  });
}
