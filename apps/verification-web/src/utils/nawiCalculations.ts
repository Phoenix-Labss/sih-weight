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

export interface NAWIInstrumentSpec {
  accuracy_class?: 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | 'CLASS_IIII' | string;
  verification_scale_interval_e?: number | string;
  max_capacity?: number | string;
  min_capacity?: number | string;
  unit_of_measure?: string;
}

export interface StatutoryObservationItem {
  step_type: 'ZERO_TEST' | 'INCREASING_LOAD' | 'DECREASING_LOAD' | 'ECCENTRICITY' | 'REPEATABILITY' | 'TARE_TEST';
  step_sequence: number;
  nominal_load: number;
  load_unit?: string;
  raw_indication_reading: number;
  reading_unit?: string;
  normalized_indication?: number;
  repetition_index?: number;
  eccentricity_position?: string;
  delta_L?: number;
}

/**
 * Generates statutory NAWI test points dynamically tailored to the exact
 * Accuracy Class (Class I, II, III, IIII), capacity, and scale interval (e)
 * as mandated by Schedule VII of Legal Metrology (General) Rules, 2011.
 */
export function generateStatutoryNAWITestSteps(spec?: NAWIInstrumentSpec | null): StatutoryObservationItem[] {
  const accuracyClass = (spec?.accuracy_class as any) || 'CLASS_III';
  const e = Number(spec?.verification_scale_interval_e) || 0.005;
  const maxCap = Number(spec?.max_capacity) || 30.0;
  const minCap = Number(spec?.min_capacity) || (
    accuracyClass === 'CLASS_I' ? 100 * e :
    accuracyClass === 'CLASS_II' ? 50 * e :
    accuracyClass === 'CLASS_III' ? 20 * e : 10 * e
  );
  const unit = spec?.unit_of_measure || 'kg';

  const decimals = e.toString().includes('.') ? Math.min(e.toString().split('.')[1].length + 1, 6) : 4;
  const roundE = (val: number) => {
    if (e <= 0) return Number(val.toFixed(decimals));
    const factor = Math.round(val / e);
    return Number((factor * e).toFixed(decimals));
  };

  const deltaL = Number((0.5 * e).toFixed(decimals));

  // Determine stepped transition points in terms of scale interval e
  let step1Load: number;
  let step2Load: number;

  if (accuracyClass === 'CLASS_I') {
    step1Load = Math.min(roundE(50000 * e), roundE(maxCap * 0.25));
    step2Load = Math.min(roundE(200000 * e), roundE(maxCap * 0.5));
  } else if (accuracyClass === 'CLASS_II') {
    step1Load = Math.min(roundE(5000 * e), roundE(maxCap * 0.25));
    step2Load = Math.min(roundE(20000 * e), roundE(maxCap * 0.5));
  } else if (accuracyClass === 'CLASS_IIII') {
    step1Load = Math.min(roundE(50 * e), roundE(maxCap * 0.25));
    step2Load = Math.min(roundE(200 * e), roundE(maxCap * 0.5));
  } else {
    // CLASS_III
    step1Load = Math.min(roundE(500 * e), roundE(maxCap * 0.25));
    step2Load = Math.min(roundE(2000 * e), roundE(maxCap * 0.5));
  }

  // Ensure strictly ordered positive stepped loads: minCap < step1Load < step2Load < maxCap
  if (step1Load <= minCap) step1Load = roundE(minCap + (maxCap - minCap) * 0.25);
  if (step2Load <= step1Load) step2Load = roundE(minCap + (maxCap - minCap) * 0.6);
  if (step2Load >= maxCap) step2Load = roundE(maxCap * 0.75);

  const eccLoad = roundE(maxCap / 3);
  const repLoad = roundE(maxCap * 0.8);

  return [
    // 1. Zero test
    {
      step_type: 'ZERO_TEST',
      step_sequence: 1,
      nominal_load: 0.0,
      raw_indication_reading: 0.0,
      load_unit: unit,
      reading_unit: unit,
      delta_L: deltaL,
    },
    // 2. Increasing loads (Min, Step 1 Transition, Step 2 Transition, Max)
    {
      step_type: 'INCREASING_LOAD',
      step_sequence: 2,
      nominal_load: roundE(minCap),
      raw_indication_reading: roundE(minCap),
      load_unit: unit,
      reading_unit: unit,
      delta_L: deltaL,
    },
    {
      step_type: 'INCREASING_LOAD',
      step_sequence: 3,
      nominal_load: step1Load,
      raw_indication_reading: step1Load,
      load_unit: unit,
      reading_unit: unit,
      delta_L: deltaL,
    },
    {
      step_type: 'INCREASING_LOAD',
      step_sequence: 4,
      nominal_load: step2Load,
      raw_indication_reading: step2Load,
      load_unit: unit,
      reading_unit: unit,
      delta_L: deltaL,
    },
    {
      step_type: 'INCREASING_LOAD',
      step_sequence: 5,
      nominal_load: roundE(maxCap),
      raw_indication_reading: roundE(maxCap),
      load_unit: unit,
      reading_unit: unit,
      delta_L: deltaL,
    },
    // 3. Eccentricity 5 positions (1/3 Max)
    {
      step_type: 'ECCENTRICITY',
      step_sequence: 6,
      nominal_load: eccLoad,
      raw_indication_reading: eccLoad,
      eccentricity_position: 'CENTER',
      load_unit: unit,
      reading_unit: unit,
      delta_L: deltaL,
    },
    {
      step_type: 'ECCENTRICITY',
      step_sequence: 7,
      nominal_load: eccLoad,
      raw_indication_reading: eccLoad,
      eccentricity_position: 'FRONT_LEFT',
      load_unit: unit,
      reading_unit: unit,
      delta_L: deltaL,
    },
    {
      step_type: 'ECCENTRICITY',
      step_sequence: 8,
      nominal_load: eccLoad,
      raw_indication_reading: eccLoad,
      eccentricity_position: 'BACK_LEFT',
      load_unit: unit,
      reading_unit: unit,
      delta_L: deltaL,
    },
    {
      step_type: 'ECCENTRICITY',
      step_sequence: 9,
      nominal_load: eccLoad,
      raw_indication_reading: eccLoad,
      eccentricity_position: 'BACK_RIGHT',
      load_unit: unit,
      reading_unit: unit,
      delta_L: deltaL,
    },
    {
      step_type: 'ECCENTRICITY',
      step_sequence: 10,
      nominal_load: eccLoad,
      raw_indication_reading: eccLoad,
      eccentricity_position: 'FRONT_RIGHT',
      load_unit: unit,
      reading_unit: unit,
      delta_L: deltaL,
    },
    // 4. Repeatability (3 consecutive applications at ~0.8 Max)
    {
      step_type: 'REPEATABILITY',
      step_sequence: 11,
      nominal_load: repLoad,
      raw_indication_reading: repLoad,
      repetition_index: 1,
      load_unit: unit,
      reading_unit: unit,
      delta_L: deltaL,
    },
    {
      step_type: 'REPEATABILITY',
      step_sequence: 12,
      nominal_load: repLoad,
      raw_indication_reading: repLoad,
      repetition_index: 2,
      load_unit: unit,
      reading_unit: unit,
      delta_L: deltaL,
    },
    {
      step_type: 'REPEATABILITY',
      step_sequence: 13,
      nominal_load: repLoad,
      raw_indication_reading: repLoad,
      repetition_index: 3,
      load_unit: unit,
      reading_unit: unit,
      delta_L: deltaL,
    },
  ];
}

