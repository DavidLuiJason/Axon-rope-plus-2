/** Analysis requirements that the current KnowledgeSlot does not expose. */
export interface AnalysisKnowledgeExtensions {
  /** Dictionary synset identifiers aligned to each sense, when available. */
  synsetIds?: string[];
  /** Source-provided lemma and morphology evidence, when available. */
  lemma?: string;
  morphologyVia?: 'exact' | 'case' | 'irregular' | 'form-index' | 'rule';
  /** Exact number of physical dictionary blocks read by a lookup. */
  blocksRead?: number;
}

export interface AnalysisSlotNeeds {
  optionalSenseSynsetIds: true;
  optionalLemmaEvidence: true;
  optionalPhysicalBlockReadCount: true;
}

export const ANALYSIS_SLOT_NEEDS: AnalysisSlotNeeds = {
  optionalSenseSynsetIds: true,
  optionalLemmaEvidence: true,
  optionalPhysicalBlockReadCount: true,
};

/**
 * Budget stand-in: KnowledgeSlot deliberately hides storage details, and neither
 * KnowledgeSlot nor Dictionary.lookup reports physical block reads. Until the
 * slot gains that metric, one distinct NFC/lowercase lookup key costs one unit.
 * This is conservative and testable, but is not a claim about physical blocks.
 */
export const ANALYSIS_BUDGET_UNIT = 'distinct-normalized-lookup-key' as const;
