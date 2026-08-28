import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { hashPassword } from '../auth/password.js';

const prisma = new PrismaClient();

export async function seedDatabase() {
  console.log('Seeding Legal Metrology database with 21 statutory Indian Government-Approved Models...');

  // 0. Clean old transaction data safely
  await prisma.certificateStatusEvent.deleteMany({});
  await prisma.certificate.updateMany({ data: { superseding_certificate_id: null } });
  await prisma.certificate.deleteMany({});
  await prisma.physicalStampAction.deleteMany({});
  await prisma.testObservation.deleteMany({});
  await prisma.sessionReferenceStandard.deleteMany({});
  await prisma.verificationSession.deleteMany({});
  await prisma.verificationApplication.deleteMany({});
  await prisma.feeAssessment.deleteMany({});
  await prisma.instrument.deleteMany({});

  // 1. Tenant
  const tenant = await prisma.tenant.upsert({
    where: { state_code: 'IN-DL' },
    update: {},
    create: {
      tenant_id: 'tenant-delhi-central',
      state_code: 'IN-DL',
      state_name: 'NCT of Delhi',
      status: 'ACTIVE',
      config: JSON.stringify({ default_language: 'en', fee_policy: 'POL-DL-2026' }),
    },
  });

  // 2. Jurisdiction
  const jurisdiction = await prisma.jurisdiction.upsert({
    where: { uq_tenant_jurisdiction_code: { tenant_id: tenant.tenant_id, code: 'JUR-DL-01' } },
    update: {},
    create: {
      jurisdiction_id: 'jur-dl-01',
      tenant_id: tenant.tenant_id,
      name: 'Central Delhi Zone',
      code: 'JUR-DL-01',
      level: 'DISTRICT',
    },
  });

  // 3. Stakeholder & Facility
  const stakeholder = await prisma.stakeholder.upsert({
    where: {
      uq_tenant_identifier: {
        tenant_id: tenant.tenant_id,
        identifier_type: 'GSTIN',
        identifier_value: '07AAAAA0000A1Z5',
      },
    },
    update: {},
    create: {
      stakeholder_id: 'stk-trader-01',
      tenant_id: tenant.tenant_id,
      jurisdiction_id: jurisdiction.jurisdiction_id,
      legal_name: 'Rajesh Enterprises',
      trade_name: 'Rajesh Kirana Store',
      stakeholder_type: 'OWNER_USER',
      identifier_type: 'GSTIN',
      identifier_value: '07AAAAA0000A1Z5',
      email: 'trader.delhi@example.com',
      phone: '+91 98100 12345',
      address_line1: '124, Chandni Chowk',
      city: 'Delhi',
      pincode: '110006',
      is_active: true,
    },
  });

  const facility = await prisma.facility.upsert({
    where: { facility_id: 'fac-retail-01' },
    update: {},
    create: {
      facility_id: 'fac-retail-01',
      tenant_id: tenant.tenant_id,
      stakeholder_id: stakeholder.stakeholder_id,
      facility_name: 'Chandni Chowk Retail Store',
      address_line: 'Shop 12, Main Market, Chandni Chowk',
      district: 'Central Delhi',
      pincode: '110006',
      gps_latitude: new Decimal('28.6505'),
      gps_longitude: new Decimal('77.2303'),
      is_active: true,
    },
  });

  // Public Demo Fixture Stakeholder (Isolated so trader lists start clean at 0)
  const publicDemoStakeholder = await prisma.stakeholder.upsert({
    where: {
      uq_tenant_identifier: {
        tenant_id: tenant.tenant_id,
        identifier_type: 'GSTIN',
        identifier_value: '07GOVLM0000A1Z9',
      },
    },
    update: {},
    create: {
      stakeholder_id: 'stk-public-demo',
      tenant_id: tenant.tenant_id,
      jurisdiction_id: jurisdiction.jurisdiction_id,
      legal_name: 'National Legal Metrology Verification Lab',
      trade_name: 'Delhi LM Reference Repository',
      stakeholder_type: 'OWNER_USER',
      identifier_type: 'GSTIN',
      identifier_value: '07GOVLM0000A1Z9',
      email: 'demo.repository@gov.in',
      phone: '+91 11 2338 0001',
      address_line1: 'Legal Metrology Bhawan',
      city: 'New Delhi',
      pincode: '110001',
      is_active: true,
    },
  });

  // 4. Users
  const userTrader = await prisma.user.upsert({
    where: { email: 'trader@example.com' },
    update: { password_hash: hashPassword('Trader@2026') },
    create: {
      user_id: 'usr-trader-01',
      tenant_id: tenant.tenant_id,
      stakeholder_id: stakeholder.stakeholder_id,
      email: 'trader@example.com',
      full_name: 'Rajesh Kumar',
      role: 'OWNER',
      password_hash: hashPassword('Trader@2026'),
      is_active: true,
    },
  });

  const userLmo = await prisma.user.upsert({
    where: { email: 'lmo.delhi@gov.in' },
    update: { password_hash: hashPassword('Officer@2026') },
    create: {
      user_id: 'lmo-officer-01',
      tenant_id: tenant.tenant_id,
      email: 'lmo.delhi@gov.in',
      full_name: 'Shri Arvind Sharma',
      role: 'LMO',
      password_hash: hashPassword('Officer@2026'),
      is_active: true,
    },
  });

  const userSupervisor = await prisma.user.upsert({
    where: { email: 'supervisor.delhi@gov.in' },
    update: { password_hash: hashPassword('Supervisor@2026') },
    create: {
      user_id: 'sup-delhi-01',
      tenant_id: tenant.tenant_id,
      email: 'supervisor.delhi@gov.in',
      full_name: 'Smt. Sunita Sharma',
      role: 'SUPERVISOR',
      password_hash: hashPassword('Supervisor@2026'),
      is_active: true,
    },
  });

  const userAdmin = await prisma.user.upsert({
    where: { email: 'admin.delhi@gov.in' },
    update: { password_hash: hashPassword('Admin@2026') },
    create: {
      user_id: 'adm-system-01',
      tenant_id: tenant.tenant_id,
      email: 'admin.delhi@gov.in',
      full_name: 'System Administrator',
      role: 'ADMIN',
      password_hash: hashPassword('Admin@2026'),
      is_active: true,
    },
  });

  const userApplicant = await prisma.user.upsert({
    where: { email: 'applicant.delhi@example.com' },
    update: { password_hash: hashPassword('Applicant@2026') },
    create: {
      user_id: 'usr-applicant-02',
      tenant_id: tenant.tenant_id,
      email: 'applicant.delhi@example.com',
      full_name: 'Suresh Verma',
      role: 'APPLICANT',
      password_hash: hashPassword('Applicant@2026'),
      is_active: true,
    },
  });

  const userGatc = await prisma.user.upsert({
    where: { email: 'gatc.delhi@gov.in' },
    update: { password_hash: hashPassword('GATC@2026') },
    create: {
      user_id: 'gatc-verifier-01',
      tenant_id: tenant.tenant_id,
      email: 'gatc.delhi@gov.in',
      full_name: 'Dr. Priya Nair',
      role: 'GATC_VERIFIER',
      password_hash: hashPassword('GATC@2026'),
      is_active: true,
    },
  });

  // 5. LMO Profile
  await prisma.lMOProfile.upsert({
    where: { user_id: userLmo.user_id },
    update: {},
    create: {
      user_id: userLmo.user_id,
      tenant_id: tenant.tenant_id,
      jurisdiction_id: jurisdiction.jurisdiction_id,
      designation: 'Legal Metrology Officer (Central Zone)',
      posting_order_number: 'DL-LM-POST-2024-041',
      authorized_from: new Date('2024-01-01'),
      digital_signature_cert_id: 'DSC-ED25519-LMO-01',
      is_active: true,
    },
  });

  // 6. Seed All 21 Government Approved Models
  const models = [
    {
      model_id: 'MOD-NAWI-01',
      category: 'NAWI',
      subtype: 'COUNTER_SCALE_ELECTRONIC',
      manufacturer_name: 'E.G. Kantawalla (Eagle Scales)',
      model_name: 'Eagle Electronic Counter Scale Model E-30',
      model_approval_number: 'IND/09/2024/8842',
      accuracy_class: 'CLASS_III',
      verification_scale_interval_e: new Decimal('0.005'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('0.1'),
      max_capacity: new Decimal('30.0'),
      capacity_unit: 'kg',
      number_of_intervals_n: 6000,
      specifications: JSON.stringify({ application: 'Retail Supermarkets, Kirana Stores & Commercial Trade' }),
      is_active: true,
    },
    {
      model_id: 'MOD-NAWI-02',
      category: 'NAWI',
      subtype: 'PRICE_COMPUTING_SCALE',
      manufacturer_name: 'Essae-Teraoka Pvt. Ltd.',
      model_name: 'Essae Electronic Price Computing Scale DS-852',
      model_approval_number: 'IND/09/2023/5120',
      accuracy_class: 'CLASS_III',
      verification_scale_interval_e: new Decimal('0.002'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('0.04'),
      max_capacity: new Decimal('15.0'),
      capacity_unit: 'kg',
      number_of_intervals_n: 7500,
      specifications: JSON.stringify({ application: 'Retail Grocery POS, Fruit & Vegetable Vendors' }),
      is_active: true,
    },
    {
      model_id: 'MOD-NAWI-03',
      category: 'NAWI',
      subtype: 'TABLETOP_SCALE_ELECTRONIC',
      manufacturer_name: 'Sansui Electronics (Phoenix Scales)',
      model_name: 'Phoenix Microprocessor Tabletop Scale NPC-10',
      model_approval_number: 'IND/09/2024/3190',
      accuracy_class: 'CLASS_III',
      verification_scale_interval_e: new Decimal('0.001'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('0.02'),
      max_capacity: new Decimal('10.0'),
      capacity_unit: 'kg',
      number_of_intervals_n: 10000,
      specifications: JSON.stringify({ application: 'Sweet Shops, Bakeries, Meat & Fish Markets' }),
      is_active: true,
    },
    {
      model_id: 'MOD-NAWI-04',
      category: 'NAWI',
      subtype: 'BULLION_BALANCE_HIGH_PRECISION',
      manufacturer_name: 'Essae-Teraoka Pvt. Ltd.',
      model_name: 'Essae High-Precision Bullion Balance DS-215',
      model_approval_number: 'IND/09/2023/1080',
      accuracy_class: 'CLASS_II',
      verification_scale_interval_e: new Decimal('0.0001'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('0.005'),
      max_capacity: new Decimal('6.0'),
      capacity_unit: 'kg',
      number_of_intervals_n: 60000,
      specifications: JSON.stringify({ application: 'Gold & Silver Bullion Merchants, Zaveri Bazaar Trade' }),
      is_active: true,
    },
    {
      model_id: 'MOD-NAWI-05',
      category: 'NAWI',
      subtype: 'JEWELRY_CARAT_BALANCE',
      manufacturer_name: 'Citizen Scales India Pvt. Ltd.',
      model_name: 'Citizen Precision Gold & Diamond Carat Balance CG-300',
      model_approval_number: 'IND/09/2024/6720',
      accuracy_class: 'CLASS_II',
      verification_scale_interval_e: new Decimal('0.00001'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('0.0002'),
      max_capacity: new Decimal('0.6'),
      capacity_unit: 'kg',
      number_of_intervals_n: 60000,
      specifications: JSON.stringify({ application: 'Hallmarking Centers, Diamond & Gem Assaying' }),
      is_active: true,
    },
    {
      model_id: 'MOD-NAWI-06',
      category: 'NAWI',
      subtype: 'PRECISION_LABORATORY_BALANCE',
      manufacturer_name: 'Mettler-Toledo India Pvt. Ltd.',
      model_name: 'Mettler Toledo Jewel Precision Balance JE503G',
      model_approval_number: 'IND/09/2022/9440',
      accuracy_class: 'CLASS_II',
      verification_scale_interval_e: new Decimal('0.00001'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('0.001'),
      max_capacity: new Decimal('1.0'),
      capacity_unit: 'kg',
      number_of_intervals_n: 100000,
      specifications: JSON.stringify({ application: 'Precious Metals, Laboratory R&D, Chemical Analysis' }),
      is_active: true,
    },
    {
      model_id: 'MOD-NAWI-07',
      category: 'NAWI',
      subtype: 'ULTRA_MICRO_ANALYTICAL_BALANCE',
      manufacturer_name: 'Shimadzu Analytical India Pvt. Ltd.',
      model_name: 'Shimadzu Ultra-Micro Analytical Balance AP-225WD',
      model_approval_number: 'IND/09/2023/7810',
      accuracy_class: 'CLASS_I',
      verification_scale_interval_e: new Decimal('0.000001'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('0.00001'),
      max_capacity: new Decimal('0.22'),
      capacity_unit: 'kg',
      number_of_intervals_n: 220000,
      specifications: JSON.stringify({ application: 'Pharmaceutical QC, Toxicology & Reference Labs' }),
      is_active: true,
    },
    {
      model_id: 'MOD-NAWI-08',
      category: 'NAWI',
      subtype: 'PREMIUM_ANALYTICAL_BALANCE',
      manufacturer_name: 'Sartorius India Pvt. Ltd.',
      model_name: 'Sartorius Cubis II Premium Analytical Balance MCA224S',
      model_approval_number: 'IND/09/2024/0930',
      accuracy_class: 'CLASS_I',
      verification_scale_interval_e: new Decimal('0.000001'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('0.00001'),
      max_capacity: new Decimal('0.22'),
      capacity_unit: 'kg',
      number_of_intervals_n: 220000,
      specifications: JSON.stringify({ application: 'National Metrology Institutes, Drug Formulation' }),
      is_active: true,
    },
    {
      model_id: 'MOD-NAWI-09',
      category: 'NAWI',
      subtype: 'INDUSTRIAL_PLATFORM_SCALE',
      manufacturer_name: 'E.G. Kantawalla (Eagle Scales)',
      model_name: 'Eagle Heavy Industrial Platform Scale MP-500',
      model_approval_number: 'IND/09/2024/1150',
      accuracy_class: 'CLASS_III',
      verification_scale_interval_e: new Decimal('0.05'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('2.0'),
      max_capacity: new Decimal('500.0'),
      capacity_unit: 'kg',
      number_of_intervals_n: 10000,
      specifications: JSON.stringify({ application: 'APMC Agricultural Mandis, Grain Mandis & Heavy Freight' }),
      is_active: true,
    },
    {
      model_id: 'MOD-NAWI-10',
      category: 'NAWI',
      subtype: 'HEAVY_DUTY_PLATFORM_SCALE',
      manufacturer_name: 'Essae-Teraoka Pvt. Ltd.',
      model_name: 'Essae Heavy Duty Industrial Platform Scale DS-451',
      model_approval_number: 'IND/09/2023/4400',
      accuracy_class: 'CLASS_III',
      verification_scale_interval_e: new Decimal('0.1'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('4.0'),
      max_capacity: new Decimal('1000.0'),
      capacity_unit: 'kg',
      number_of_intervals_n: 10000,
      specifications: JSON.stringify({ application: 'Warehouses, Logistics Hubs, Chemical Drums' }),
      is_active: true,
    },
    {
      model_id: 'MOD-NAWI-11',
      category: 'NAWI',
      subtype: 'AGRICULTURAL_MANDI_SCALE',
      manufacturer_name: 'Tulsi Weighing Solutions',
      model_name: 'Tulsi APMC Mandi Grain Platform Scale TPS-300',
      model_approval_number: 'IND/09/2025/2040',
      accuracy_class: 'CLASS_III',
      verification_scale_interval_e: new Decimal('0.02'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('1.0'),
      max_capacity: new Decimal('300.0'),
      capacity_unit: 'kg',
      number_of_intervals_n: 15000,
      specifications: JSON.stringify({ application: 'Wheat, Rice, Cotton & Pulses Mandi Yards' }),
      is_active: true,
    },
    {
      model_id: 'MOD-NAWI-12',
      category: 'NAWI',
      subtype: 'AUTOMATED_MILK_COLLECTION_SCALE',
      manufacturer_name: 'Essae-Teraoka Pvt. Ltd.',
      model_name: 'Essae Automated Milk Weighing Bowl Unit DS-215M',
      model_approval_number: 'IND/09/2024/5520',
      accuracy_class: 'CLASS_III',
      verification_scale_interval_e: new Decimal('0.01'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('0.2'),
      max_capacity: new Decimal('60.0'),
      capacity_unit: 'kg',
      number_of_intervals_n: 6000,
      specifications: JSON.stringify({ application: 'Dairy Cooperative Village Societies (Amul / NDDB AMCU)' }),
      is_active: true,
    },
    {
      model_id: 'MOD-NAWI-13',
      category: 'NAWI',
      subtype: 'WIRELESS_CRANE_SCALE',
      manufacturer_name: 'E.G. Kantawalla (Eagle Scales)',
      model_name: 'Eagle Wireless Heavy Crane & Hanging Scale CS-5T',
      model_approval_number: 'IND/09/2024/8810',
      accuracy_class: 'CLASS_III',
      verification_scale_interval_e: new Decimal('1.0'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('20.0'),
      max_capacity: new Decimal('5000.0'),
      capacity_unit: 'kg',
      number_of_intervals_n: 5000,
      specifications: JSON.stringify({ application: 'Steel Yards, Foundries, Ports, Timber Yards' }),
      is_active: true,
    },
    {
      model_id: 'MOD-NAWI-14',
      category: 'NAWI',
      subtype: 'HIGHWAY_TRUCK_WEIGHBRIDGE',
      manufacturer_name: 'Avery India Ltd. (Avery Weigh-Tronix)',
      model_name: 'Avery Weigh-Tronix Pitless Highway Weighbridge BridgeMont 50T',
      model_approval_number: 'IND/09/2023/9930',
      accuracy_class: 'CLASS_IIII',
      verification_scale_interval_e: new Decimal('10.0'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('200.0'),
      max_capacity: new Decimal('50000.0'),
      capacity_unit: 'kg',
      number_of_intervals_n: 5000,
      specifications: JSON.stringify({ application: 'Commercial Highway Transport, Logistics Depots, Toll Plazas' }),
      is_active: true,
    },
    {
      model_id: 'MOD-NAWI-15',
      category: 'NAWI',
      subtype: 'HEAVY_INDUSTRIAL_WEIGHBRIDGE',
      manufacturer_name: 'Avery India Ltd. (Avery Weigh-Tronix)',
      model_name: 'Avery Heavy Duty 100 Ton Pitless Weighbridge BridgeMont 100T',
      model_approval_number: 'IND/09/2024/4010',
      accuracy_class: 'CLASS_IIII',
      verification_scale_interval_e: new Decimal('20.0'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('400.0'),
      max_capacity: new Decimal('100000.0'),
      capacity_unit: 'kg',
      number_of_intervals_n: 5000,
      specifications: JSON.stringify({ application: 'Thermal Power Plants, Cement Plants, Mining Coal Yards' }),
      is_active: true,
    },
    {
      model_id: 'MOD-NAWI-16',
      category: 'NAWI',
      subtype: 'HIGHWAY_TRUCK_WEIGHBRIDGE',
      manufacturer_name: 'Tulsi Weighing Solutions',
      model_name: 'Tulsi Heavy Highway Electronic Weighbridge TWB-60T',
      model_approval_number: 'IND/09/2025/1190',
      accuracy_class: 'CLASS_IIII',
      verification_scale_interval_e: new Decimal('10.0'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('200.0'),
      max_capacity: new Decimal('60000.0'),
      capacity_unit: 'kg',
      number_of_intervals_n: 6000,
      specifications: JSON.stringify({ application: 'State Highway Checkposts, Container Freight Stations' }),
      is_active: true,
    },
    {
      model_id: 'MOD-NAWI-17',
      category: 'AWI',
      subtype: 'AUTOMATIC_GRAVIMETRIC_FILLING_SYSTEM',
      manufacturer_name: 'Crown Scales Manufacturing Ltd.',
      model_name: 'Crown Automatic Gravimetric Valve Bag Filling System AGF-50',
      model_approval_number: 'IND/09/2024/7180',
      accuracy_class: 'CLASS_III',
      verification_scale_interval_e: new Decimal('0.01'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('5.0'),
      max_capacity: new Decimal('50.0'),
      capacity_unit: 'kg',
      number_of_intervals_n: 5000,
      specifications: JSON.stringify({ application: 'Cement, Fertilizer, Polymer Granules Packaging Lines' }),
      is_active: true,
    },
    {
      model_id: 'MOD-NAWI-18',
      category: 'NAWI',
      subtype: 'MEDICAL_PERSON_SCALE',
      manufacturer_name: 'Sansui Electronics (Phoenix Scales)',
      model_name: 'Phoenix Digital Medical & Person Scale MPS-200',
      model_approval_number: 'IND/09/2023/6050',
      accuracy_class: 'CLASS_III',
      verification_scale_interval_e: new Decimal('0.05'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('1.0'),
      max_capacity: new Decimal('200.0'),
      capacity_unit: 'kg',
      number_of_intervals_n: 4000,
      specifications: JSON.stringify({ application: 'Hospitals, Clinics, Fitness Centers' }),
      is_active: true,
    },
    {
      model_id: 'MOD-FLOW-01',
      category: 'FLOW_METER',
      subtype: 'MOTOR_FUEL_DISPENSER',
      manufacturer_name: 'Midco Limited',
      model_name: 'Midco Multi-Product Motor Fuel Dispensing Unit MPD-Avanti',
      model_approval_number: 'IND/09/2023/8320',
      accuracy_class: 'CLASS_III',
      verification_scale_interval_e: new Decimal('0.01'),
      scale_interval_unit: 'L',
      min_capacity: new Decimal('5.0'),
      max_capacity: new Decimal('80.0'),
      capacity_unit: 'L/min',
      number_of_intervals_n: 8000,
      specifications: JSON.stringify({ application: 'Retail Fuel Outlets (IOCL / BPCL / HPCL)' }),
      is_active: true,
    },
    {
      model_id: 'MOD-FLOW-02',
      category: 'FLOW_METER',
      subtype: 'MOTOR_FUEL_DISPENSER',
      manufacturer_name: 'Gilbarco Veeder-Root India Pvt. Ltd.',
      model_name: 'Gilbarco Veeder-Root Retail Fuel Dispenser Horizon-Dual',
      model_approval_number: 'IND/09/2024/2280',
      accuracy_class: 'CLASS_III',
      verification_scale_interval_e: new Decimal('0.01'),
      scale_interval_unit: 'L',
      min_capacity: new Decimal('5.0'),
      max_capacity: new Decimal('90.0'),
      capacity_unit: 'L/min',
      number_of_intervals_n: 9000,
      specifications: JSON.stringify({ application: 'High-Volume Commercial Retail Fuel Outlets' }),
      is_active: true,
    },
    {
      model_id: 'MOD-LNR-01',
      category: 'LINEAR_MEASURE',
      subtype: 'CARBON_STEEL_MEASURING_TAPE',
      manufacturer_name: 'FMS (Freeman Measures Ltd.)',
      model_name: 'Freeman Heavy Duty Carbon Steel Measuring Tape 50M',
      model_approval_number: 'IND/09/2024/1120',
      accuracy_class: 'CLASS_II',
      verification_scale_interval_e: new Decimal('0.001'),
      scale_interval_unit: 'm',
      min_capacity: new Decimal('0.001'),
      max_capacity: new Decimal('50.0'),
      capacity_unit: 'm',
      number_of_intervals_n: 50000,
      specifications: JSON.stringify({ application: 'Civil Construction, Land Surveying, Textile Trade' }),
      is_active: true,
    },
  ];

  for (const m of models) {
    await prisma.instrumentModel.upsert({
      where: { model_id: m.model_id },
      update: m,
      create: m,
    });
  }
  console.log(`✓ Seeded ${models.length} Government-Approved Models`);

  // 7. Reference Standards (NPL / RRSL Calibrated)
  await prisma.referenceStandard.upsert({
    where: { standard_id: 'STD-MASS-CLASS-F2-001' },
    update: {},
    create: {
      standard_id: 'STD-MASS-CLASS-F2-001',
      tenant_id: tenant.tenant_id,
      custodian_type: 'DEPARTMENTAL_LAB',
      custodian_id: 'LAB-DEL-01',
      asset_tag: 'DL-LM-STD-F2-01',
      denomination_mass: new Decimal('5.0'),
      mass_unit: 'kg',
      accuracy_class: 'F2',
      serial_number: 'SN-F2-2023-089',
      calibration_certificate_number: 'CAL-NPL-2025-F2-089',
      calibrating_laboratory: 'National Physical Laboratory (NPL India)',
      calibrated_at: new Date('2025-05-15'),
      valid_until: new Date('2027-05-15'),
      expanded_uncertainty: new Decimal('0.00001'),
      calibration_status: 'ACTIVE',
    },
  });

  await prisma.referenceStandard.upsert({
    where: { standard_id: 'STD-MASS-CLASS-M1-002' },
    update: {},
    create: {
      standard_id: 'STD-MASS-CLASS-M1-002',
      tenant_id: tenant.tenant_id,
      custodian_type: 'DEPARTMENTAL_LAB',
      custodian_id: 'LAB-DEL-01',
      asset_tag: 'DL-LM-STD-M1-02',
      denomination_mass: new Decimal('20.0'),
      mass_unit: 'kg',
      accuracy_class: 'M1',
      serial_number: 'SN-M1-2023-442',
      calibration_certificate_number: 'CAL-RRSL-2025-M1-442',
      calibrating_laboratory: 'Regional Reference Standard Laboratory (RRSL Faridabad)',
      calibrated_at: new Date('2025-08-30'),
      valid_until: new Date('2027-08-30'),
      expanded_uncertainty: new Decimal('0.0001'),
      calibration_status: 'ACTIVE',
    },
  });

  // 8. Isolated Public QR Verification Fixture Certificates (Owned by public demo repo, NOT trader)
  const demoInstrument = await prisma.instrument.upsert({
    where: { uq_model_serial: { model_id: 'MOD-NAWI-01', serial_number: 'SN-DEMO-PUBLIC-001' } },
    update: {},
    create: {
      instrument_id: 'inst-demo-public-01',
      public_instrument_token: 'INST_TOKEN_DEMO_001',
      tenant_id: tenant.tenant_id,
      jurisdiction_id: jurisdiction.jurisdiction_id,
      model_id: 'MOD-NAWI-01',
      owner_id: publicDemoStakeholder.stakeholder_id,
      facility_id: facility.facility_id,
      serial_number: 'SN-DEMO-PUBLIC-001',
      year_of_manufacture: 2024,
      intended_use: 'Public Demo Verification Standard',
      current_status: 'ACTIVE_VERIFIED',
    },
  });

  const demoApp = await prisma.verificationApplication.upsert({
    where: { application_number: 'APP-2026-DL-PUBLIC-001' },
    update: {},
    create: {
      application_id: 'app-dl-public-demo-01',
      application_number: 'APP-2026-DL-PUBLIC-001',
      tenant_id: tenant.tenant_id,
      jurisdiction_id: jurisdiction.jurisdiction_id,
      instrument_id: demoInstrument.instrument_id,
      applicant_id: publicDemoStakeholder.stakeholder_id,
      application_type: 'INITIAL_VERIFICATION',
      service_mode: 'ON_SITE',
      current_status: 'COMPLETED',
      applicant_declaration_accepted: true,
      version: 1,
    },
  });

  const demoSession = await prisma.verificationSession.upsert({
    where: { session_id: 'sess-dl-demo-public-01' },
    update: {},
    create: {
      session_id: 'sess-dl-demo-public-01',
      tenant_id: tenant.tenant_id,
      application_id: demoApp.application_id,
      instrument_id: demoInstrument.instrument_id,
      procedure_pack_id: 'IND-LM-NAWI-CLASS-III-IIII-2026.1',
      procedure_pack_checksum: 'a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e',
      verifier_id: userLmo.user_id,
      verifier_role: 'LMO',
      scheduled_date: new Date('2026-08-23'),
      actual_test_timestamp: new Date('2026-08-23T11:00:00Z'),
      status: 'FINALIZED',
      automated_evaluation_flag: true,
      outcome: 'VERIFICATION_PASSED_PENDING_AUTHORIZATION',
      officer_disposition_notes: 'Demonstration public fixture verification passed statutory NAWI tolerance bounds.',
      finalized_at: new Date('2026-08-23T12:00:00Z'),
    },
  });

  await prisma.physicalStampAction.upsert({
    where: { stamp_action_id: 'stamp-dl-demo-public-01' },
    update: {},
    create: {
      stamp_action_id: 'stamp-dl-demo-public-01',
      tenant_id: tenant.tenant_id,
      session_id: demoSession.session_id,
      instrument_id: demoInstrument.instrument_id,
      verifier_id: userLmo.user_id,
      action_type: 'SEAL_APPLIED',
      seal_type: 'LEAD_WIRE_SEAL',
      seal_identification_number: 'DL-SEAL-2026-0042',
      seal_position: 'CALIBRATION_PORT_MAIN',
      action_timestamp: new Date('2026-08-23T11:30:00Z'),
      notes: 'Lead wire seal embossed with NCT Delhi LM mark.',
    },
  });

  // 1. TOKEN_VALID_2026
  await prisma.certificate.upsert({
    where: { certificate_number: 'CERT-2026-DL-00042' },
    update: {},
    create: {
      certificate_id: 'cert-dl-demo-valid-01',
      certificate_number: 'CERT-2026-DL-00042',
      public_verification_token: 'TOKEN_VALID_2026',
      tenant_id: tenant.tenant_id,
      session_id: demoSession.session_id,
      instrument_id: demoInstrument.instrument_id,
      owner_id: publicDemoStakeholder.stakeholder_id,
      procedure_pack_id: 'IND-LM-NAWI-CLASS-III-IIII-2026.1',
      verifier_id: userLmo.user_id,
      signer_id: userLmo.user_id,
      issue_date: new Date('2026-08-23'),
      valid_until: new Date('2027-08-22'),
      certificate_status: 'ISSUED',
      certificate_bytes_sha256: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
      digital_signature_reference: 'SIG-ED25519-DL-2026-LMO-00042',
      signature_timestamp: new Date('2026-08-23T12:05:00Z'),
      qr_code_payload: 'https://legalmetrology.delhi.gov.in/verify/qr/TOKEN_VALID_2026',
    },
  });

  // 2. TOKEN_EXPIRED_2025
  await prisma.certificate.upsert({
    where: { certificate_number: 'CERT-2025-DL-00918' },
    update: {},
    create: {
      certificate_id: 'cert-dl-demo-expired-01',
      certificate_number: 'CERT-2025-DL-00918',
      public_verification_token: 'TOKEN_EXPIRED_2025',
      tenant_id: tenant.tenant_id,
      session_id: demoSession.session_id,
      instrument_id: demoInstrument.instrument_id,
      owner_id: publicDemoStakeholder.stakeholder_id,
      procedure_pack_id: 'IND-LM-NAWI-CLASS-III-IIII-2026.1',
      verifier_id: userLmo.user_id,
      signer_id: userLmo.user_id,
      issue_date: new Date('2025-06-16'),
      valid_until: new Date('2026-06-15'),
      certificate_status: 'EXPIRED',
      certificate_bytes_sha256: '8a9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
      digital_signature_reference: 'SIG-ED25519-DL-2025-LMO-00918',
      signature_timestamp: new Date('2025-06-16T10:00:00Z'),
      qr_code_payload: 'https://legalmetrology.delhi.gov.in/verify/qr/TOKEN_EXPIRED_2025',
    },
  });

  // 3. TOKEN_SUSPENDED_2026
  const suspendedCert = await prisma.certificate.upsert({
    where: { certificate_number: 'CERT-2026-DL-00311' },
    update: {},
    create: {
      certificate_id: 'cert-dl-demo-suspended-01',
      certificate_number: 'CERT-2026-DL-00311',
      public_verification_token: 'TOKEN_SUSPENDED_2026',
      tenant_id: tenant.tenant_id,
      session_id: demoSession.session_id,
      instrument_id: demoInstrument.instrument_id,
      owner_id: publicDemoStakeholder.stakeholder_id,
      procedure_pack_id: 'IND-LM-NAWI-CLASS-III-IIII-2026.1',
      verifier_id: userLmo.user_id,
      signer_id: userLmo.user_id,
      issue_date: new Date('2026-01-10'),
      valid_until: new Date('2027-01-09'),
      certificate_status: 'SUSPENDED',
      certificate_bytes_sha256: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
      digital_signature_reference: 'SIG-ED25519-DL-2026-LMO-00311',
      signature_timestamp: new Date('2026-01-10T11:00:00Z'),
      qr_code_payload: 'https://legalmetrology.delhi.gov.in/verify/qr/TOKEN_SUSPENDED_2026',
    },
  });

  await prisma.certificateStatusEvent.create({
    data: {
      certificate_id: suspendedCert.certificate_id,
      previous_status: 'ISSUED',
      new_status: 'SUSPENDED',
      actor_id: userSupervisor.user_id,
      reason: 'Physical lead seal reported damaged during routine market surveillance.',
      statutory_authority_reference: 'Section 24(3) Order #LM-DEL-2026-088',
      event_timestamp: new Date('2026-04-10T14:30:00Z'),
    },
  });

  // 4. TOKEN_REVOKED_2026
  const revokedCert = await prisma.certificate.upsert({
    where: { certificate_number: 'CERT-2026-DL-00109' },
    update: {},
    create: {
      certificate_id: 'cert-dl-demo-revoked-01',
      certificate_number: 'CERT-2026-DL-00109',
      public_verification_token: 'TOKEN_REVOKED_2026',
      tenant_id: tenant.tenant_id,
      session_id: demoSession.session_id,
      instrument_id: demoInstrument.instrument_id,
      owner_id: publicDemoStakeholder.stakeholder_id,
      procedure_pack_id: 'IND-LM-NAWI-CLASS-III-IIII-2026.1',
      verifier_id: userLmo.user_id,
      signer_id: userLmo.user_id,
      issue_date: new Date('2026-02-15'),
      valid_until: new Date('2027-02-14'),
      certificate_status: 'REVOKED',
      certificate_bytes_sha256: '992a71f1e18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f1116120112',
      digital_signature_reference: 'SIG-INVALID-REVOKED-00109',
      signature_timestamp: new Date('2026-02-15T10:00:00Z'),
      qr_code_payload: 'https://legalmetrology.delhi.gov.in/verify/qr/TOKEN_REVOKED_2026',
    },
  });

  await prisma.certificateStatusEvent.create({
    data: {
      certificate_id: revokedCert.certificate_id,
      previous_status: 'ISSUED',
      new_status: 'REVOKED',
      actor_id: userSupervisor.user_id,
      reason: 'Unauthorized electronic calibration modification detected during surprise inspection under Section 24.',
      statutory_authority_reference: 'Section 24 Revocation Order #REV-DEL-2026-012',
      event_timestamp: new Date('2026-05-18T09:00:00Z'),
    },
  });

  // 5. TOKEN_SUPERSEDED_2025
  await prisma.certificate.upsert({
    where: { certificate_number: 'CERT-2025-DL-00011' },
    update: {},
    create: {
      certificate_id: 'cert-dl-demo-superseded-01',
      certificate_number: 'CERT-2025-DL-00011',
      public_verification_token: 'TOKEN_SUPERSEDED_2025',
      tenant_id: tenant.tenant_id,
      session_id: demoSession.session_id,
      instrument_id: demoInstrument.instrument_id,
      owner_id: publicDemoStakeholder.stakeholder_id,
      procedure_pack_id: 'IND-LM-NAWI-CLASS-III-IIII-2026.1',
      verifier_id: userLmo.user_id,
      signer_id: userLmo.user_id,
      issue_date: new Date('2025-08-20'),
      valid_until: new Date('2026-08-19'),
      certificate_status: 'SUPERSEDED',
      certificate_bytes_sha256: '5561a0c1e18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f1116120555',
      digital_signature_reference: 'SIG-ED25519-DL-2025-LMO-00011',
      signature_timestamp: new Date('2025-08-20T14:00:00Z'),
      qr_code_payload: 'https://legalmetrology.delhi.gov.in/verify/qr/TOKEN_SUPERSEDED_2025',
      superseding_certificate_id: 'cert-dl-demo-valid-01',
    },
  });

  console.log('✓ Seeded Reference Standards & Public QR Fixture Tokens');
  console.log('Legal Metrology DB seeding complete.');
}

if (import.meta.url.endsWith(process.argv[1])) {
  seedDatabase()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
