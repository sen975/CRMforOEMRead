import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { RequestUser } from "../../common/auth/current-user.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { UpsertKnowledgeDto } from "./dto/upsert-knowledge.dto";

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  getCompanyProfile(user: RequestUser) {
    return this.prisma.companyProfile.findFirst({
      where: { organizationId: user.organizationId },
      include: {
        brands: true,
        capabilities: true,
        products: true,
        certificates: true,
        caseStudies: true,
        emailMaterials: true
      }
    });
  }

  async upsertCompanyProfile(user: RequestUser, dto: UpsertKnowledgeDto) {
    const existing = await this.prisma.companyProfile.findFirst({
      where: { organizationId: user.organizationId }
    });
    if (!existing) {
      return this.prisma.companyProfile.create({
        data: {
          organizationId: user.organizationId,
          legalName: dto.legalName ?? dto.name ?? "Company",
          displayName: dto.displayName ?? dto.name ?? "Company",
          websiteUrl: dto.websiteUrl,
          summary: dto.summary,
          markets: dto.markets ?? []
        }
      });
    }
    return this.prisma.companyProfile.update({
      where: { id: existing.id },
      data: {
        legalName: dto.legalName,
        displayName: dto.displayName,
        websiteUrl: dto.websiteUrl,
        summary: dto.summary,
        markets: dto.markets
      }
    });
  }

  async listBrands(user: RequestUser) {
    const profile = await this.ensureProfile(user);
    return this.prisma.brand.findMany({ where: { companyProfileId: profile.id }, orderBy: { updatedAt: "desc" } });
  }

  async createBrand(user: RequestUser, dto: UpsertKnowledgeDto) {
    const profile = await this.ensureProfile(user);
    return this.prisma.brand.create({
      data: {
        companyProfileId: profile.id,
        name: requireField(dto.name, "name"),
        positioning: dto.positioning,
        targetMarkets: dto.targetMarkets ?? []
      }
    });
  }

  async listProducts(user: RequestUser) {
    const profile = await this.ensureProfile(user);
    return this.prisma.product.findMany({ where: { companyProfileId: profile.id }, orderBy: { updatedAt: "desc" } });
  }

  async createProduct(user: RequestUser, dto: UpsertKnowledgeDto) {
    const profile = await this.ensureProfile(user);
    return this.prisma.product.create({
      data: {
        companyProfileId: profile.id,
        sku: dto.sku,
        name: requireField(dto.name, "name"),
        category: requireField(dto.category, "category"),
        description: dto.description,
        priceMin: dto.priceMin as never,
        priceMax: dto.priceMax as never,
        currency: dto.currency,
        tags: dto.tags ?? []
      }
    });
  }

  async listCapabilities(user: RequestUser) {
    const profile = await this.ensureProfile(user);
    return this.prisma.oemCapability.findMany({ where: { companyProfileId: profile.id }, orderBy: { updatedAt: "desc" } });
  }

  async createCapability(user: RequestUser, dto: UpsertKnowledgeDto) {
    const profile = await this.ensureProfile(user);
    return this.prisma.oemCapability.create({
      data: {
        companyProfileId: profile.id,
        name: requireField(dto.name, "name"),
        category: requireField(dto.category, "category"),
        description: dto.description,
        moq: dto.moq,
        leadTime: dto.leadTime,
        certifications: dto.certifications ?? [],
        supportedMarkets: dto.supportedMarkets ?? []
      }
    });
  }

  async listCertificates(user: RequestUser) {
    const profile = await this.ensureProfile(user);
    return this.prisma.certificate.findMany({ where: { companyProfileId: profile.id }, orderBy: { updatedAt: "desc" } });
  }

  async createCertificate(user: RequestUser, dto: UpsertKnowledgeDto) {
    const profile = await this.ensureProfile(user);
    return this.prisma.certificate.create({
      data: {
        companyProfileId: profile.id,
        name: requireField(dto.name, "name"),
        issuer: dto.issuer,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        fileAssetId: dto.fileAssetId
      }
    });
  }

  async listCaseStudies(user: RequestUser) {
    const profile = await this.ensureProfile(user);
    return this.prisma.caseStudy.findMany({ where: { companyProfileId: profile.id }, orderBy: { updatedAt: "desc" } });
  }

  async createCaseStudy(user: RequestUser, dto: UpsertKnowledgeDto) {
    const profile = await this.ensureProfile(user);
    return this.prisma.caseStudy.create({
      data: {
        companyProfileId: profile.id,
        title: requireField(dto.title ?? dto.name, "title"),
        market: dto.market,
        category: dto.category,
        summary: requireField(dto.summary, "summary"),
        result: dto.result,
        fileAssetId: dto.fileAssetId
      }
    });
  }

  async listEmailMaterials(user: RequestUser) {
    const profile = await this.ensureProfile(user);
    return this.prisma.emailMaterial.findMany({ where: { companyProfileId: profile.id }, orderBy: { updatedAt: "desc" } });
  }

  async createEmailMaterial(user: RequestUser, dto: UpsertKnowledgeDto) {
    const profile = await this.ensureProfile(user);
    return this.prisma.emailMaterial.create({
      data: {
        companyProfileId: profile.id,
        name: requireField(dto.name, "name"),
        materialType: requireField(dto.materialType, "materialType"),
        content: requireField(dto.content, "content"),
        tags: dto.tags ?? []
      }
    });
  }

  async updateEntity(user: RequestUser, entity: string, id: string, dto: UpsertKnowledgeDto) {
    const profile = await this.ensureProfile(user);
    const where = { id, companyProfileId: profile.id };
    switch (entity) {
      case "brands":
        await this.ensureExists(this.prisma.brand.findFirst({ where }));
        return this.prisma.brand.update({ where: { id }, data: pickDefined({
          name: dto.name,
          positioning: dto.positioning,
          targetMarkets: dto.targetMarkets
        }) as never });
      case "products":
        await this.ensureExists(this.prisma.product.findFirst({ where }));
        return this.prisma.product.update({ where: { id }, data: pickDefined({
          sku: dto.sku,
          name: dto.name,
          category: dto.category,
          description: dto.description,
          priceMin: dto.priceMin,
          priceMax: dto.priceMax,
          currency: dto.currency,
          tags: dto.tags
        }) as never });
      case "oem-capabilities":
        await this.ensureExists(this.prisma.oemCapability.findFirst({ where }));
        return this.prisma.oemCapability.update({ where: { id }, data: pickDefined({
          name: dto.name,
          category: dto.category,
          description: dto.description,
          moq: dto.moq,
          leadTime: dto.leadTime,
          certifications: dto.certifications,
          supportedMarkets: dto.supportedMarkets
        }) as never });
      case "certificates":
        await this.ensureExists(this.prisma.certificate.findFirst({ where }));
        return this.prisma.certificate.update({ where: { id }, data: pickDefined({
          name: dto.name,
          issuer: dto.issuer,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
          fileAssetId: dto.fileAssetId
        }) as never });
      case "case-studies":
        await this.ensureExists(this.prisma.caseStudy.findFirst({ where }));
        return this.prisma.caseStudy.update({ where: { id }, data: pickDefined({
          title: dto.title ?? dto.name,
          market: dto.market,
          category: dto.category,
          summary: dto.summary,
          result: dto.result,
          fileAssetId: dto.fileAssetId
        }) as never });
      case "email-materials":
        await this.ensureExists(this.prisma.emailMaterial.findFirst({ where }));
        return this.prisma.emailMaterial.update({ where: { id }, data: pickDefined({
          name: dto.name,
          materialType: dto.materialType,
          content: dto.content,
          tags: dto.tags
        }) as never });
      default:
        throw new BadRequestException("Unsupported knowledge entity");
    }
  }

  private async ensureProfile(user: RequestUser) {
    const profile = await this.prisma.companyProfile.findFirst({ where: { organizationId: user.organizationId } });
    if (!profile) {
      throw new NotFoundException("Company profile must be created first");
    }
    return profile;
  }

  private async ensureExists<T>(promise: Promise<T | null>) {
    const entity = await promise;
    if (!entity) {
      throw new NotFoundException("Knowledge entity not found");
    }
  }
}

function requireField(value: string | undefined, field: string) {
  if (!value) {
    throw new BadRequestException(`${field} is required`);
  }
  return value;
}

function pickDefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
