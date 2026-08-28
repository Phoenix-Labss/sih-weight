import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Application } from '../../types/application';
import { Instrument } from '../../types/instrument';
import { VerificationSession } from '../../types/session';
import { Certificate } from '../../types/certificate';
import { api } from '../../api/client';
import { mockDb } from '../../api/mock/mockService';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useApiMode } from '../../context/ApiModeContext';
import { ScrutinyQueue } from '../officer/ScrutinyQueue';
import { TestObservationGrid } from '../officer/TestObservationGrid';
import { CertificateModal } from '../trader/CertificateModal';
import { WorksheetModal } from '../officer/WorksheetModal';
import { StatusBadge } from '../common/StatusBadge';
import { truncateHash } from '../../utils/formatters';
import {
  Scale,
  Award,
  ShieldCheck,
  Building2,
  Lock,
  Calendar,
  CheckCircle2,
  FileCheck2,
  Microscope,
  Layers,
  Search,
  Gauge,
  Thermometer,
  Ruler,
  Droplets,
  Car,
  Wind,
} from 'lucide-react';

interface GATCCentre {
  gatcId: string;
  facilityName: string;
  approvalOrderNumber: string;
  validFrom: string;
  validTo: string;
  maxCapacityKg: number;
  approvedClasses: string[];
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
}

export interface WorkingStandard {
  standardId: string;
  category: 'mass' | 'volume' | 'length' | 'pressure' | 'temperature' | 'taxi' | 'flow';
  categoryLabel: string;
  description: string;
  accuracyClass: string;
  nominalValue: string;
  calibrationCertificate: string;
  calibratedBy: string;
  calibrationDate: string;
  validUntil: string;
  expandedUncertainty: string;
  status: 'ACTIVE' | 'DUE_CALIBRATION' | 'EXPIRED';
  applicableInstruments: string;
}

const mockGATCCentres: GATCCentre[] = [
  {
    gatcId: 'gatc-001',
    facilityName: 'Apex Metrology Calibration Lab Pvt Ltd',
    approvalOrderNumber: 'GATC/MH/2024/014',
    validFrom: '2024-01-01',
    validTo: '2027-12-31',
    maxCapacityKg: 50000,
    approvedClasses: ['Class II', 'Class III', 'Class IIII'],
    status: 'ACTIVE',
  },
  {
    gatcId: 'gatc-002',
    facilityName: 'National Precision Testing Services',
    approvalOrderNumber: 'GATC/MH/2025/008',
    validFrom: '2025-06-01',
    validTo: '2028-05-31',
    maxCapacityKg: 1000,
    approvedClasses: ['Class II', 'Class III'],
    status: 'ACTIVE',
  },
];

