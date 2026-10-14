/** Response freshness is separate from an index baseline and policy-source checks. */
export function withIndexProvenance<T extends {generatedAt: string}>(
  payload: T,
  correction: {revision: string; publishedAt: string} | undefined,
  responseGeneratedAt = new Date().toISOString()
) {
  if (!correction) return payload;
  return {
    ...payload,
    baselineGeneratedAt: payload.generatedAt,
    generatedAtMeaning: 'baseline_index_generation',
    responseGeneratedAt,
    appliedRecordCorrection: {
      revision: correction.revision,
      recordedAt: correction.publishedAt,
      meaning: 'Scoped record/package revision; not a policy effective date or a new check of every source.'
    }
  };
}
