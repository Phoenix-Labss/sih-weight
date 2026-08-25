/**
 * Legal Metrology NAWI (Non-Automatic Weighing Instruments)
 * Deterministic Calculation and MPE Evaluation Helper.
 * Follows Legal Metrology (General) Rules, 2011 & OIML R 76-1.
 */

export interface NAWICalculationInput {
  nominalLoad: number; // L
  rawIndication: number; // I
  deltaL?: number; // delta L (small weights added until next turnover point)
  scaleIntervalE: number; // e (e.g. 0.005 kg)
  accuracyClass: 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | 'CLASS_IIII';
  zeroErrorE0?: number; // E_0 from zero load test
  isInitialVerification?: boolean;
}

export interface NAWICalculationResult {
  nominalLoad: number;
  rawIndication: number;
  normalizedIndication: number; // P = I + 0.5e - delta_L
  observedError: number; // E = P - L
  correctedError: number; // E_c = E - E_0
  mpeAllowed: number; // Maximum Permissible Error (+/- MPE)
  isWithinMpe: boolean;
  mIntervals: number; // m = L / e
  calculationTrace: {
    formula: string;
    P: number;
    E: number;
    E_c: number;
    MPE: number;
    delta_L: number;
    zero_error_applied: number;
  };
}

/**
 * Calculates statutory Maximum Permissible Error (MPE) for NAWI Class III / IIII.
 * For Class III (Medium Accuracy):
 * 0 <= m <= 500: +/- 0.5e (or 1.0e initial)
 * 500 < m <= 2000: +/- 1.0e (or 2.0e)
 * 2000 < m <= 10000: +/- 1.5e (or 3.0e)
 */
export function calculateMpe(
  load: number,
  e: number,
  accuracyClass: 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | 'CLASS_IIII' = 'CLASS_III',
  isInitialVerification = true
): number {
  if (e <= 0) return 0.001;
  const m = load / e;

  let multiplier = 1.0;
  if (accuracyClass === 'CLASS_III') {
    if (m <= 500) {
      multiplier = 1.0;
    } else if (m <= 2000) {
      multiplier = 2.0;
    } else {
      multiplier = 3.0;
    }
  } else if (accuracyClass === 'CLASS_IIII') {
    if (m <= 50) {
      multiplier = 1.0;
    } else if (m <= 200) {
      multiplier = 2.0;
    } else {
      multiplier = 3.0;
    }
  } else if (accuracyClass === 'CLASS_II') {
    if (m <= 5000) {
      multiplier = 1.0;
    } else if (m <= 20000) {
      multiplier = 2.0;
    } else {
      multiplier = 3.0;
    }
  } else {
    // CLASS_I
    if (m <= 50000) {
      multiplier = 1.0;
    } else if (m <= 200000) {
      multiplier = 2.0;
    } else {
      multiplier = 3.0;
    }
  }

  // If in-service verification, MPE is double initial verification in some rules,
  // but standard initial/statutory pack uses factor * e
  const factor = isInitialVerification ? multiplier : multiplier * 1.0;
  const rawMpe = factor * e;
  return Number(rawMpe.toFixed(6));
}

/**
 * Evaluates single NAWI test reading with turning point continuous error.
 */
export function evaluateNAWIObservation(input: NAWICalculationInput): NAWICalculationResult {
  const {
    nominalLoad,
    rawIndication,
    scaleIntervalE,
    accuracyClass,
    zeroErrorE0 = 0,
    isInitialVerification = true,
  } = input;

  const deltaL = input.deltaL !== undefined ? input.deltaL : 0.5 * scaleIntervalE;
  
  // Continuous indicated value P = I + 0.5e - delta_L
  const P = rawIndication + 0.5 * scaleIntervalE - deltaL;
  
  // Observed error E = P - L
  const E = P - nominalLoad;

  // Corrected error E_c = E - E_0
  const Ec = E - zeroErrorE0;

  const mpe = calculateMpe(nominalLoad, scaleIntervalE, accuracyClass, isInitialVerification);
  
  // Evaluation against |E_c| <= MPE
  const roundedEc = Number(Ec.toFixed(6));
  const isWithinMpe = Math.abs(roundedEc) <= mpe + 0.0000001;
  const mIntervals = scaleIntervalE > 0 ? Number((nominalLoad / scaleIntervalE).toFixed(2)) : 0;

  return {
    nominalLoad,
    rawIndication,
    normalizedIndication: Number(P.toFixed(6)),
    observedError: Number(E.toFixed(6)),
    correctedError: roundedEc,
    mpeAllowed: mpe,
    isWithinMpe,
    mIntervals,
    calculationTrace: {
      formula: 'E_c = (I + 0.5e - ΔL - L) - E_0',
      P: Number(P.toFixed(6)),
      E: Number(E.toFixed(6)),
      E_c: roundedEc,
      MPE: mpe,
      delta_L: deltaL,
      zero_error_applied: zeroErrorE0,
    },
  };
}

/**
 * Evaluates 5-position eccentricity test spread.
 */
export function evaluateEccentricityTest(
  readings: { position: string; rawIndication: number; deltaL?: number }[],
  nominalLoad: number,
  scaleIntervalE: number,
  accuracyClass: 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | 'CLASS_IIII' = 'CLASS_III'
): {
  maxError: number;
  mpeAllowed: number;
  passed: boolean;
  evaluatedReadings: Array<NAWICalculationResult & { position: string }>;
} {
  const mpe = calculateMpe(nominalLoad, scaleIntervalE, accuracyClass, true);
  let maxError = 0;
  let allPass = true;

  const evaluated = readings.map((r) => {
    const res = evaluateNAWIObservation({
      nominalLoad,
      rawIndication: r.rawIndication,
      deltaL: r.deltaL,
      scaleIntervalE,
      accuracyClass,
      zeroErrorE0: 0,
    });
    if (Math.abs(res.correctedError) > maxError) {
      maxError = Math.abs(res.correctedError);
    }
    if (!res.isWithinMpe) {
      allPass = false;
    }
    return {
      ...res,
      position: r.position,
    };
  });

  return {
    maxError: Number(maxError.toFixed(6)),
    mpeAllowed: mpe,
    passed: allPass,
    evaluatedReadings: evaluated,
  };
}

/**
 * Evaluates repeatability test (max indication - min indication <= MPE).
 */
export function evaluateRepeatabilityTest(
  readings: number[],
  nominalLoad: number,
  scaleIntervalE: number,
  accuracyClass: 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | 'CLASS_IIII' = 'CLASS_III'
): {
  spread: number;
  mpeAllowed: number;
  passed: boolean;
} {
  if (readings.length === 0) return { spread: 0, mpeAllowed: 0, passed: true };
  const min = Math.min(...readings);
  const max = Math.max(...readings);
  const spread = Number((max - min).toFixed(6));
  const mpe = calculateMpe(nominalLoad, scaleIntervalE, accuracyClass, true);
  return {
    spread,
    mpeAllowed: mpe,
    passed: spread <= mpe + 0.0000001,
  };
}