export const allStatutoryWorkingStandards: WorkingStandard[] = [
  // 1. Mass Standards (E1, E2, F1, F2, M1, M2)
  {
    standardId: 'STD-GATC-E1-01',
    category: 'mass',
    categoryLabel: 'Mass & Weighing',
    description: 'E1 Ultra-Precision Primary Reference Weight Set (1 mg to 200 g)',
    accuracyClass: 'OIML E1 / Class I',
    nominalValue: '1 mg - 200 g (25 pcs, Austenitic SS)',
    calibrationCertificate: 'NPLI-MASS-CAL-2026-0012',
    calibratedBy: 'National Physical Laboratory (NPL India)',
    calibrationDate: '2026-01-15',
    validUntil: '2028-01-14',
    expandedUncertainty: 'U = 0.002 mg (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Micro balances, Ultra-micro balances, Analytical mass comparators',
  },
  {
    standardId: 'STD-GATC-E2-02',
    category: 'mass',
    categoryLabel: 'Mass & Weighing',
    description: 'E2 High-Precision Analytical Reference Weights (1 g to 500 g)',
    accuracyClass: 'OIML E2 / Class I & II',
    nominalValue: '1 g - 500 g (12 pcs)',
    calibrationCertificate: 'NPLI-CAL-2026-0041',
    calibratedBy: 'National Physical Laboratory (NPL India)',
    calibrationDate: '2026-02-28',
    validUntil: '2028-02-28',
    expandedUncertainty: 'U = 0.01 mg (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Class I & Class II Precision Lab Balances, Moisture Analyzers',
  },
  {
    standardId: 'STD-GATC-F1-03',
    category: 'mass',
    categoryLabel: 'Mass & Weighing',
    description: 'F1 Precision Stainless Steel Mass Set (1 mg to 10 kg)',
    accuracyClass: 'OIML F1 / Class II',
    nominalValue: '1 mg - 10 kg (28 pcs, High-Grade Non-Magnetic SS)',
    calibrationCertificate: 'NPL/RRSL-CAL-2025-8891',
    calibratedBy: 'Regional Reference Standard Laboratory (RRSL Ahmedabad)',
    calibrationDate: '2025-07-01',
    validUntil: '2027-06-30',
    expandedUncertainty: 'U = 0.05 mg to 0.5 mg (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Class II High Accuracy Balances, Gold / Jewellery Scales',
  },
  {
    standardId: 'STD-GATC-F2-04',
    category: 'mass',
    categoryLabel: 'Mass & Weighing',
    description: 'F2 Secondary Working Mass Set (1 g to 20 kg)',
    accuracyClass: 'OIML F2 / Class II',
    nominalValue: '1 g - 20 kg (Brass & Stainless Steel Weights)',
    calibrationCertificate: 'RRSL-FBD-CAL-2025-3319',
    calibratedBy: 'RRSL Faridabad Standards Division',
    calibrationDate: '2025-09-10',
    validUntil: '2027-09-09',
    expandedUncertainty: 'U = 0.2 mg to 2.0 mg (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Class II Precision Bench Scales, Industrial Batching Scales',
  },
  {
    standardId: 'STD-GATC-M1-05',
    category: 'mass',
    categoryLabel: 'Mass & Weighing',
    description: 'M1 Working Standard Cast Iron Hexagonal Weights (100 g to 50 kg)',
    accuracyClass: 'OIML M1 / Class III',
    nominalValue: '100 g - 50 kg (Standard Commercial Test Weights)',
    calibrationCertificate: 'RRSL-DEL-2025-1042',
    calibratedBy: 'RRSL Delhi Standards Division',
    calibrationDate: '2026-01-01',
    validUntil: '2027-12-31',
    expandedUncertainty: 'U = 5 mg to 50 mg (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Class III Commercial Scales, Retail Counter Scales, Platform Scales',
  },
  {
    standardId: 'STD-GATC-M1-06',
    category: 'mass',
    categoryLabel: 'Mass & Weighing',
    description: 'M1 Heavy Cast Iron Calibration Block (20 kg x 50 units)',
    accuracyClass: 'OIML M1 / Class III',
    nominalValue: '1,000 kg Total (50 x 20 kg Stackable Grip Blocks)',
    calibrationCertificate: 'RRSL-BLR-2025-9921',
    calibratedBy: 'RRSL Bangalore Standards Division',
    calibrationDate: '2025-06-15',
    validUntil: '2027-06-14',
    expandedUncertainty: 'U = 1.0 g per 20 kg (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Medium Industrial Platform Scales, Tank / Hopper Scales',
  },
  {
    standardId: 'STD-GATC-M1-07',
    category: 'mass',
    categoryLabel: 'Mass & Weighing',
    description: 'M1 Heavy Test Mass Block Set for Weighbridges (500 kg x 40 units)',
    accuracyClass: 'OIML M1 / Class III',
    nominalValue: '20,000 kg Total (500 kg Forklift-Compatible Block Weights)',
    calibrationCertificate: 'RRSL-BBS-2025-7740',
    calibratedBy: 'RRSL Bhubaneswar Standards Division',
    calibrationDate: '2025-11-20',
    validUntil: '2027-11-19',
    expandedUncertainty: 'U = 25 g per 500 kg block (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Electronic Truck Weighbridges, Axle Weighers, Silo Weighing Systems',
  },
  {
    standardId: 'STD-GATC-M2-08',
    category: 'mass',
    categoryLabel: 'Mass & Weighing',
    description: 'M2 Industrial Calibration Weights (50 kg x 20 units)',
    accuracyClass: 'OIML M2 / Class IIII',
    nominalValue: '1,000 kg Total (Heavy Cast Iron Rectangular Units)',
    calibrationCertificate: 'RRSL-DEL-2025-4412',
    calibratedBy: 'RRSL Delhi Standards Division',
    calibrationDate: '2025-10-05',
    validUntil: '2027-10-04',
    expandedUncertainty: 'U = 5.0 g per 50 kg (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Class IIII Heavy Industrial Scales, Crane Weighers, Hanging Scales',
  },

  // 2. Volume & Liquid Petroleum Provers
  {
    standardId: 'STD-GATC-VOL-01',
    category: 'volume',
    categoryLabel: 'Volume & Capacity',
    description: 'Working Standard Conical Capacity Measures Set (1 L, 2 L, 5 L)',
    accuracyClass: 'OIML R120 / Class 0.2',
    nominalValue: '1 L to 5 L Stainless Steel Graduated Measures',
    calibrationCertificate: 'RRSL-DEL-VOL-2025-108',
    calibratedBy: 'RRSL Delhi Volume Calibration Section',
    calibrationDate: '2025-08-12',
    validUntil: '2027-08-11',
    expandedUncertainty: 'U = 0.05% of nominal volume (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Liquid Milk Measures, Edible Oil Dispensers, Commercial Liquid Measures',
  },
  {
    standardId: 'STD-GATC-VOL-02',
    category: 'volume',
    categoryLabel: 'Volume & Capacity',
    description: 'Working Standard Conical Prover with Sight Glass & Vernier Scale (10 L & 20 L)',
    accuracyClass: 'OIML R117 / Class 0.1',
    nominalValue: '10 L and 20 L Graduated Neck Mobile Provers',
    calibrationCertificate: 'RRSL-FBD-VOL-2025-992',
    calibratedBy: 'RRSL Faridabad Flow Metrology Lab',
    calibrationDate: '2025-06-20',
    validUntil: '2027-06-19',
    expandedUncertainty: 'U = 0.02% of nominal volume (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Retail Petroleum Dispensing Units (Petrol & Diesel Pumps), LPG Dispensers',
  },
  {
    standardId: 'STD-GATC-VOL-03',
    category: 'volume',
    categoryLabel: 'Volume & Capacity',
    description: 'Medium-Capacity Flow Prover with Level Gauges (50 L & 100 L)',
    accuracyClass: 'OIML R117 / Class 0.1',
    nominalValue: '50 L - 100 L Stainless Steel Delivery Provers',
    calibrationCertificate: 'RRSL-AMD-VOL-2025-410',
    calibratedBy: 'RRSL Ahmedabad Volume Laboratory',
    calibrationDate: '2025-09-18',
    validUntil: '2027-09-17',
    expandedUncertainty: 'U = 0.03% (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'High-Flow Industrial Diesel Dispensers, Chemical Flowmeters',
  },
  {
    standardId: 'STD-GATC-VOL-04',
    category: 'volume',
    categoryLabel: 'Volume & Capacity',
    description: 'High-Capacity Master Meter Prover Unit (500 L & 1,000 L)',
    accuracyClass: 'OIML R117 / R120',
    nominalValue: '500 L & 1,000 L Mobile Trailer Mounted Prover Tank',
    calibrationCertificate: 'NPLI-VOL-CAL-2025-0089',
    calibratedBy: 'NPL India Fluid Flow Metrology Division',
    calibrationDate: '2025-04-10',
    validUntil: '2027-04-09',
    expandedUncertainty: 'U = 0.05% (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Oil Depot Gantry Flowmeters, Tank Lorry Bulk Compartments, Bunkering Meters',
  },

  // 3. Length & Dimensional Standards
  {
    standardId: 'STD-GATC-LEN-01',
    category: 'length',
    categoryLabel: 'Length & Dimension',
    description: 'Working Standard Rigid Meter Bar with Microscope Reference (1 m)',
    accuracyClass: 'Class I / OIML R35',
    nominalValue: '1 m Invar Steel Precision Scale with Sub-Millimeter Graduations',
    calibrationCertificate: 'NPLI-LEN-2025-0034',
    calibratedBy: 'National Physical Laboratory (NPL India)',
    calibrationDate: '2025-05-14',
    validUntil: '2028-05-13',
    expandedUncertainty: 'U = 2.5 µm (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Rigid Meter Bars, Counter Yardsticks, Fabric Measuring Machines',
  },
  {
    standardId: 'STD-GATC-LEN-02',
    category: 'length',
    categoryLabel: 'Length & Dimension',
    description: 'Certified Precision Steel Measuring Tape Standard Bench (5 m, 30 m, 50 m)',
    accuracyClass: 'Class I / OIML R35',
    nominalValue: '5 m, 30 m, 50 m Standard Steel Tapes with 50N Tension Rig',
    calibrationCertificate: 'RRSL-DEL-LEN-2025-882',
    calibratedBy: 'RRSL Delhi Dimensional Metrology Section',
    calibrationDate: '2025-08-01',
    validUntil: '2027-07-31',
    expandedUncertainty: 'U = (10 + 5L) µm (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Surveyor Steel Tapes, Tank Dipping Tapes, Woven Measuring Tapes',
  },
  {
    standardId: 'STD-GATC-LEN-03',
    category: 'length',
    categoryLabel: 'Length & Dimension',
    description: 'Precision Gauge Block Set Grade 0 (83 pcs, 0.5 mm to 100 mm)',
    accuracyClass: 'Grade 0 / ISO 3650',
    nominalValue: '0.5 mm - 100 mm Tungsten Carbide & Ceramic Blocks',
    calibrationCertificate: 'NPLI-DIM-CAL-2026-005',
    calibratedBy: 'National Physical Laboratory (NPL India)',
    calibrationDate: '2026-01-20',
    validUntil: '2028-01-19',
    expandedUncertainty: 'U = 0.05 µm to 0.12 µm (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Micrometers, Vernier Calipers, Height Gauges, Wire & Sheet Thickness Gauges',
  },

  // 4. Pressure, Force & Medical Metrology
  {
    standardId: 'STD-GATC-PRS-01',
    category: 'pressure',
    categoryLabel: 'Pressure & Force',
    description: 'Digital Deadweight Tester & Working Master Pressure Standard (0 to 700 bar)',
    accuracyClass: 'Class 0.015 / OIML R109',
    nominalValue: '0 - 700 bar (0 - 10,000 psi) Hydraulic Deadweight Reference',
    calibrationCertificate: 'NPLI-PRS-CAL-2025-0199',
    calibratedBy: 'National Physical Laboratory (NPL India)',
    calibrationDate: '2025-03-15',
    validUntil: '2027-03-14',
    expandedUncertainty: 'U = 0.015% of reading (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Industrial Pressure Gauges, Boiler Gauges, Hydraulic Load Cells',
  },
  {
    standardId: 'STD-GATC-PRS-02',
    category: 'pressure',
    categoryLabel: 'Pressure & Force',
    description: 'Working Standard Digital Sphygmomanometer & Pressure Calibrator (0 to 300 mmHg)',
    accuracyClass: 'OIML R16-1 / R16-2',
    nominalValue: '0 - 300 mmHg High-Precision Pneumatic Simulator',
    calibrationCertificate: 'RRSL-FBD-PRS-2025-667',
    calibratedBy: 'RRSL Faridabad Medical Metrology Division',
    calibrationDate: '2025-10-12',
    validUntil: '2027-10-11',
    expandedUncertainty: 'U = 0.2 mmHg (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Clinical Blood Pressure Monitors, Mercury & Aneroid Sphygmomanometers',
  },
  {
    standardId: 'STD-GATC-PRS-03',
    category: 'pressure',
    categoryLabel: 'Pressure & Force',
    description: 'Master Tyre Pressure Gauge Indicator & Calibrator (0 to 150 psi / 10 bar)',
    accuracyClass: 'OIML R23 / Class 0.5',
    nominalValue: '0 - 150 psi (0 - 10 bar) Master Digital Pressure Standard',
    calibrationCertificate: 'RRSL-DEL-PRS-2025-331',
    calibratedBy: 'RRSL Delhi Standards Division',
    calibrationDate: '2025-07-22',
    validUntil: '2027-07-21',
    expandedUncertainty: 'U = 0.1 psi (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Automobile Tyre Pressure Gauges, Service Station Air Inflators',
  },

  // 5. Temperature & Environmental Standards
  {
    standardId: 'STD-GATC-TMP-01',
    category: 'temperature',
    categoryLabel: 'Temperature & Environment',
    description: 'Standard Platinum Resistance Thermometer (SPRT Pt100) & Dry Block (-40°C to +250°C)',
    accuracyClass: 'ITS-90 Standard',
    nominalValue: '-40°C to +250°C with 0.001°C Resolution Multi-Channel Bridge',
    calibrationCertificate: 'NPLI-TMP-CAL-2025-0078',
    calibratedBy: 'National Physical Laboratory (NPL India)',
    calibrationDate: '2025-04-25',
    validUntil: '2027-04-24',
    expandedUncertainty: 'U = 0.01°C (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Clinical Thermometers, Industrial Temperature Probes in Automatic Flow Computers',
  },
  {
    standardId: 'STD-GATC-ENV-02',
    category: 'temperature',
    categoryLabel: 'Temperature & Environment',
    description: 'Traceable Precision Digital Environmental Weather & Thermo-Hygro Station',
    accuracyClass: 'WMO & NPL Traceable',
    nominalValue: 'Temp: -10°C to 60°C | RH: 5% to 95% | Barometric: 600 to 1100 hPa',
    calibrationCertificate: 'NPLI-ENV-2026-0003',
    calibratedBy: 'National Physical Laboratory (NPL India)',
    calibrationDate: '2026-01-05',
    validUntil: '2028-01-04',
    expandedUncertainty: 'U = 0.1°C, 1.2% RH, 0.2 hPa (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Laboratory Environmental Control, Air Buoyancy Correction in Mass Metrology',
  },

  // 6. Gas & Flow Standards
  {
    standardId: 'STD-GATC-FLOW-01',
    category: 'flow',
    categoryLabel: 'Gas & Flow Meters',
    description: 'Master Bell Prover & Rotary Displacement Gas Meter Calibrator (0.016 to 10 m³/h)',
    accuracyClass: 'OIML R137 / Class 0.5',
    nominalValue: '0.016 m³/h - 10 m³/h Sealed Bell Prover Bell Tank',
    calibrationCertificate: 'RRSL-AMD-GAS-2025-119',
    calibratedBy: 'RRSL Ahmedabad Gas Metrology Laboratory',
    calibrationDate: '2025-06-11',
    validUntil: '2027-06-10',
    expandedUncertainty: 'U = 0.2% of flow rate (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Domestic Diaphragm Gas Meters, Commercial Rotary Gas Flow Meters, CNG Dispensers',
  },

  // 7. Taxi & Speed Metrology Standards
  {
    standardId: 'STD-GATC-TAXI-01',
    category: 'taxi',
    categoryLabel: 'Taxi & Speed Metrology',
    description: 'Electronic Distance & Pulse Road Track Simulator for Taxi & Auto Fare Meters',
    accuracyClass: 'OIML R21 / Class 1',
    nominalValue: '0 to 120 km/h | 100 to 10,000 pulses/km | Time: 0 to 24 hrs',
    calibrationCertificate: 'RRSL-DEL-TXM-2025-0044',
    calibratedBy: 'RRSL Delhi Transport Metrology Section',
    calibrationDate: '2025-08-30',
    validUntil: '2027-08-29',
    expandedUncertainty: 'U = 0.1% on distance, 0.05s on time (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Digital Auto-Rickshaw Fare Meters, Taxi Meters, GPS-Linked Electronic Fare Systems',
  },
  {
    standardId: 'STD-GATC-TAXI-02',
    category: 'taxi',
    categoryLabel: 'Taxi & Speed Metrology',
    description: 'Chassis Dynamometer Master Roller Test Bench for Dynamic Vehicle Speedometers',
    accuracyClass: 'OIML R21 & AIS-018',
    nominalValue: 'Twin Roller Drive Bench (0 to 160 km/h Vehicle Speed)',
    calibrationCertificate: 'DL-GOV-MOT-2025-998',
    calibratedBy: 'Department of Transport & Legal Metrology Inspection Div',
    calibrationDate: '2025-05-18',
    validUntil: '2027-05-17',
    expandedUncertainty: 'U = 0.2 km/h (k=2)',
    status: 'ACTIVE',
    applicableInstruments: 'Speed Governors, Commercial Vehicle Speedometers, Taxi Fare Road Verification',
  },
];

