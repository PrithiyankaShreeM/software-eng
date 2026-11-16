import { Rubric, RubricConcept } from '../types/erp';

export interface ConceptEvaluationResult {
  concept: RubricConcept;
  matched: boolean;
  matchedKeywords: string[];
  awardedPoints: number;
}

export interface RubricEvaluationOutput {
  suggestedMarks: number;
  maxMarks: number;
  matchedConcepts: string[];
  missingConcepts: string[];
  conceptBreakdown: ConceptEvaluationResult[];
  coveragePct: number;
  allMatchedKeywords: string[];
}

/**
 * Deterministic rule-based rubric evaluator.
 * Matches normalized keywords/phrases per rubric concept.
 * Explicitly non-ML: intended strictly as rule-based examiner assistance.
 */
export function evaluateAnswerWithRubric(
  answerText: string,
  rubric: Rubric | undefined
): RubricEvaluationOutput {
  if (!rubric) {
    return {
      suggestedMarks: 0,
      maxMarks: 15,
      matchedConcepts: [],
      missingConcepts: [],
      conceptBreakdown: [],
      coveragePct: 0,
      allMatchedKeywords: [],
    };
  }

  const normalizedAnswer = answerText.toLowerCase();
  const conceptBreakdown: ConceptEvaluationResult[] = [];
  const matchedConcepts: string[] = [];
  const missingConcepts: string[] = [];
  const allMatchedKeywords = new Set<string>();

  let totalSuggested = 0;

  for (const concept of rubric.concepts) {
    const matchedKeywords = concept.keywords.filter((kw) =>
      normalizedAnswer.includes(kw.toLowerCase())
    );

    // Deterministic threshold: matching at least 1 concept keyword satisfies partial/full concept rule;
    // matching >= 2 keywords (or all keywords when concept has 1 keyword) awards full concept points,
    // matching 1 of multiple keywords awards 50% rounded to nearest 0.5.
    let awardedPoints = 0;
    const isMatched = matchedKeywords.length > 0;

    if (isMatched) {
      matchedKeywords.forEach((k) => allMatchedKeywords.add(k));
      if (matchedKeywords.length >= 2 || concept.keywords.length === 1) {
        awardedPoints = concept.maxPoints;
      } else {
        awardedPoints = Math.round(concept.maxPoints * 0.5 * 2) / 2;
      }
      matchedConcepts.push(concept.title);
    } else {
      missingConcepts.push(concept.title);
    }

    totalSuggested += awardedPoints;
    conceptBreakdown.push({
      concept,
      matched: isMatched,
      matchedKeywords,
      awardedPoints,
    });
  }

  const bounded = Math.min(rubric.maxMarks, Math.round(totalSuggested * 2) / 2);
  const coveragePct =
    rubric.concepts.length > 0
      ? Math.round((matchedConcepts.length / rubric.concepts.length) * 100)
      : 0;

  return {
    suggestedMarks: bounded,
    maxMarks: rubric.maxMarks,
    matchedConcepts,
    missingConcepts,
    conceptBreakdown,
    coveragePct,
    allMatchedKeywords: Array.from(allMatchedKeywords),
  };
}

export interface ModerationPriorityBreakdown {
  score: number;
  level: 'Low' | 'Medium' | 'High';
  factors: string[];
}

/**
 * Deterministic Moderation Priority Index (0–100).
 * Strictly rule-based arithmetic index — NOT a calibrated AI confidence probability.
 */
export function calculateModerationPriority(params: {
  suggestedMarks: number;
  finalMarks: number | null;
  maxMarks: number;
  subjectCode: string;
  examinerId: string;
  cs304DualModerationActive: boolean;
  missingConceptCount: number;
  totalConceptCount: number;
}): ModerationPriorityBreakdown {
  const {
    suggestedMarks,
    finalMarks,
    maxMarks,
    subjectCode,
    examinerId,
    cs304DualModerationActive,
    missingConceptCount,
    totalConceptCount,
  } = params;

  if (finalMarks === null) {
    return {
      score: 0,
      level: 'Low',
      factors: ['Awaiting examiner evaluation'],
    };
  }

  const factors: string[] = [];
  const diff = Math.abs(finalMarks - suggestedMarks);
  const diffPct = maxMarks > 0 ? (diff / maxMarks) * 100 : 0;

  // Component 1: Mark divergence vs rule-based baseline (up to 55 pts)
  const diffComponent = Math.min(55, Math.round(diffPct * 1.4));
  if (diff > 0) {
    factors.push(
      `Mark delta of ${diff.toFixed(1)}/${maxMarks} (${diffPct.toFixed(0)}%) contributed +${diffComponent} pts`
    );
  } else {
    factors.push('Exact alignment with rule-based suggestion (+0 pts)');
  }

  // Component 2: High marks awarded despite missing rubric concepts (up to 25 pts)
  let coverageComponent = 0;
  if (totalConceptCount > 0 && finalMarks > suggestedMarks) {
    const missingRatio = missingConceptCount / totalConceptCount;
    coverageComponent = Math.min(25, Math.round(missingRatio * 30));
    if (coverageComponent > 0) {
      factors.push(
        `Awarded above baseline despite ${missingConceptCount}/${totalConceptCount} missing concepts (+${coverageComponent} pts)`
      );
    }
  }

  // Component 3: Subject/Examiner historical inconsistency watch (Task 6) (up to 25 pts)
  let historicalComponent = 0;
  if (subjectCode === 'CS304' && (cs304DualModerationActive || examinerId === 'EXM-112')) {
    historicalComponent = cs304DualModerationActive ? 25 : 18;
    factors.push(
      `Subject CS304 historical variance watch (${examinerId}) (+${historicalComponent} pts)`
    );
  }

  const score = Math.min(100, diffComponent + coverageComponent + historicalComponent);
  const level: 'Low' | 'Medium' | 'High' =
    score >= 65 ? 'High' : score >= 30 ? 'Medium' : 'Low';

  return { score, level, factors };
}

export interface TextSegment {
  text: string;
  highlighted: boolean;
}

export function highlightMatchedKeywords(
  text: string,
  keywords: string[]
): TextSegment[] {
  if (!keywords.length) {
    return [{ text, highlighted: false }];
  }

  const escaped = keywords
    .filter((k) => k.trim().length > 0)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (!escaped.length) {
    return [{ text, highlighted: false }];
  }

  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  const lowerSet = new Set(keywords.map((k) => k.toLowerCase()));

  return parts
    .filter((p) => p.length > 0)
    .map((part) => ({
      text: part,
      highlighted: lowerSet.has(part.toLowerCase()),
    }));
}

export function formatExamDuration(minutes: number): string {
  const mins = Math.max(0, Math.round(minutes));
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs === 0) return `${mins} mins`;
  if (rem === 0) return `${mins} mins (${hrs} ${hrs === 1 ? 'hr' : 'hrs'})`;
  return `${mins} mins (${hrs} ${hrs === 1 ? 'hr' : 'hrs'} ${rem} mins)`;
}
