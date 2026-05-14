import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Check if already seeded
  let tenant = await prisma.tenant.findFirst({ where: { name: 'Demo Tenant' } });

  if (tenant) {
    console.log(`⏩ Tenant '${tenant.name}' already exists, checking users...`);

    // Ensure super admin exists (idempotent) - super admin has NO tenant
    const superAdmin = await prisma.user.findFirst({ where: { email: 'superadmin@leanstock.com' } });
    if (!superAdmin) {
      const superAdminHash = await bcrypt.hash('SuperAdmin123!', 12);
      await prisma.user.create({
        data: {
          email: 'superadmin@leanstock.com',
          passwordHash: superAdminHash,
          firstName: 'Super',
          lastName: 'Admin',
          role: UserRole.SUPER_ADMIN,
          tenantId: null,
          isActive: true,
          emailVerified: true,
        },
      });
      console.log('✅ Created super admin: superadmin@leanstock.com');
    } else {
      console.log('⏩ Super admin already exists');
    }

    const adminUser = await prisma.user.findFirst({ where: { email: 'admin@demo.com', tenantId: tenant.id } });
    if (!adminUser) {
      const adminPasswordHash = await bcrypt.hash('Admin@123456', 12);
      await prisma.user.create({
        data: {
          email: 'admin@demo.com',
          passwordHash: adminPasswordHash,
          firstName: 'Admin',
          lastName: 'User',
          role: UserRole.TENANT_ADMIN,
          tenantId: tenant.id,
          isActive: true,
          emailVerified: true,
        },
      });
      console.log('✅ Created admin user: admin@demo.com');
    } else {
      console.log('⏩ Admin user already exists');
    }

    const storeUser = await prisma.user.findFirst({ where: { email: 'store@demo.com', tenantId: tenant.id } });
    if (!storeUser) {
      const storePasswordHash = await bcrypt.hash('Store@123456', 12);
      await prisma.user.create({
        data: {
          email: 'store@demo.com',
          passwordHash: storePasswordHash,
          firstName: 'Store',
          lastName: 'Associate',
          role: UserRole.STORE_ASSOCIATE,
          tenantId: tenant.id,
          isActive: true,
          emailVerified: true,
        },
      });
      console.log('✅ Created store user: store@demo.com');
    } else {
      console.log('⏩ Store user already exists');
    }

    console.log('✅ Seed check complete');
    return;
  }

  // Fresh seed — create everything
  tenant = await prisma.tenant.create({
    data: { name: 'Demo Tenant' },
  });
  console.log(`✅ Created tenant: ${tenant.name}`);

  // Create super admin - super admin has NO tenant
  const superAdminHash = await bcrypt.hash('SuperAdmin123!', 12);
  await prisma.user.create({
    data: {
      email: 'superadmin@leanstock.com',
      passwordHash: superAdminHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.SUPER_ADMIN,
      tenantId: null,
      isActive: true,
      emailVerified: true,
    },
  });
  console.log('✅ Created super admin: superadmin@leanstock.com');

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('Admin@123456', 12);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@demo.com',
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.TENANT_ADMIN,
      tenantId: tenant.id,
      isActive: true,
      emailVerified: true,
    },
  });
  console.log(`✅ Created admin user: ${adminUser.email}`);

  // Create store associate user
  const storePasswordHash = await bcrypt.hash('Store@123456', 12);
  const storeUser = await prisma.user.create({
    data: {
      email: 'store@demo.com',
      passwordHash: storePasswordHash,
      firstName: 'Store',
      lastName: 'Associate',
      role: UserRole.STORE_ASSOCIATE,
      tenantId: tenant.id,
      isActive: true,
      emailVerified: true,
    },
  });
  console.log(`✅ Created store user: ${storeUser.email}`);

  // Create locations
  const warehouse = await prisma.location.create({
    data: {
      tenantId: tenant.id,
      name: 'Main Warehouse',
      type: 'warehouse',
      address: '123 Industrial Ave',
    },
  });
  console.log(`✅ Created location: ${warehouse.name}`);

  const store = await prisma.location.create({
    data: {
      tenantId: tenant.id,
      name: 'Downtown Store',
      type: 'store',
      address: '456 Main St',
    },
  });
  console.log(`✅ Created location: ${store.name}`);

  // Create bin locations
  const bin1 = await prisma.binLocation.create({
    data: {
      locationId: warehouse.id,
      binCode: 'A-001',
      capacity: 100,
    },
  });
  console.log(`✅ Created bin location: ${bin1.binCode}`);

  // Create products
  const product1 = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: 'SKU-001',
      name: 'Product A',
      description: 'Sample product A',
      baseCost: 20.00,
      retailPrice: 29.99,
      weight: 1.5,
    },
  });
  console.log(`✅ Created product: ${product1.sku}`);

  const product2 = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      sku: 'SKU-002',
      name: 'Product B',
      description: 'Sample product B',
      baseCost: 35.00,
      retailPrice: 49.99,
      weight: 2.0,
    },
  });
  console.log(`✅ Created product: ${product2.sku}`);

  // Create inventory records
  const inventory1 = await prisma.inventory.create({
    data: {
      tenantId: tenant.id,
      productId: product1.id,
      locationId: warehouse.id,
      quantity: 100,
      reservedQuantity: 0,
    },
  });
  console.log(`✅ Created inventory record for ${product1.sku}`);

  const inventory2 = await prisma.inventory.create({
    data: {
      tenantId: tenant.id,
      productId: product2.id,
      locationId: warehouse.id,
      quantity: 50,
      reservedQuantity: 0,
    },
  });
  console.log(`✅ Created inventory record for ${product2.sku}`);

  // Create supplier
  const supplier = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      name: 'Demo Supplier',
      email: 'supplier@demo.com',
      phone: '+1234567890',
      address: '789 Supply Ln',
    },
  });
  console.log(`✅ Created supplier: ${supplier.name}`);

  // Create supplier products
  await prisma.supplierProduct.create({
    data: {
      supplierId: supplier.id,
      productId: product1.id,
      supplierSku: 'SUP-SKU-001',
      price: 15.00,
      leadTimeDays: 7,
    },
  });
  console.log(`✅ Created supplier product mapping`);

  // Create reorder points
  await prisma.reorderPoint.create({
    data: {
      tenantId: tenant.id,
      productId: product1.id,
      locationId: warehouse.id,
      minQuantity: 20,
      maxQuantity: 200,
    },
  });
  console.log(`✅ Created reorder point`);

  // Create dead stock rules
  await prisma.deadStockRule.create({
    data: {
      tenantId: tenant.id,
      name: 'Over 6 months without movement',
      daysThreshold: 180,
      isActive: true,
    },
  });
  console.log(`✅ Created dead stock rule`);

  console.log('\n✨ Database seeded successfully!');
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
