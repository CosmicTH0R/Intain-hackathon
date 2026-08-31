import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Seed users
  const users = [
    { name: 'Alice Operator', email: 'operator@demo.com', role: 'data_operator', password: 'operator123' },
    { name: 'Bob Reviewer', email: 'reviewer@demo.com', role: 'reviewer', password: 'reviewer123' },
    { name: 'Carol Consumer', email: 'consumer@demo.com', role: 'data_consumer', password: 'consumer123' },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, role: u.role, passwordHash },
    });
  }
  console.log('✅ Users seeded');

  // Seed validation rules
  const rules = [
    {
      name: 'required_fields',
      description: 'Required fields must be present: loan_id, borrower_id, origination_date, original_principal',
      type: 'completeness',
      severity: 'critical',
      configJson: JSON.stringify({ requiredFields: ['loan_id', 'borrower_id', 'origination_date', 'original_principal'] }),
    },
    {
      name: 'valid_date_formats',
      description: 'Date fields must be parseable ISO dates',
      type: 'format',
      severity: 'high',
      configJson: JSON.stringify({ dateFields: ['origination_date', 'maturity_date', 'last_payment_date', 'last_updated_at'] }),
    },
    {
      name: 'maturity_after_origination',
      description: 'Maturity date must be after origination date',
      type: 'consistency',
      severity: 'high',
      configJson: JSON.stringify({}),
    },
    {
      name: 'no_negative_balance',
      description: 'original_principal and current_balance must be non-negative',
      type: 'range',
      severity: 'high',
      configJson: JSON.stringify({}),
    },
    {
      name: 'balance_leq_principal',
      description: 'current_balance must not exceed original_principal',
      type: 'consistency',
      severity: 'medium',
      configJson: JSON.stringify({}),
    },
    {
      name: 'interest_rate_range',
      description: 'interest_rate must be within expected range (0-25%)',
      type: 'range',
      severity: 'medium',
      configJson: JSON.stringify({ min: 0, max: 25 }),
    },
    {
      name: 'valid_payment_status',
      description: 'payment_status must be one of: current, delinquent, default, closed, foreclosure',
      type: 'enum',
      severity: 'high',
      configJson: JSON.stringify({ validValues: ['current', 'delinquent', 'default', 'closed', 'foreclosure'] }),
    },
    {
      name: 'payment_status_vs_dpd',
      description: 'payment_status must be consistent with days_past_due',
      type: 'consistency',
      severity: 'high',
      configJson: JSON.stringify({ currentMaxDpd: 0 }),
    },
    {
      name: 'document_status_check',
      description: 'document_status should match document_manifest.csv',
      type: 'cross_file',
      severity: 'medium',
      configJson: JSON.stringify({}),
    },
    {
      name: 'duplicate_loan_id',
      description: 'loan_id must be unique across the dataset',
      type: 'uniqueness',
      severity: 'critical',
      configJson: JSON.stringify({}),
    },
    {
      name: 'duplicate_borrower_combo',
      description: 'Duplicate borrower_id + original_principal + origination_date combination',
      type: 'uniqueness',
      severity: 'high',
      configJson: JSON.stringify({}),
    },
    {
      name: 'valid_state_code',
      description: 'borrower_state must be a valid US state code',
      type: 'enum',
      severity: 'medium',
      configJson: JSON.stringify({}),
    },
    {
      name: 'stale_record',
      description: 'Records not updated in N days are flagged as stale',
      type: 'timeliness',
      severity: 'low',
      configJson: JSON.stringify({ maxAgeDays: 90 }),
    },
    {
      name: 'servicer_conflict',
      description: 'Field conflicts between loan_tape.csv and servicer_update.csv',
      type: 'cross_file',
      severity: 'high',
      configJson: JSON.stringify({}),
    },
    {
      name: 'closed_with_balance',
      description: 'Closed loans must not have a positive current_balance',
      type: 'consistency',
      severity: 'high',
      configJson: JSON.stringify({}),
    },
    {
      name: 'repeated_borrower',
      description: 'Same borrower_id appearing suspiciously often (threshold: 3+)',
      type: 'anomaly',
      severity: 'medium',
      configJson: JSON.stringify({ threshold: 3 }),
    },
  ];

  for (const rule of rules) {
    await prisma.validationRule.upsert({
      where: { name: rule.name },
      update: {},
      create: rule,
    });
  }
  console.log('✅ Validation rules seeded');
  console.log('🎉 Seeding complete!');
  console.log('\n📋 Test Credentials:');
  console.log('  Data Operator: operator@demo.com / operator123');
  console.log('  Reviewer:      reviewer@demo.com / reviewer123');
  console.log('  Data Consumer: consumer@demo.com / consumer123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