export const GATCManagement: React.FC = () => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const { mode, version: apiVersion } = useApiMode();
  const [activeTab, setActiveTab] = useState<'intake' | 'testing' | 'standards' | 'ledger'>('intake');

  const [applications, setApplications] = useState<Application[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [sessions, setSessions] = useState<VerificationSession[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);

  // Standards filter states
  const [standardCategory, setStandardCategory] = useState<string>('all');
  const [standardSearch, setStandardSearch] = useState<string>('');
  const [standardStatus, setStandardStatus] = useState<string>('ALL');

  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedCertForView, setSelectedCertForView] = useState<Certificate | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  // Dedicated Worksheet Modal State
  const [selectedWorksheetSession, setSelectedWorksheetSession] = useState<VerificationSession | null>(null);
  const [selectedWorksheetCert, setSelectedWorksheetCert] = useState<Certificate | null>(null);
  const [isWorksheetModalOpen, setIsWorksheetModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [appRes, instRes, sessRes, certRes] = await Promise.all([
        api.applications.listApplications(user.tenantId),
        api.instruments.listInstruments(user.tenantId),
        api.verification.listSessions(user.tenantId),
        api.certificates.listCertificates(user.tenantId),
      ]);

      setApplications(appRes.items);
      setInstruments(instRes.items);
      setSessions(sessRes.items);
      setCertificates(certRes.items);

      // Automatically advance selectedSessionId away from completed & certified sessions
      const isSelectedSessionCertified = certRes.items.some((c) => c.session_id === selectedSessionId);
      if (!selectedSessionId || isSelectedSessionCertified) {
        const remainingWorkSession = sessRes.items.find(
          (s) => !(s.status === 'FINALIZED' && certRes.items.some((c) => c.session_id === s.session_id))
        );
        setSelectedSessionId(remainingWorkSession ? remainingWorkSession.session_id : '');
      }
    } catch (err) {
      console.error('Failed to load GATC data:', err);
    }
  }, [user.tenantId, selectedSessionId, mode, apiVersion]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Strictly filter certificates issued by GATC (excludes LMO Departmental certificates)
  const gatcCertificates = certificates.filter(
    (c) => c.issuer_type === 'GATC' || c.certificate_number.startsWith('GATC-')
  );

  // Pending Scrutiny / Intake applications (action required: scrutiny, scope check, deficiency query, or scheduling)
  const pendingIntakeApps = applications.filter(
    (a) => a.current_status !== 'COMPLETED' && a.current_status !== 'REJECTED'
  );

  // Active testing workload: sessions available for GATC testing
  const activeWorkSessions = sessions.filter(
    (s) => !(s.status === 'FINALIZED' && certificates.some((c) => c.session_id === s.session_id))
  );

  const activeSession = activeWorkSessions.find((s) => s.session_id === selectedSessionId) || activeWorkSessions[0] || null;
  const activeSessionApp = activeSession ? applications.find((a) => a.application_id === activeSession.application_id) : null;
  const activeSessionInst = activeSession ? instruments.find((i) => i.instrument_id === (activeSession.instrument_id || activeSessionApp?.instrument_id)) : null;
  const activeSessionCert = activeSession ? certificates.find((c) => c.session_id === activeSession.session_id) : null;

  const handleSelectSessionForTesting = async (appId: string) => {
    let matchedSession = sessions.find((s) => s.application_id === appId && s.status !== 'FINALIZED');
    if (!matchedSession) {
      matchedSession = sessions.find((s) => s.application_id === appId);
    }
    if (!matchedSession) {
      const app = applications.find((a) => a.application_id === appId);
      if (app) {
        matchedSession = sessions.find((s) => s.instrument_id === app.instrument_id && s.status !== 'FINALIZED');
        if (!matchedSession) {
          try {
            matchedSession = await api.verification.createSession(user.tenantId, {
              application_id: app.application_id,
              instrument_id: app.instrument_id,
              scheduled_date: new Date().toISOString().split('T')[0],
            });
            await loadData();
          } catch (e) {
            console.error('Failed to auto-create session for GATC testing:', e);
          }
        }
      }
    }

    if (matchedSession) {
      setSelectedSessionId(matchedSession.session_id);
    } else if (activeWorkSessions.length > 0) {
      setSelectedSessionId(activeWorkSessions[0].session_id);
    }
    setActiveTab('testing');
  };

  // Filtered Standards list
  const filteredStandards = useMemo(() => {
    return allStatutoryWorkingStandards.filter((std) => {
      if (standardCategory !== 'all' && std.category !== standardCategory) {
        return false;
      }
      if (standardStatus !== 'ALL' && std.status !== standardStatus) {
        return false;
      }
      if (standardSearch.trim()) {
        const query = standardSearch.toLowerCase().trim();
        const matchId = std.standardId.toLowerCase().includes(query);
        const matchDesc = std.description.toLowerCase().includes(query);
        const matchClass = std.accuracyClass.toLowerCase().includes(query);
        const matchCert = std.calibrationCertificate.toLowerCase().includes(query);
        const matchApp = std.applicableInstruments.toLowerCase().includes(query);
        if (!matchId && !matchDesc && !matchClass && !matchCert && !matchApp) {
          return false;
        }
      }
      return true;
    });
  }, [standardCategory, standardSearch, standardStatus]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allStatutoryWorkingStandards.length,
      mass: 0,
      volume: 0,
      length: 0,
      pressure: 0,
      temperature: 0,
      flow: 0,
      taxi: 0,
    };
    allStatutoryWorkingStandards.forEach((s) => {
      counts[s.category] = (counts[s.category] || 0) + 1;
    });
    return counts;
  }, []);

  return (
    <div className="space-y-6">
      {/* GATC Verified Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-2xl p-6 shadow-md border border-indigo-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Microscope className="w-6 h-6 text-indigo-400" />
              <h2 className="text-xl font-bold tracking-tight">Government Approved Test Centre (GATC) Console</h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                GATC RULES, 2013 ACCREDITED
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Approved Centre: <span className="font-semibold text-white">Apex Metrology Calibration Lab Pvt Ltd</span> | Approval Order: <span className="font-mono text-amber-300">GATC/MH/2024/014</span> | Accredited Verifier: <span className="font-semibold text-white">{user.actorName}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 px-3.5 py-2 rounded-xl border border-white/15 text-xs text-slate-200 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>GATC Key Slot: <strong className="font-mono text-white">HSM-GATC-01</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation (Matching LMO Structure + GATC Standards Registry) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 flex-wrap">
        <button
          onClick={() => setActiveTab('intake')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'intake'
              ? 'bg-gov-navy text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileCheck2 className="w-4 h-4 text-amber-400" />
          <span>Application Intake &amp; Lab Scheduling Queue ({pendingIntakeApps.length} Pending)</span>
        </button>

        <button
          onClick={() => setActiveTab('testing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'testing'
              ? 'bg-indigo-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Scale className="w-4 h-4 text-indigo-300" />
          <span>Guided NAWI Testing Session Execution ({activeWorkSessions.length} Active Workload)</span>
        </button>

        <button
          onClick={() => setActiveTab('standards')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'standards'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4 text-amber-400" />
          <span>Accreditation Scope &amp; Working Standards ({allStatutoryWorkingStandards.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'ledger'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4 text-blue-300" />
          <span>Issued GATC Test Reports &amp; Certificates Ledger ({gatcCertificates.length})</span>
        </button>
      </div>

      {/* Tab 1: GATC Application Intake & Scrutiny Queue */}
      {activeTab === 'intake' && (
        <ScrutinyQueue
          applications={applications}
          instruments={instruments}
          certificates={certificates}
          sessions={sessions}
          onApplicationUpdated={loadData}
          onSelectSessionForTesting={handleSelectSessionForTesting}
        />
      )}

      {/* Tab 2: Guided NAWI Testing Execution */}
      {activeTab === 'testing' && (
        <div className="space-y-4">
          {/* Active Testing Queue Picker */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 shrink-0">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>GATC Lab Queue:</span>
            </div>
            <div className="flex-1 w-full">
              <select
                value={activeSession?.session_id || ''}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                disabled={activeWorkSessions.length === 0}
                className="text-xs font-semibold rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-600 w-full disabled:bg-slate-50 disabled:text-slate-400"
              >
                {activeWorkSessions.length > 0 ? (
                  activeWorkSessions.map((s) => {
                    const app = applications.find((a) => a.application_id === s.application_id);
                    const inst = instruments.find((i) => i.instrument_id === (s.instrument_id || app?.instrument_id));
                    const appNum = app?.application_number || `App #${s.application_id.slice(0, 8)}`;
                    const model = inst?.model?.model_name || 'Weighing Instrument';
                    const sn = inst?.serial_number || 'N/A';
                    const status = s.status.replace(/_/g, ' ');
                    const outcome = s.outcome ? ` • ${s.outcome.replace(/_/g, ' ')}` : '';
                    return (
                      <option key={s.session_id} value={s.session_id}>
                        {appNum} — {model} (SN: {sn}) [{status}{outcome}]
                      </option>
                    );
                  })
                ) : (
                  <option value="">No pending instruments assigned for GATC testing — Queue clear</option>
                )}
              </select>
            </div>
          </div>

          {activeSession ? (
            <TestObservationGrid
              session={activeSession}
              instrument={activeSessionInst}
              application={activeSessionApp}
              certificate={activeSessionCert}
              onSessionUpdated={loadData}
              onCertificateIssued={loadData}
              onNavigateToLedger={() => setActiveTab('ledger')}
            />
          ) : (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
              <Scale className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-700 text-sm">No Pending GATC Workload</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                All assigned weighing &amp; measuring instruments have undergone verification testing and digital certification.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: GATC Accreditation & Complete Working Standards Registry */}
      {activeTab === 'standards' && (
        <div className="space-y-6">
          {/* GATC Accreditations Scope Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-gov-navy flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  Statutory GATC Accreditation &amp; Approved Testing Scope
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authority issued under Section 19 of the Legal Metrology Act, 2009 &amp; GATC Rules, 2013
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                ACCREDITATION ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockGATCCentres.map((centre) => (
                <div key={centre.gatcId} className="border border-slate-200 rounded-xl p-5 hover:border-indigo-300 transition-colors space-y-3 bg-slate-50/50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{centre.facilityName}</h4>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">Approval Order: {centre.approvalOrderNumber}</p>
                    </div>
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
                      {centre.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200">
                    <div>
                      <span className="text-slate-500 block">Accreditation Validity:</span>
                      <span className="font-semibold text-slate-800">{centre.validFrom} to {centre.validTo}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Max Approved Capacity:</span>
                      <span className="font-semibold text-slate-800">{centre.maxCapacityKg.toLocaleString()} kg</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className="text-xs text-slate-500 block mb-1">Approved Accuracy Classes:</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {centre.approvedClasses.map((cls) => (
                        <span key={cls} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium border border-indigo-200">
                          {cls}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Traceable Working Reference Standards Full Catalog */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-sm text-gov-navy uppercase tracking-wider">
                  Statutory Working Reference Standards Inventory
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
                {filteredStandards.length} of {allStatutoryWorkingStandards.length} Traceable Standards
              </span>
            </div>

            {/* Filter Pills across all legal metrology divisions */}
            <div className="flex items-center gap-1.5 flex-wrap pb-1">
              <button
                onClick={() => setStandardCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  standardCategory === 'all'
                    ? 'bg-gov-navy text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Metrology Standards ({categoryCounts.all})
              </button>
              <button
                onClick={() => setStandardCategory('mass')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  standardCategory === 'mass'
                    ? 'bg-indigo-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Mass &amp; Weighing ({categoryCounts.mass})</span>
              </button>
              <button
                onClick={() => setStandardCategory('volume')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  standardCategory === 'volume'
                    ? 'bg-blue-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Droplets className="w-3.5 h-3.5" />
                <span>Volume &amp; Fuel Provers ({categoryCounts.volume})</span>
              </button>
              <button
                onClick={() => setStandardCategory('length')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  standardCategory === 'length'
                    ? 'bg-amber-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Ruler className="w-3.5 h-3.5" />
                <span>Length &amp; Dimension ({categoryCounts.length})</span>
              </button>
              <button
                onClick={() => setStandardCategory('pressure')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  standardCategory === 'pressure'
                    ? 'bg-rose-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>Pressure &amp; Force ({categoryCounts.pressure})</span>
              </button>
              <button
                onClick={() => setStandardCategory('temperature')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  standardCategory === 'temperature'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Thermometer className="w-3.5 h-3.5" />
                <span>Temperature &amp; Environment ({categoryCounts.temperature})</span>
              </button>
              <button
                onClick={() => setStandardCategory('flow')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  standardCategory === 'flow'
                    ? 'bg-cyan-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Wind className="w-3.5 h-3.5" />
                <span>Gas &amp; Flow ({categoryCounts.flow})</span>
              </button>
              <button
                onClick={() => setStandardCategory('taxi')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  standardCategory === 'taxi'
                    ? 'bg-purple-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                <span>Taxi &amp; Speed Metrology ({categoryCounts.taxi})</span>
              </button>
            </div>

            {/* Search and Status Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search standard by ID, description, class, certificate, or machine type..."
                  value={standardSearch}
                  onChange={(e) => setStandardSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 bg-white"
                />
              </div>
              <select
                value={standardStatus}
                onChange={(e) => setStandardStatus(e.target.value)}
                className="text-xs font-semibold rounded-lg border border-slate-300 px-3 py-2 bg-white focus:ring-2 focus:ring-indigo-600"
              >
                <option value="ALL">All Calibration Statuses</option>
                <option value="ACTIVE">Active &amp; Traceable Only</option>
                <option value="DUE_CALIBRATION">Due for Calibration</option>
              </select>
            </div>

            {/* Comprehensive Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Standard Identifier</th>
                    <th className="py-2.5 px-3">Description &amp; Nominal Range</th>
                    <th className="py-2.5 px-3">Accuracy Class</th>
                    <th className="py-2.5 px-3">Calibration Certificate</th>
                    <th className="py-2.5 px-3">Calibrated By</th>
                    <th className="py-2.5 px-3">Uncertainty (U)</th>
                    <th className="py-2.5 px-3">Calibration Due Date</th>
                    <th className="py-2.5 px-3">Traceability Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredStandards.length > 0 ? (
                    filteredStandards.map((std) => (
                      <tr key={std.standardId} className="hover:bg-slate-50">
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900 block">{std.standardId}</span>
                          <span className="text-[10px] font-sans text-indigo-600 font-medium">{std.categoryLabel}</span>
                        </td>
                        <td className="py-3 px-3 font-sans text-slate-700 max-w-xs">
                          <strong className="block text-slate-900">{std.description}</strong>
                          <span className="text-xs text-slate-500 font-mono block">{std.nominalValue}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Applied on: {std.applicableInstruments}</span>
                        </td>
                        <td className="py-3 px-3 font-sans font-bold text-indigo-700 whitespace-nowrap">
                          {std.accuracyClass}
                        </td>
                        <td className="py-3 px-3 text-gov-blue whitespace-nowrap">{std.calibrationCertificate}</td>
                        <td className="py-3 px-3 font-sans text-slate-600 whitespace-nowrap">{std.calibratedBy}</td>
                        <td className="py-3 px-3 text-slate-700 whitespace-nowrap font-sans font-medium text-[11px]">
                          {std.expandedUncertainty}
                        </td>
                        <td className="py-3 px-3 font-sans font-bold text-slate-900 whitespace-nowrap">
                          {std.validUntil}
                        </td>
                        <td className="py-3 px-3 font-sans whitespace-nowrap">
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold inline-flex items-center gap-1">
                            <span>✓</span> ACTIVE &amp; TRACEABLE
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 font-sans text-xs">
                        No standards found matching category "{standardCategory}" or search query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: GATC Test Certificates & Reports Ledger */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-gov-navy uppercase tracking-wider">
                  GATC Verification Certificates &amp; Test Reports Master Ledger
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-500">{gatcCertificates.length} Total Records</span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Reset all demo certificates and test data back to baseline state?')) {
                      mockDb.resetDatabase();
                      loadData();
                      notify('success', 'Database Reset', 'All demo certificates cleared and state restored to baseline.');
                    }
                  }}
                  className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 transition-colors cursor-pointer"
                  title="Clear all generated mock certificates and reset database"
                >
                  Clear All Data / Reset
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">GATC Certificate / Report Number</th>
                    <th className="py-2.5 px-3">Validity Period</th>
                    <th className="py-2.5 px-3">Public QR Token</th>
                    <th className="py-2.5 px-3">SHA-256 Digest</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {gatcCertificates.length > 0 ? (
                    gatcCertificates.map((cert) => (
                      <tr key={cert.certificate_id} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-bold text-indigo-900">{cert.certificate_number}</td>
                        <td className="py-3 px-3 font-sans text-slate-700">
                          {cert.issue_date} to <strong className="text-slate-900">{cert.valid_until}</strong>
                        </td>
                        <td className="py-3 px-3 text-gov-blue">{cert.public_verification_token}</td>
                        <td className="py-3 px-3 text-slate-500">{truncateHash(cert.certificate_bytes_sha256, 16)}</td>
                        <td className="py-3 px-3 font-sans">
                          <StatusBadge status={cert.certificate_status} size="sm" />
                        </td>
                        <td className="py-3 px-3 text-right font-sans">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                const matchedSess = sessions.find((s) => s.session_id === cert.session_id);
                                setSelectedWorksheetSession(matchedSess || null);
                                setSelectedWorksheetCert(cert);
                                setIsWorksheetModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold cursor-pointer"
                              title="Inspect complete NAWI observation worksheet and test readings"
                            >
                              Worksheet
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCertForView(cert);
                                setIsCertModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold cursor-pointer"
                            >
                              View Certificate
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-sans text-xs">
                        No issued certificates in GATC Master Ledger yet. Execute verification testing in the GATC Testing Console to issue statutory certificates.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Certificate Modal */}
      <CertificateModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        certificate={selectedCertForView}
        instrument={instruments.find((i) => i.instrument_id === selectedCertForView?.instrument_id)}
      />

      {/* Dedicated NAWI Worksheet Inspection Modal */}
      <WorksheetModal
        isOpen={isWorksheetModalOpen}
        onClose={() => setIsWorksheetModalOpen(false)}
        session={selectedWorksheetSession}
        instrument={selectedWorksheetSession ? instruments.find((i) => i.instrument_id === selectedWorksheetSession.instrument_id) : null}
        application={selectedWorksheetSession ? applications.find((a) => a.application_id === selectedWorksheetSession.application_id) : null}
        certificate={selectedWorksheetCert}
        onViewCertificate={(cert) => {
          setSelectedCertForView(cert);
          setIsCertModalOpen(true);
        }}
      />
    </div>
  );
};
