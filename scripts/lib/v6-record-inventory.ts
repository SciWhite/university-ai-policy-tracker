import type {PublicEntitySummary} from '@uapt/shared';

/** Rebuild tracker inventory prose from the exact current record before freezing its fingerprint.
 * Does not change policy text, source identities or review state. Call during package preparation.
 */
export function currentRecordInventorySummary(record:PublicEntitySummary):string {
  const pattern=/has \d+ source-backed AI policy claim records from \d+ official source attributions/;
  if(!pattern.test(record.entity.summary??''))throw Error(`Unknown inventory-summary format: ${record.entity.slug}`);
  return record.entity.summary!.replace(pattern,
    `has ${record.claims.length} source-backed AI policy claim records from ${record.officialSources.length} official source attributions`);
}
