import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Test Tenant',
      email: 'tenant@example.com',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Tenant created:', tenant.id);

  // Create locations
  const location1 = await prisma.location.create({
    data: {
      name: 'Main Warehouse',
      address: '123 Main St',
      city: 'New York',
      state: 'NY',
      country: 'USA',
      type: 'WAREHOUSE',
      status: 'ACTIVE',
      tenantId: tenant.id,
    },
  });

  const location2 = await prisma.location.create({
    data: {
      name: 'Store 1',
      address: '456 Oak Ave',
      city: 'Boston',
      state: 'MA',
      country: 'USA',
      type: 'STORE',
      status: 'ACTIVE',
      tenantId: tenant.id,
    },
  });

  console.log('✅ Locations created:', location1.id, location2.id);

  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      passwordHash: await bcryptjs.hash('Password123!', 12),
      firstName: 'Admin',
      lastName: 'User',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      tenantId: tenant.id,
    },
  });

  console.log('✅ Admin user created:', adminUser.id);

  // Create store manager user
  const storeManagerUser = await prisma.user.create({
    data: {
      email: 'manager@example.com',
      passwordHash: await bcryptjs.hash('Password123!', 12),
      firstName: 'Store',
      lastName: 'Manager',
      role: 'STORE_MANAGER',
      status: 'ACTIVE',
      tenantId: tenant.id,
    },
  });

  console.log('✅ Store manager user created:', storeManagerUser.id);

  // Create products
  const product1 = await prisma.product.create({
    data: {
      name: 'Laptop',
      description: 'High-performance laptop',
      sku: 'LAPTOP-001',
      barcode: '1234567890123',
      category: 'Electronics',
      price: 999.99,
      costPrice: 500.00,
      unit: 'piece',
      reorderPoint: 5,
      status: 'ACTIVE',
      tenantId: tenant.id,
    },
  });

  const product2 = await prisma.product.create({
    data: {
      name: 'Mouse',
      description: 'Wireless mouse',
      sku: 'MOUSE-001',
      barcode: '1234567890124',
      category: 'Accessories',
      price: 29.99,
      costPrice: 10.00,
      unit: 'piece',
      reorderPoint: 20,
      status: 'ACTIVE',
      tenantId: tenant.id,
    },
  });

  console.log('✅ Products created:', product1.id, product2.id);

  // Create inventory records
  await prisma.inventory.createMany({
    data: [
      {
        quantity: 10,
        reservedQuantity: 0,
        availableQuantity: 10,
        productId: product1.id,
        locationId: location1.id,
      },
      {
        quantity: 5,
        reservedQuantity: 0,
        availableQuantity: 5,
        productId: product1.id,
        locationId: location2.id,
      },
      {
        quantity: 50,
        reservedQuantity: 0,
        availableQuantity: 50,
        productId: product2.id,
        locationId: location1.id,
      },
      {
        quantity: 30,
        reservedQuantity: 0,
        availableQuantity: 30,
        productId: product2.id,
        locationId: location2.id,
      },
    ],
  });

  console.log('✅ Inventory records created');

  console.log('🎉 Seeding completed successfully!');
  console.log('\n📝 Test Credentials:');
  console.log(`   Tenant ID: ${tenant.id}`);
  console.log(`   Admin Email: admin@example.com`);
  console.log(`   Admin Password: Password123!`);
  console.log(`   Manager Email: manager@example.com`);
  console.log(`   Manager Password: Password123!`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
