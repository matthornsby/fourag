import type { PronounPreference } from '@/types'

type PronounSet = {
  subject: string | null   // They / He / She / null
  possessive: string | null // Their / His / Her / null
}

const SETS: Record<PronounPreference, PronounSet> = {
  neutral:   { subject: 'They',  possessive: 'Their' },
  masculine: { subject: 'He',    possessive: 'His'   },
  feminine:  { subject: 'She',   possessive: 'Her'   },
  none:      { subject: null,    possessive: null     },
}

export function getPronouns(pref: PronounPreference): PronounSet {
  return SETS[pref] ?? SETS.neutral
}

/** "Their luck runs out on Aug 6." / "Luck runs out on Aug 6." */
export function luckSentence(
  pref: PronounPreference,
  verb: 'ran' | 'runs',
  dateStr: string
): string {
  const { possessive } = getPronouns(pref)
  if (possessive) return `${possessive} luck ${verb} out on ${dateStr}.`
  return `Luck ${verb} out on ${dateStr}.`
}

/**
 * If bestLeafCount > 4:
 *   "They found a 5-leaf clover on Wednesday, May 15, 2024 and have shared 19 clovers since May 2024."
 * Otherwise:
 *   "They have shared 19 clovers since May 2024."
 * No-pronoun variants drop the subject and use past-participle openings.
 */
export function cloverProfileSentence(
  pref: PronounPreference,
  count: number,
  sinceStr: string,
  bestLeafCount: number,
  bestDateStr: string
): string {
  const { subject } = getPronouns(pref)
  const noun = count === 1 ? 'clover' : 'clovers'

  if (bestLeafCount > 4) {
    if (subject) {
      const haveVerb = subject === 'They' ? 'have' : 'has'
      return `${subject} found a ${bestLeafCount}-leaf clover on ${bestDateStr} and ${haveVerb} shared ${count} ${noun} since ${sinceStr}.`
    }
    return `Found a ${bestLeafCount}-leaf clover on ${bestDateStr} and shared ${count} ${noun} since ${sinceStr}.`
  }

  if (subject) {
    const haveVerb = subject === 'They' ? 'have' : 'has'
    return `${subject} ${haveVerb} shared ${count} ${noun} since ${sinceStr}.`
  }
  return `Shared ${count} ${noun} since ${sinceStr}.`
}
