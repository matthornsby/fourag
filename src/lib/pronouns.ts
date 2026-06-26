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
 * Generates the clover summary sentence for a profile.
 *
 * When `thisYearCount` is provided and `hasPreviousYear` is true, the sentence
 * distinguishes this year's finds from the all-time total, e.g.:
 *   "He found a 5-leaf clover on Monday, June 22, has shared 25 clovers this year, and 30 since May 2024."
 * Otherwise falls back to the simple form:
 *   "He found a 5-leaf clover on Monday, June 22 and has shared 30 clovers since May."
 */
export function cloverProfileSentence(
  pref: PronounPreference,
  count: number,
  sinceStr: string,
  bestLeafCount: number,
  bestDateStr: string,
  thisYearCount?: number,
  hasPreviousYear?: boolean,
): string {
  const { subject } = getPronouns(pref)
  const haveVerb = subject === 'They' ? 'have' : 'has'
  const noun = (n: number) => n === 1 ? 'clover' : 'clovers'

  const showYearSplit = thisYearCount != null && thisYearCount > 0 && hasPreviousYear

  if (showYearSplit) {
    const yearPart = `${thisYearCount} ${noun(thisYearCount)} this year, and ${count} since ${sinceStr}`
    if (bestLeafCount > 4) {
      if (subject) return `${subject} found a ${bestLeafCount}-leaf clover on ${bestDateStr}, ${haveVerb} shared ${yearPart}.`
      return `Found a ${bestLeafCount}-leaf clover on ${bestDateStr}, shared ${yearPart}.`
    }
    if (subject) return `${subject} ${haveVerb} shared ${yearPart}.`
    return `Shared ${yearPart}.`
  }

  if (bestLeafCount > 4) {
    if (subject) return `${subject} found a ${bestLeafCount}-leaf clover on ${bestDateStr} and ${haveVerb} shared ${count} ${noun(count)} since ${sinceStr}.`
    return `Found a ${bestLeafCount}-leaf clover on ${bestDateStr} and shared ${count} ${noun(count)} since ${sinceStr}.`
  }

  if (subject) return `${subject} ${haveVerb} shared ${count} ${noun(count)} since ${sinceStr}.`
  return `Shared ${count} ${noun(count)} since ${sinceStr}.`
}
