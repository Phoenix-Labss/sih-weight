import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';

const prisma = new PrismaClient();

export async function seedDatabase() {
  console.log('Seeding Legal Metrology database with demonstration fixtures...');

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
  console.log(`✓ Seeded Tenant: ${tenant.tenant_id} (${tenant.state_name})`);

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
  console.log(`✓ Seeded Jurisdiction: ${jurisdiction.jurisdiction_id} (${jurisdiction.name})`);

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
  console.log(`✓ Seeded Stakeholder & Facility: ${stakeholder.legal_name}, ${facility.facility_name}`);

  // 4. Users
  const userTrader = await prisma.user.upsert({
    where: { email: 'trader@example.com' },
    update: {},
    create: {
      user_id: 'usr-trader-01',
      tenant_id: tenant.tenant_id,
      stakeholder_id: stakeholder.stakeholder_id,
      email: 'trader@example.com',
      full_name: 'Rajesh Kumar',
      role: 'OWNER',
      is_active: true,
    },
  });

  const userLmo = await prisma.user.upsert({
    where: { email: 'lmo.delhi@gov.in' },
    update: {},
    create: {
      user_id: 'lmo-officer-01',
      tenant_id: tenant.tenant_id,
      email: 'lmo.delhi@gov.in',
      full_name: 'Dr. Ramesh Kumar',
      role: 'LMO',
      is_active: true,
    },
  });

  const userSupervisor = await prisma.user.upsert({
    where: { email: 'supervisor.delhi@gov.in' },
    update: {},
    create: {
      user_id: 'sup-officer-01',
      tenant_id: tenant.tenant_id,
      email: 'supervisor.delhi@gov.in',
      full_name: 'Smt. Sunita Sharma',
      role: 'SUPERVISOR',
      is_active: true,
    },
  });

  const userAdmin = await prisma.user.upsert({
    where: { email: 'admin.delhi@gov.in' },
    update: {},
    create: {
      user_id: 'adm-system-01',
      tenant_id: tenant.tenant_id,
      email: 'admin.delhi@gov.in',
      full_name: 'System Administrator',
      role: 'ADMIN',
      is_active: true,
    },
  });
  console.log(`✓ Seeded Users: Trader (${userTrader.user_id}), LMO (${userLmo.user_id}), Supervisor (${userSupervisor.user_id}), Admin (${userAdmin.user_id})`);

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

  // 6. Approved Models
  const model1 = await prisma.instrumentModel.upsert({
    where: { model_approval_number: 'IND-MOD-2024-8842' },
    update: {},
    create: {
      model_id: 'MOD-NAWI-01',
      category: 'NAWI',
      subtype: 'COUNTER_MACHINE_ELECTRONIC',
      manufacturer_name: 'Eagle Metrology Systems Ltd.',
      model_name: 'Eagle Electronic Counter Scale Model E-30',
      model_approval_number: 'IND-MOD-2024-8842',
      accuracy_class: 'CLASS_III',
      verification_scale_interval_e: new Decimal('0.005'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('0.1'),
      max_capacity: new Decimal('30.0'),
      capacity_unit: 'kg',
      number_of_intervals_n: 6000,
      specifications: JSON.stringify({
        load_cell_type: 'Single Point Strain Gauge',
        display_type: 'Dual Green LED',
        pan_dimensions_mm: '300x240',
      }),
      is_active: true,
    },
  });

  const model2 = await prisma.instrumentModel.upsert({
    where: { model_approval_number: 'IND-MOD-2023-4120' },
    update: {},
    create: {
      model_id: 'MOD-NAWI-02',
      category: 'NAWI',
      subtype: 'PRECISION_BALANCE',
      manufacturer_name: 'Mettler Precision India Pvt. Ltd.',
      model_name: 'Mettler High Precision Laboratory Balance',
      model_approval_number: 'IND-MOD-2023-4120',
      accuracy_class: 'CLASS_II',
      verification_scale_interval_e: new Decimal('0.0001'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('0.005'),
      max_capacity: new Decimal('5.0'),
      capacity_unit: 'kg',
      number_of_intervals_n: 50000,
      specifications: JSON.stringify({
        draft_shield: 'Glass Enclosure',
        internal_calibration: 'Automated Motorized Weight',
      }),
      is_active: true,
    },
  });

  const model3 = await prisma.instrumentModel.upsert({
    where: { model_approval_number: 'IND-MOD-2025-9931' },
    update: {},
    create: {
      model_id: 'MOD-NAWI-03',
      category: 'NAWI',
      subtype: 'WEIGHBRIDGE_ELECTRONIC',
      manufacturer_name: 'Avery Heavy Systems India Ltd.',
      model_name: 'Avery Heavy Pitless Weighbridge 50T',
      model_approval_number: 'IND-MOD-2025-9931',
      accuracy_class: 'CLASS_IIII',
      verification_scale_interval_e: new Decimal('10.0'),
      scale_interval_unit: 'kg',
      min_capacity: new Decimal('200.0'),
      max_capacity: new Decimal('50000.0'),
      capacity_unit: 'kg',
      number_of_intervals_n: 5000,
      specifications: JSON.stringify({
        deck_size_meters: '18x3',
        load_cells_count: 8,
      }),
      is_active: true,
    },
  });
  console.log(`✓ Seeded Approved Models: ${model1.model_id}, ${model2.model_id}, ${model3.model_id}`);

  // 7. Registered Instrument
  const instrument = await prisma.instrument.upsert({
    where: { uq_model_serial: { model_id: model1.model_id, serial_number: 'SN-2026-DL-9941' } },
    update: {},
    create: {
      instrument_id: 'inst-dl-001',
      public_instrument_token: 'INST_TOKEN_DL_001',
      tenant_id: tenant.tenant_id,
      jurisdiction_id: jurisdiction.jurisdiction_id,
      model_id: model1.model_id,
      owner_id: stakeholder.stakeholder_id,
      facility_id: facility.facility_id,
      serial_number: 'SN-2026-DL-9941',
      year_of_manufacture: 2024,
      intended_use: 'Retail Supermarket Counter Trade Weighing',
      installation_location_notes: 'Main Checkout Counter 1, Chandni Chowk, Delhi',
      current_status: 'UNVERIFIED',
      verification_due_date: new Date('2026-09-30'),
    },
  });
  console.log(`✓ Seeded Registered Instrument: ${instrument.instrument_id} (${instrument.serial_number})`);

  // 8. Active Verification Application
  const application = await prisma.verificationApplication.upsert({
    where: { application_number: 'APP-2026-DL-00142' },
    update: {},
    create: {
      application_id: 'app-dl-2026-00142',
      application_number: 'APP-2026-DL-00142',
      tenant_id: tenant.tenant_id,
      jurisdiction_id: jurisdiction.jurisdiction_id,
      instrument_id: instrument.instrument_id,
      applicant_id: stakeholder.stakeholder_id,
      application_type: 'INITIAL_VERIFICATION',
      service_mode: 'ON_SITE',
      preferred_verification_date: new Date('2026-08-28'),
      current_status: 'DRAFT',
      applicant_declaration_accepted: true,
      version: 1,
    },
  });
  console.log(`✓ Seeded Verification Application: ${application.application_id} (${application.application_number})`);

  // 9. Reference Standards
  const std1 = await prisma.referenceStandard.upsert({
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

  const std2 = await prisma.referenceStandard.upsert({
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

  const std3 = await prisma.referenceStandard.upsert({
    where: { standard_id: 'STD-MASS-CLASS-M2-003' },
    update: {},
    create: {
      standard_id: 'STD-MASS-CLASS-M2-003',
      tenant_id: tenant.tenant_id,
      custodian_type: 'DEPARTMENTAL_LAB',
      custodian_id: 'LAB-DEL-01',
      asset_tag: 'DL-LM-STD-M2-03',
      denomination_mass: new Decimal('50.0'),
      mass_unit: 'kg',
      accuracy_class: 'M2',
      serial_number: 'SN-M2-2023-101',
      calibration_certificate_number: 'CAL-RRSL-2025-M2-101',
      calibrating_laboratory: 'Regional Reference Standard Laboratory (RRSL Faridabad)',
      calibrated_at: new Date('2025-10-12'),
      valid_until: new Date('2027-10-12'),
      expanded_uncertainty: new Decimal('0.001'),
      calibration_status: 'ACTIVE',
    },
  });
  console.log(`✓ Seeded Reference Standards: ${std1.standard_id}, ${std2.standard_id}, ${std3.standard_id}`);

  // 10. Seed Demonstration Verification Session, Stamps, and Certificates
  // Session for valid certificate
  const demoSession = await prisma.verificationSession.upsert({
    where: { session_id: 'sess-dl-demo-01' },
    update: {},
    create: {
      session_id: 'sess-dl-demo-01',
      tenant_id: tenant.tenant_id,
      application_id: application.application_id,
      instrument_id: instrument.instrument_id,
      procedure_pack_id: 'IND-LM-NAWI-CLASS-III-IIII-2026.1',
      procedure_pack_checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      verifier_id: userLmo.user_id,
      verifier_role: 'LMO',
      scheduled_date: new Date('2026-08-23'),
      actual_test_timestamp: new Date('2026-08-23T11:00:00Z'),
      status: 'FINALIZED',
      automated_evaluation_flag: true,
      outcome: 'VERIFICATION_PASSED_PENDING_AUTHORIZATION',
      officer_disposition_notes: 'Verified strictly within statutory MPE tolerances.',
      finalized_at: new Date('2026-08-23T12:00:00Z'),
    },
  });

  // Physical Stamp for demo session
  await prisma.physicalStampAction.upsert({
    where: { stamp_action_id: 'stamp-dl-demo-01' },
    update: {},
    create: {
      stamp_action_id: 'stamp-dl-demo-01',
      tenant_id: tenant.tenant_id,
      session_id: demoSession.session_id,
      instrument_id: instrument.instrument_id,
      verifier_id: userLmo.user_id,
      action_type: 'SEAL_APPLIED',
      seal_type: 'LEAD_WIRE_SEAL',
      seal_identification_number: 'DL-SEAL-2026-0042',
      seal_position: 'CALIBRATION_PORT_MAIN',
      action_timestamp: new Date('2026-08-23T11:30:00Z'),
      notes: 'Lead wire seal embossed with NCT Delhi LM mark.',
    },
  });

  // 11. Mock Public QR Verification Certificates
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
      instrument_id: instrument.instrument_id,
      owner_id: stakeholder.stakeholder_id,
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
      instrument_id: instrument.instrument_id,
      owner_id: stakeholder.stakeholder_id,
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
      instrument_id: instrument.instrument_id,
      owner_id: stakeholder.stakeholder_id,
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
      instrument_id: instrument.instrument_id,
      owner_id: stakeholder.stakeholder_id,
      procedure_pack_id: 'IND-LM-NAWI-CLASS-III-IIII-2026.1',
      verifier_id: userLmo.user_id,
      signer_id: userLmo.user_id,
      issue_date: new Date('2026-02-15'),
      valid_until: new Date('2027-02-14'),
      certificate_status: 'REVOKED',
      certificate_bytes_sha256: 'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100',
      digital_signature_reference: 'SIG-INVALID-KEY-TAMPERED',
      signature_timestamp: new Date('2026-02-15T09:00:00Z'),
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
      statutory_authority_reference: 'Section 24(4) Order #LM-DEL-REV-2026-012',
      event_timestamp: new Date('2026-05-20T16:00:00Z'),
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
      instrument_id: instrument.instrument_id,
      owner_id: stakeholder.stakeholder_id,
      procedure_pack_id: 'IND-LM-NAWI-CLASS-III-IIII-2026.1',
      verifier_id: userLmo.user_id,
      signer_id: userLmo.user_id,
      issue_date: new Date('2025-08-20'),
      valid_until: new Date('2026-08-19'),
      certificate_status: 'SUPERSEDED',
      certificate_bytes_sha256: 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
      digital_signature_reference: 'SIG-ED25519-DL-2025-LMO-00011',
      signature_timestamp: new Date('2025-08-20T11:00:00Z'),
      qr_code_payload: 'https://legalmetrology.delhi.gov.in/verify/qr/TOKEN_SUPERSEDED_2025',
    },
  });

  console.log('✓ Seeded Mock Public QR Verification Certificates (TOKEN_VALID_2026, TOKEN_EXPIRED_2025, TOKEN_SUSPENDED_2026, TOKEN_REVOKED_2026, TOKEN_SUPERSEDED_2025)');
  console.log('✅ Seeding completed successfully!');
}

if (process.argv[1] && process.argv[1].includes('seed.ts')) {
  seedDatabase()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error('Seeding error:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
