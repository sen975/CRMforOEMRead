import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

const permissions = [
  ["customers.read", "View customers"],
  ["customers.write", "Create and update customers"],
  ["customers.assign", "Assign customers"],
  ["research.generate", "Generate research reports"],
  ["website.analyze", "Analyze customer websites"],
  ["emails.generate", "Generate email drafts"],
  ["emails.approve", "Approve email drafts"],
  ["emails.send", "Send approved emails"],
  ["knowledge.write", "Maintain company knowledge base"],
  ["dashboards.personal", "View personal dashboards"],
  ["dashboards.team", "View team dashboards"],
  ["dashboards.management", "View management dashboards"],
  ["settings.manage", "Manage system settings"]
];

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: "default-org" },
    update: {},
    create: {
      id: "default-org",
      name: "OEM CRM Demo Organization"
    }
  });

  const team = await prisma.team.upsert({
    where: { id: "default-sales-team" },
    update: {},
    create: {
      id: "default-sales-team",
      organizationId: organization.id,
      name: "Sales Team"
    }
  });

  const createdPermissions = await Promise.all(
    permissions.map(([code, name]) =>
      prisma.permission.upsert({
        where: { organizationId_code: { organizationId: organization.id, code } },
        update: { name },
        create: { organizationId: organization.id, code, name }
      })
    )
  );

  const roleDefinitions = [
    { code: "ADMIN", name: "系统管理员", dataScope: "ALL", permissionCodes: permissions.map(([code]) => code) },
    {
      code: "SALES_MANAGER",
      name: "销售主管",
      dataScope: "TEAM",
      permissionCodes: [
        "customers.read",
        "customers.write",
        "customers.assign",
        "research.generate",
        "website.analyze",
        "emails.generate",
        "emails.approve",
        "emails.send",
        "dashboards.personal",
        "dashboards.team"
      ]
    },
    {
      code: "SALES_REP",
      name: "业务员",
      dataScope: "SELF",
      permissionCodes: ["customers.read", "customers.write", "research.generate", "website.analyze", "emails.generate", "emails.send", "dashboards.personal"]
    },
    {
      code: "OPERATOR",
      name: "运营人员",
      dataScope: "ALL",
      permissionCodes: ["knowledge.write", "customers.read"]
    },
    {
      code: "EXECUTIVE",
      name: "管理层",
      dataScope: "ALL",
      permissionCodes: ["customers.read", "dashboards.personal", "dashboards.team", "dashboards.management"]
    }
  ] as const;

  for (const definition of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: definition.code } },
      update: { name: definition.name, dataScope: definition.dataScope },
      create: {
        organizationId: organization.id,
        code: definition.code,
        name: definition.name,
        dataScope: definition.dataScope
      }
    });

    const permissionCodeSet = new Set<string>(definition.permissionCodes);
    const permissionIds = createdPermissions
      .filter((permission) => permissionCodeSet.has(permission.code))
      .map((permission) => permission.id);

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { organizationId_code: { organizationId: organization.id, code: "ADMIN" } }
  });
  const admin = await prisma.user.upsert({
    where: { email: "admin@oem-crm.local" },
    update: {},
    create: {
      organizationId: organization.id,
      teamId: team.id,
      email: "admin@oem-crm.local",
      name: "System Admin",
      passwordHash: await bcrypt.hash("Admin@123456", 10)
    }
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id }
  });

  const sourceSeeds = [
    ["手动录入", "Manual customer entry"],
    ["线下", "Offline lead or existing offline customer"],
    ["Google搜索", "Customers found through Google search"],
    ["LinkedIn", "Customers found through LinkedIn"],
    ["展会", "Trade show leads"],
    ["阿里国际站", "Alibaba international leads"],
    ["老客推荐", "Customer referral"],
    ["行业名录", "Industry directory"]
  ];
  for (const [name, description] of sourceSeeds) {
    await prisma.customerSource.upsert({
      where: { organizationId_name: { organizationId: organization.id, name } },
      update: { description, isActive: true },
      create: { organizationId: organization.id, name, description }
    });
  }

  const typeSeeds = [
    ["品牌商", "Brand owner"],
    ["最终客户", "End customer"],
    ["代理商", "Agent or buying representative"],
    ["批发商", "Wholesaler"],
    ["分销商", "Distributor"],
    ["零售商", "Retailer"],
    ["跨境电商", "Cross-border ecommerce"],
    ["采购商", "Procurement buyer"],
    ["OEM/ODM Target", "General OEM/ODM target"]
  ];
  for (const [name, description] of typeSeeds) {
    await prisma.customerType.upsert({
      where: { organizationId_name: { organizationId: organization.id, name } },
      update: { description, isActive: true },
      create: { organizationId: organization.id, name, description }
    });
  }

  await prisma.companyProfile.upsert({
    where: { id: "default-company-profile" },
    update: {},
    create: {
      id: "default-company-profile",
      organizationId: organization.id,
      legalName: "Demo Manufacturing Co., Ltd.",
      displayName: "Demo Manufacturing",
      summary: "Private deployment seed profile for OEM/ODM development."
    }
  });

  console.log("Seed completed. Login with admin@oem-crm.local / Admin@123456");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
