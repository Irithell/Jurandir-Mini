/**
 * @typedef {import('@whiskeysockets/baileys').GroupMetadata} GroupMetadata
 */

/**
 * @param {string} jid
 * @returns {string}
 */
function extractId(jid) {
  return jid.split('@')[0];
}

/**
 * @param {string} sender
 * @param {string[]} phones
 * @returns {boolean}
 */
export function isOwner(sender, phones) {
  const id = extractId(sender);
  return phones.some((phone) => extractId(phone) === id);
}

/**
 * @param {string} sender
 * @param {GroupMetadata | undefined} groupMetadata
 * @returns {boolean}
 */
export function isAdmin(sender, groupMetadata) {
  if (!groupMetadata?.participants) return false;
  const id = extractId(sender);
  return groupMetadata.participants.some(
    (p) => (extractId(p.id) === id || extractId(p.phoneNumber ?? '') === id) && p.admin !== null
  );
}
