import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const roles = [
  ['SUPER_ADMIN', 'Super Admin'], ['DIRECTOR', 'Director'], ['ADMIN', 'Admin'], ['SALES_MANAGER', 'Sales Manager'], ['SALES_EXECUTIVE', 'Sales Executive'], ['CRM_EXECUTIVE', 'CRM Executive'], ['MARKETING_MANAGER', 'Marketing Manager'], ['ACCOUNTS_MANAGER', 'Accounts Manager'], ['ACCOUNTANT', 'Accountant'], ['SITE_ENGINEER', 'Site Engineer'], ['CONSTRUCTION_MANAGER', 'Construction Manager'], ['HR_MANAGER', 'HR Manager'], ['EMPLOYEE', 'Employee'], ['VENDOR_MANAGER', 'Vendor Manager'], ['CUSTOMER_SUPPORT', 'Customer Support'], ['RECEPTIONIST', 'Receptionist'], ['CUSTOMER', 'Customer'], ['ADMINISTRATOR', 'Administrator'], ['MANAGER', 'Manager'], ['RECEPTION', 'Reception']
] as const;
const permissions = ['dashboard.view', 'leads.view', 'leads.create', 'leads.edit', 'leads.assign', 'customers.view', 'customers.create', 'customers.edit', 'settings.manage'];
async function main() {
  for (const [code, name] of roles) await prisma.role.upsert({ where: { code }, update: { name }, create: { code, name } });
  for (const code of permissions) await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
  const passwordHash = await bcrypt.hash('ChangeMe@123', 12);
  const admin = await prisma.user.upsert({ where: { email: 'admin@rrpl.local' }, update: {}, create: { email: 'admin@rrpl.local', passwordHash, forcePasswordChange: true } });
  const role = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMINISTRATOR' } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: admin.id, roleId: role.id } }, update: {}, create: { userId: admin.id, roleId: role.id } });
  for (const permission of await prisma.permission.findMany()) await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, update: {}, create: { roleId: role.id, permissionId: permission.id } });
  await prisma.employee.upsert({ where: { userId: admin.id }, update: {}, create: { userId: admin.id, employeeCode: 'RRPL-001', fullName: 'RRPL Administrator', phone: '9000000000', department: 'Administration', designation: 'System Administrator', joiningDate: new Date('2025-01-01') } });
  console.log('Development seed complete. Default admin: admin@rrpl.local');
}
main().finally(() => prisma.$disconnect());
