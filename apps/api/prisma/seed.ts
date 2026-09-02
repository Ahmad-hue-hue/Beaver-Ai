/**
 * Beaver demo seed — an idempotent, runnable dataset so every screen
 * (dashboard, reports, notifications, AI insights, POS, cash, debts) has
 * realistic data out of the box.
 *
 *   bun --filter api db:seed
 *
 * Uses direct Prisma writes (not the Nest services) so it needs no running app and
 * has no side effects beyond the rows it owns. Idempotent: safe to run repeatedly.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const DEMO_OWNER_EMAIL = 'demo@beaver.local';
const DEMO_OWNER_PASSWORD = 'demo1234';
const BUSINESS_NAME = 'Acme Duka';
const SERVICE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

const dec = (v: number) => new Prisma.Decimal(String(v));
const daysAgo = (n: number, h = 12) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, 0, 0, 0);
  return d;
};

async function main() {
  const existing = await prisma.business.findFirst({
    where: { name: BUSINESS_NAME },
    include: {
      memberships: {
        where: { role: 'OWNER' },
        include: { user: true },
        take: 1,
      },
    },
  });
  if (existing) {
    const owner = existing.memberships[0]?.user;
    if (owner && !owner.approvedAt) {
      const now = new Date();
      await prisma.user.update({
        where: { id: owner.id },
        data: {
          approvedAt: now,
          serviceExpiresAt: new Date(now.getTime() + SERVICE_MONTH_MS),
        },
      });
      console.log(`Demo owner ${DEMO_OWNER_EMAIL} patched with active subscription.`);
    } else {
      console.log(`Demo business "${BUSINESS_NAME}" already exists — nothing to do.`);
    }
    return;
  }

  // ── Owner account (pre-approved with an active month so demo login works) ──
  const ownerPasswordHash = await argon2.hash(DEMO_OWNER_PASSWORD, { type: argon2.argon2id });
  const now = new Date();
  const owner = await prisma.user.create({
    data: {
      name: 'Demo Owner',
      email: DEMO_OWNER_EMAIL,
      passwordHash: ownerPasswordHash,
      approvedAt: now,
      serviceExpiresAt: new Date(now.getTime() + SERVICE_MONTH_MS),
    },
  });

  // ── Business + settings + branch ──
  const business = await prisma.business.create({
    data: {
      name: BUSINESS_NAME,
      type: 'RETAIL',
      country: 'TZ',
      currency: 'TZS',
      phone: '+255 700 000 000',
      address: 'Soko Matu, Dar es Salaam',
      openingDate: daysAgo(120),
      settings: {
        create: { defaultPaymentMethods: ['CASH', 'MOBILE_MONEY'], receiptFooter: 'Asante kwa kununua!' },
      },
      branches: { create: { name: 'Main store', isPrimary: true } },
      memberships: {
        create: {
          userId: owner.id,
          role: 'OWNER',
          status: 'ACTIVE',
        },
      },
    },
    include: { memberships: true },
  });

  // ── Categories & units ──
  const categoryDrinks = await prisma.category.create({ data: { businessId: business.id, name: 'Drinks' } });
  const categoryFood = await prisma.category.create({ data: { businessId: business.id, name: 'Food & staples' } });
  const unitPc = await prisma.unit.create({ data: { businessId: business.id, name: 'Piece', abbreviation: 'pc' } });
  const unitKg = await prisma.unit.create({ data: { businessId: business.id, name: 'Kilogram', abbreviation: 'kg', allowsDecimal: true } });

  // ── Products (with opening stock) ──
  const productsData = [
    { name: 'Coca-Cola 500ml', categoryId: categoryDrinks.id, unitId: unitPc.id, costPrice: 1600, sellingPrice: 2500, stock: 48, reorder: 20 },
    { name: 'Bottled water 1.5L', categoryId: categoryDrinks.id, unitId: unitPc.id, costPrice: 800, sellingPrice: 1200, stock: 12, reorder: 24 },
    { name: 'Rice 1kg (Mageuzi)', categoryId: categoryFood.id, unitId: unitKg.id, costPrice: 2400, sellingPrice: 3200, stock: 60, reorder: 25 },
    { name: 'Cooking oil 1L', categoryId: categoryFood.id, unitId: unitPc.id, costPrice: 5500, sellingPrice: 7000, stock: 18, reorder: 30 },
    { name: 'Sugar 1kg', categoryId: categoryFood.id, unitId: unitKg.id, costPrice: 2600, sellingPrice: 3400, stock: 40, reorder: 15 },
    { name: 'Maize flour 2kg', categoryId: categoryFood.id, unitId: unitKg.id, costPrice: 4200, sellingPrice: 5600, stock: 8, reorder: 20 },
  ];

  const products: Record<string, { id: string; costPrice: Prisma.Decimal; sellingPrice: Prisma.Decimal }> = {};
  for (const p of productsData) {
    const product = await prisma.product.create({
      data: {
        businessId: business.id,
        categoryId: p.categoryId,
        unitId: p.unitId,
        name: p.name,
        sku: `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        costPrice: dec(p.costPrice),
        sellingPrice: dec(p.sellingPrice),
        trackInventory: true,
        stockQuantity: dec(p.stock),
        reorderLevel: dec(p.reorder),
      },
    });
    await prisma.inventoryMovement.create({
      data: {
        businessId: business.id,
        productId: product.id,
        type: 'OPENING',
        quantity: dec(p.stock),
        balanceAfter: dec(p.stock),
        unitCost: dec(p.costPrice),
        reason: 'Opening stock (seed)',
        userId: owner.id,
      },
    });
    products[p.name] = { id: product.id, costPrice: dec(p.costPrice), sellingPrice: dec(p.sellingPrice) };
  }

  // ── Supplier & purchases (received) ──
  const supplier = await prisma.supplier.create({
    data: { businessId: business.id, name: 'Kilimanjaro Wholesalers', phone: '+255 755 111 222' },
  });
  const purchaseRef1 = `PUR-${daysAgo(6).toISOString().slice(0, 10).replace(/-/g, '')}-001`;
  await prisma.purchase.create({
    data: {
      businessId: business.id,
      reference: purchaseRef1,
      supplierId: supplier.id,
      supplierName: supplier.name,
      status: 'RECEIVED',
      orderDate: daysAgo(6),
      receivedAt: daysAgo(6),
      receivedById: owner.id,
      subtotal: dec(5 * 5500 + 60 * 2400 + 40 * 2600),
      discountTotal: dec(0),
      taxTotal: dec(0),
      total: dec(5 * 5500 + 60 * 2400 + 40 * 2600),
      paidTotal: dec(5 * 5500 + 60 * 2400 + 40 * 2600),
      balanceDue: dec(0),
      items: {
        create: [
          { businessId: business.id, productId: products['Cooking oil 1L']!.id, nameSnapshot: 'Cooking oil 1L', quantity: dec(5), unitCost: dec(5500), lineTotal: dec(5 * 5500) },
          { businessId: business.id, productId: products['Rice 1kg (Mageuzi)']!.id, nameSnapshot: 'Rice 1kg (Mageuzi)', quantity: dec(60), unitCost: dec(2400), lineTotal: dec(60 * 2400) },
          { businessId: business.id, productId: products['Sugar 1kg']!.id, nameSnapshot: 'Sugar 1kg', quantity: dec(40), unitCost: dec(2600), lineTotal: dec(40 * 2600) },
        ],
      },
    },
  });

  // ── Customer (gets a small credit debt) ──
  const customer = await prisma.customer.create({
    data: {
      businessId: business.id,
      name: 'Zawadi Fundi',
      phone: '+255 713 333 444',
      balance: dec(6500),
      creditLimit: dec(100000),
    },
  });

  // ── Sales (a couple per day over the last ~8 days, one credit) ──
  const saleDays = [7, 5, 3, 1];
  const baskets: Array<[string, number][]> = [
    [['Coca-Cola 500ml', 3], ['Rice 1kg (Mageuzi)', 2], ['Sugar 1kg', 1]],
    [['Bottled water 1.5L', 4], ['Cooking oil 1L', 2]],
    [['Maize flour 2kg', 3], ['Coca-Cola 500ml', 2], ['Bottled water 1.5L', 2]],
    [['Rice 1kg (Mageuzi)', 5], ['Cooking oil 1L', 1], ['Sugar 1kg', 2]],
  ];

  for (let i = 0; i < saleDays.length; i++) {
    const daysAgoN = saleDays[i]!;
    const day = daysAgo(daysAgoN);
    const basket = baskets[i]!;
    const items = basket.map(([name, qty]) => {
      const p = products[name]!;
      const unitPrice = p.sellingPrice;
      return {
        businessId: business.id,
        productId: p.id,
        nameSnapshot: name,
        quantity: dec(qty),
        unitPrice,
        lineTotal: unitPrice.mul(qty),
        costSnapshot: p.costPrice.mul(qty),
      };
    });
    const subtotal = items.reduce((s, it) => s.plus(it.lineTotal), dec(0));
    const isCredit = i === 3; // last basket goes partly on credit
    const paid = isCredit ? subtotal.minus(dec(6500)) : subtotal;
    const balanceDue = isCredit ? dec(6500) : dec(0);

    const refNo = `SALE-${day.toISOString().slice(0, 10).replace(/-/g, '')}-00${i + 1}`;
    const sale = await prisma.sale.create({
      data: {
        businessId: business.id,
        reference: refNo,
        cashierId: owner.id,
        status: 'COMPLETED',
        subtotal,
        discountTotal: dec(0),
        taxTotal: dec(0),
        total: subtotal,
        paidTotal: paid,
        balanceDue,
        soldAt: day,
        items: { create: items.map((it) => ({ ...it, lineTotal: it.lineTotal })) },
        payments: isCredit
          ? { create: [{ businessId: business.id, method: 'MOBILE_MONEY', amount: paid }] }
          : { create: [{ businessId: business.id, method: 'CASH', amount: paid }] },
      },
      include: { items: true },
    });

    // Decrement stock + record movements + debt ledger
    for (const it of sale.items) {
      const product = await prisma.product.findUniqueOrThrow({ where: { id: it.productId } });
      const next = product.stockQuantity.minus(it.quantity);
      await prisma.product.update({ where: { id: it.productId }, data: { stockQuantity: next } });
      await prisma.inventoryMovement.create({
        data: {
          businessId: business.id,
          productId: it.productId,
          type: 'SALE',
          quantity: it.quantity.negated(),
          balanceAfter: next,
          sourceType: 'Sale',
          sourceId: sale.id,
          userId: owner.id,
        },
      });
    }

    if (isCredit) {
      const newBal = dec(6500);
      await prisma.customerDebtTransaction.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          type: 'SALE_CREDIT',
          amount: dec(6500),
          balanceAfter: newBal,
          sourceType: 'Sale',
          sourceId: sale.id,
          note: `Credit from ${refNo}`,
        },
      });
    }
  }

  // ── Expenses ──
  await prisma.expense.create({
    data: {
      businessId: business.id,
      reference: `EXP-${daysAgo(10).toISOString().slice(0, 10).replace(/-/g, '')}-001`,
      category: 'RENT',
      amount: dec(300000),
      method: 'CASH',
      payee: 'Landlord',
      paidAt: daysAgo(10),
      note: 'Monthly stall rent',
    },
  });
  await prisma.expense.create({
    data: {
      businessId: business.id,
      reference: `EXP-${daysAgo(2).toISOString().slice(0, 10).replace(/-/g, '')}-001`,
      category: 'UTILITIES',
      amount: dec(25000),
      method: 'CASH',
      payee: 'TANESCO',
      paidAt: daysAgo(2),
    },
  });

  // ── Open cash session (so Cash / till is live) ──
  await prisma.cashSession.create({
    data: {
      businessId: business.id,
      reference: `TILL-${daysAgo(0).toISOString().slice(0, 10).replace(/-/g, '')}-001`,
      status: 'OPEN',
      openedBy: owner.id,
      openingBalance: dec(200000),
    },
  });

  console.log(`
Demo business seeded successfully.

  Business: ${BUSINESS_NAME}
  Owner login: ${DEMO_OWNER_EMAIL} / ${DEMO_OWNER_PASSWORD}

Created: 2 categories, 2 units, 6 products (with stock), 1 supplier + purchase,
1 customer (with credit debt), 4 sales across recent days, 2 expenses, 1 open till.
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
