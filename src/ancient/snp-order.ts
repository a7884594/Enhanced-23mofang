import {snp} from './snps';

/** Display order belongs to 23mofang. Preserve groups and aliases in encounter order. */
export function orderedSnpGroups(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(raw => {
    if (typeof raw !== 'string') return [];
    const names = raw.split('#')[0].split('%')[0].split('/').map(name => snp(name));
    // Never turn malformed groups into a different, partial group.
    return names.length && names.every(Boolean) ? [names.join('/')] : [];
  });
}
