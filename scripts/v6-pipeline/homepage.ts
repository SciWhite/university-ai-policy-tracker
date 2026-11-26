import { validateOfficialHomepage } from '../../apps/web/lib/university-homepage-validate';
import type { PublicEntitySummary } from '@uapt/shared';
import type { Batch } from './batch';

/** Homepage gaps are review inputs and never enter the public pages package. */
export function validateHomepageInput(
  input: { officialHomepage?: unknown; homepageGap?: unknown },
  batch: Pick<Batch, 'mode' | 'homepageOnly'>,
  summary: PublicEntitySummary,
) {
  const slug = summary.entity.slug;
  const { officialHomepage, homepageGap } = input;
  if (homepageGap !== undefined && (typeof homepageGap !== 'string' || !homepageGap.trim())) {
    throw Error(slug + ': homepageGap must explain why the official homepage could not be confirmed');
  }
  if (officialHomepage !== undefined) {
    if (homepageGap !== undefined) throw Error(slug + ': supply either officialHomepage or homepageGap');
    return validateOfficialHomepage(officialHomepage, slug, summary);
  }
  if (batch.homepageOnly || (batch.mode === 'add' && homepageGap === undefined)) {
    throw Error(slug + ': officialHomepage required' + (batch.homepageOnly ? '' : ' unless an explicit homepageGap is recorded'));
  }
  return undefined;
}

export function validateHomepageOnlyInput(input: Record<string, unknown>, batch: Pick<Batch, 'mode' | 'homepageOnly'>, summary: PublicEntitySummary) {
  if (Object.keys(input).some(key => key !== 'officialHomepage')) {
    throw Error(summary.entity.slug + ': homepageOnly input may contain only officialHomepage');
  }
  if (batch.mode !== 'update' || !batch.homepageOnly) throw Error('homepageOnly requires update mode');
  return validateHomepageInput(input, batch, summary)!;
}
