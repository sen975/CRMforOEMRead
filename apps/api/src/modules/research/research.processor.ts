import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { AiGenerationType, CustomerStage } from "@oem-crm/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { AiGenerationService } from "../ai/ai-generation.service";
import { AiProviderService } from "../ai/ai-provider.service";
import { RESEARCH_REPORT_QUEUE } from "./research.constants";
import { SearchProviderService } from "./search-provider.service";

@Processor(RESEARCH_REPORT_QUEUE)
export class ResearchProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProvider: AiProviderService,
    private readonly aiGeneration: AiGenerationService,
    private readonly searchProvider: SearchProviderService
  ) {
    super();
  }

  async process(job: Job<{ reportId: string; organizationId: string; customerId: string; salesNotes?: string }>) {
    const { reportId, organizationId, customerId, salesNotes } = job.data;
    const report = await this.prisma.researchReport.update({
      where: { id: reportId },
      data: { status: "RUNNING", startedAt: new Date() }
    });

    try {
      const context = await this.buildContext(organizationId, customerId, salesNotes);
      await this.prisma.aiGenerationRun.update({
        where: { id: report.aiGenerationRunId ?? "" },
        data: { status: "RUNNING", rawInput: context as never }
      }).catch(() => undefined);

      const startedAt = Date.now();
      const completion = await this.aiProvider.complete({
        system: researchSystemPrompt(),
        user: JSON.stringify(context),
        jsonMode: true
      });
      const parsed = parseResearchOutput(completion.content, context);

      if (report.aiGenerationRunId) {
        await this.aiGeneration.markSucceeded(report.aiGenerationRunId, completion.raw, completion.tokenUsage, Date.now() - startedAt);
        await this.aiGeneration.addRawAiVersion(report.aiGenerationRunId, completion.content, parsed);
      }

      const finalReport = await this.prisma.researchReport.update({
        where: { id: reportId },
        data: {
          status: "SUCCEEDED",
          completedAt: new Date(),
          title: parsed.title,
          reportJson: parsed as never,
          finalMarkdown: parsed.markdown_report,
          sourceEvidence: context.sourceEvidence as never,
          searchEnabled: context.publicSearch.enabled
        }
      });

      await this.prisma.customer.update({
        where: { id: customerId },
        data: { stage: CustomerStage.Researched as never }
      });

      return finalReport;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown research report error";
      await this.prisma.researchReport.update({
        where: { id: reportId },
        data: { status: "FAILED", errorMessage: message, completedAt: new Date() }
      });
      if (report.aiGenerationRunId) {
        await this.aiGeneration.markFailed(report.aiGenerationRunId, message);
      }
      throw error;
    }
  }

  private async buildContext(organizationId: string, customerId: string, salesNotes?: string) {
    const [customer, websiteAnalysis, companyProfiles, contacts, priorMessages] = await Promise.all([
      this.prisma.customer.findFirstOrThrow({
        where: { id: customerId, organizationId },
        include: { source: true, type: true, owner: { select: { id: true, name: true, email: true } } }
      }),
      this.prisma.websiteAnalysis.findFirst({
        where: { customerId },
        orderBy: { createdAt: "desc" },
        include: {
          pages: true,
          products: true
        }
      }),
      this.prisma.companyProfile.findMany({
        where: { organizationId },
        include: {
          capabilities: true,
          products: { take: 80 },
          certificates: true,
          caseStudies: true,
          emailMaterials: true
        }
      }),
      this.prisma.contact.findMany({ where: { customerId } }),
      this.prisma.emailThread.findMany({
        where: { customerId },
        include: { messages: { take: 10, orderBy: { createdAt: "desc" } } }
      })
    ]);
    const publicSearch = await this.searchProvider.searchCustomer({
      name: customer.name,
      websiteUrl: customer.websiteUrl,
      country: customer.country
    });

    return {
      customer,
      contacts,
      websiteAnalysis,
      publicSearch,
      sourceEvidence: {
        websiteUrls: websiteAnalysis?.crawledUrls ?? [],
        websitePages: websiteAnalysis?.pages.filter((page) => !page.errorMessage).map((page) => ({ url: page.url, pageType: page.pageType, title: page.title })) ?? [],
        publicSearchResults: publicSearch.results,
        crmContacts: contacts.map((contact) => ({ name: contact.name, email: contact.email, phone: contact.phone })),
        searchWarning: publicSearch.warning
      },
      companyKnowledge: {
        profiles: companyProfiles.map((profile) => ({
          id: profile.id,
          displayName: profile.displayName,
          summary: profile.summary,
          markets: profile.markets,
          capabilities: profile.capabilities,
          products: profile.products,
          certificates: profile.certificates,
          caseStudies: profile.caseStudies,
          emailMaterials: profile.emailMaterials
        })),
        products: companyProfiles.flatMap((profile) => profile.products),
        capabilities: companyProfiles.flatMap((profile) => profile.capabilities),
        caseStudies: companyProfiles.flatMap((profile) => profile.caseStudies),
        certificates: companyProfiles.flatMap((profile) => profile.certificates)
      },
      priorMessages,
      salesNotes
    };
  }
}

function researchSystemPrompt() {
  return [
    "你是一名资深外贸OEM/ODM客户开发研究员。",
    "请只根据输入上下文和来源证据生成报告，不要编造未提供的信息。",
    "无法从来源证据确认的信息必须写“未从现有来源确认”，不要估算成立年份、员工人数、认证、合作伙伴或经营数据。",
    "返回严格JSON对象，字段必须包含：title, company_basic_info, background_history, core_business_product_lines, market_competition, brand_marketing, price_positioning, website_product_analysis, oem_odm_opportunities, risks, development_recommendations, next_actions, source_basis, markdown_report。",
    "请控制总输出在2500个中文字符以内，确保JSON完整闭合，不要输出多余解释。",
    "markdown_report 必须是中文Markdown，面向业务员和销售主管，可直接阅读。",
    "source_basis 要列出用到的官网URL、公开搜索结果URL或CRM资料说明。"
  ].join("\n");
}

function parseResearchOutput(content: string, context: ResearchContextLike) {
  const parsed = safeJson(content);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    const markdown = asText(record.markdown_report);
    return {
      title: asText(record.title) || `${context.customer.name} 客户背调报告`,
      company_basic_info: record.company_basic_info ?? {},
      background_history: record.background_history ?? "",
      core_business_product_lines: record.core_business_product_lines ?? "",
      market_competition: record.market_competition ?? "",
      brand_marketing: record.brand_marketing ?? "",
      price_positioning: record.price_positioning ?? "",
      website_product_analysis: record.website_product_analysis ?? "",
      oem_odm_opportunities: record.oem_odm_opportunities ?? [],
      risks: record.risks ?? [],
      development_recommendations: record.development_recommendations ?? [],
      next_actions: record.next_actions ?? [],
      source_basis: record.source_basis ?? [],
      markdown_report: isReadableMarkdown(markdown) ? markdown : buildMarkdownReport(context.customer.name, record, context.publicSearch.warning)
    };
  }
  const fallback = buildContextReport(context);
  return {
    ...fallback,
    markdown_report: isReadableMarkdown(content) ? content : fallback.markdown_report
  };
}

function fallbackMarkdown(customerName: string, record: Record<string, unknown>, warning?: string) {
  return `# ${customerName} 客户背调报告\n\n## 总结\n${asText(record.summary) || "系统已生成结构化背调结果，请结合官网分析和客户资料复核。"}\n\n${warning ? `> ${warning}\n` : ""}`;
}

function buildMarkdownReport(customerName: string, record: Record<string, unknown>, warning?: string) {
  const title = asText(record.title) || `${customerName} 客户背调报告`;
  const sections: Array<[string, unknown]> = [
    ["公司基本信息", record.company_basic_info],
    ["企业背景和发展历程", record.background_history],
    ["核心业务与产品线", record.core_business_product_lines],
    ["市场表现与竞争格局", record.market_competition],
    ["品牌策略与营销方式", record.brand_marketing],
    ["产品价格定位", record.price_positioning],
    ["官网产品专项分析", record.website_product_analysis],
    ["OEM/ODM合作机会", record.oem_odm_opportunities],
    ["风险提示", record.risks],
    ["智能开发建议", record.development_recommendations],
    ["下一步行动", record.next_actions],
    ["来源依据", record.source_basis]
  ];

  const body = sections
    .map(([heading, value]) => `## ${heading}\n${renderMarkdownValue(value)}`)
    .filter((section) => !section.endsWith("\n- 暂无明确结论。"))
    .join("\n\n");
  return [`# ${title}`, warning ? `> ${warning}` : "", body].filter(Boolean).join("\n\n");
}

function renderMarkdownValue(value: unknown): string {
  if (typeof value === "string") return value.trim() || "- 暂无明确结论。";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (!value.length) return "- 暂无明确结论。";
    return value.map((item) => `- ${renderInlineValue(item)}`).join("\n");
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined && item !== null && item !== "");
    if (!entries.length) return "- 暂无明确结论。";
    return entries.map(([key, item]) => `- ${humanizeKey(key)}：${renderInlineValue(item)}`).join("\n");
  }
  return "- 暂无明确结论。";
}

function renderInlineValue(value: unknown): string {
  if (typeof value === "string") return value.trim() || "暂无明确结论";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(renderInlineValue).filter(Boolean).join("；") || "暂无明确结论";
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined && item !== null && item !== "")
      .map(([key, item]) => `${humanizeKey(key)}：${renderInlineValue(item)}`)
      .join("；") || "暂无明确结论";
  }
  return "暂无明确结论";
}

function humanizeKey(key: string) {
  const labels: Record<string, string> = {
    company_name: "公司名称",
    legal_name: "法定/品牌名称",
    website: "官网",
    country: "国家/地区",
    headquarters: "总部/地址",
    business_model: "业务模式",
    company_type: "客户类型",
    customer_type: "客户类型",
    owner: "负责人",
    contacts: "联系人",
    summary: "总结",
    evidence: "依据",
    risk: "风险",
    severity: "严重程度",
    description: "说明",
    action: "行动",
    rationale: "理由",
    source: "来源",
    analysis_status: "分析状态",
    url: "URL",
    value: "值",
    name: "名称",
    crawled_pages: "抓取页面",
    valid_pages: "有效页面",
    product_count: "产品数量",
    website_completeness: "官网完整度"
  };
  return labels[key] ?? key.replace(/_/g, " ");
}

function isReadableMarkdown(value: string) {
  const trimmed = value.trim();
  return Boolean(trimmed) && !trimmed.startsWith("{") && !trimmed.startsWith("[");
}

type ResearchContextLike = {
  customer: {
    name: string;
    websiteUrl?: string | null;
    country?: string | null;
    notes?: string | null;
    source?: { name?: string | null } | null;
    type?: { name?: string | null } | null;
    owner?: { name?: string | null } | null;
  };
  contacts?: Array<{ name?: string | null; title?: string | null; email?: string | null; phone?: string | null }>;
  websiteAnalysis?: {
    status?: string;
    crawledUrls?: string[];
    productCount?: number | null;
    productCategories?: unknown;
    contactEvidence?: unknown;
    opportunities?: unknown;
    risks?: unknown;
    pricePositioning?: string | null;
    websiteCompleteness?: number | null;
    pages?: Array<{ url: string; pageType: string; title?: string | null; errorMessage?: string | null }>;
  } | null;
  publicSearch: { warning?: string; enabled?: boolean; results?: Array<{ title?: string; url?: string }> };
};

function buildContextReport(context: ResearchContextLike) {
  const customer = context.customer;
  const analysis = context.websiteAnalysis;
  const productCategories = asRecords(analysis?.productCategories);
  const contactEvidence = asRecords(analysis?.contactEvidence);
  const opportunities = asStringList(analysis?.opportunities);
  const risks = asStringList(analysis?.risks);
  const usablePages = (analysis?.pages ?? []).filter((page) => !page.errorMessage);
  const sourceBasis = [
    ...(analysis?.crawledUrls ?? []).slice(0, 10).map((url) => ({ source: "官网抓取", url })),
    ...(context.publicSearch.results ?? []).slice(0, 6).map((item) => ({ source: item.title ?? "公开搜索", url: item.url ?? "" })),
    ...((context.contacts ?? []).length ? [{ source: "CRM联系人资料", value: `${context.contacts?.length ?? 0} 个联系人` }] : [])
  ];
  const report = {
    title: `${customer.name} 客户背调报告`,
    company_basic_info: {
      company_name: customer.name,
      website: customer.websiteUrl ?? "未从现有来源确认",
      country: customer.country ?? "未从现有来源确认",
      customer_type: customer.type?.name ?? "未从现有来源确认",
      source: customer.source?.name ?? "未从现有来源确认",
      owner: customer.owner?.name ?? "未分配",
      contacts: (context.contacts ?? []).map((contact) => `${contact.name || contact.email || "未命名联系人"}${contact.email ? ` <${contact.email}>` : ""}`)
    },
    background_history: context.publicSearch.warning
      ? "未启用公开网络搜索，企业背景仅能基于官网与CRM资料判断。"
      : "已结合公开搜索结果生成背景判断，需由业务员复核关键事实。",
    core_business_product_lines: productCategories.length
      ? productCategories.map((item) => ({
          name: asText(item.name) || asText(item.category) || "未命名品类",
          evidence: asStringList(item.evidenceUrls).join(", ") || "官网页面"
        }))
      : "官网未识别到清晰产品分类，需要人工查看产品页或补充官网内容。",
    market_competition: "当前版本未接入完整竞品数据库，建议结合公开搜索、LinkedIn、行业名录继续补充。",
    brand_marketing: usablePages.some((page) => page.pageType === "BRAND")
      ? "官网包含品牌页，可从品牌矩阵、渠道拓展和新产品补充角度切入。"
      : "官网未识别到明确品牌页，品牌成熟度需要人工复核。",
    price_positioning: analysis?.pricePositioning ?? "未从官网识别到明确价格区间。",
    website_product_analysis: {
      analysis_status: analysisStatusText(analysis?.status),
      crawled_pages: analysis?.crawledUrls?.length ?? 0,
      valid_pages: usablePages.length,
      product_count: analysis?.productCount ?? 0,
      website_completeness: analysis?.websiteCompleteness ? `${analysis.websiteCompleteness}/100` : "未评分",
      contacts: contactEvidence.map((item) => `${contactEvidenceTypeLabel(asText(item.type))}: ${asText(item.value)}`).filter(Boolean)
    },
    oem_odm_opportunities: opportunities.length ? opportunities : ["可基于官网产品线和品牌页，测试其新品补充、定制款或差异化供货需求。"],
    risks: [
      ...risks,
      ...(context.publicSearch.warning ? [context.publicSearch.warning] : []),
      ...(!context.contacts?.length ? ["CRM中缺少高质量联系人，建议补充采购/产品/供应链负责人。"] : [])
    ],
    development_recommendations: [
      "首封邮件引用其官网中已识别的品牌/产品线，避免泛泛群发。",
      "先确认其采购模式、现有供应链痛点、是否接受OEM/ODM或定制补充。",
      "结合我方产品资料选择1-2个最贴近的品类做小切口推荐。"
    ],
    next_actions: [
      "补充或校验客户官网产品详情页。",
      "补充采购/产品负责人邮箱或LinkedIn。",
      "完善企业资料库中的我方OEM能力、产品目录、成功案例后再生成开发邮件。"
    ],
    source_basis: sourceBasis
  };
  return { ...report, markdown_report: buildMarkdownReport(customer.name, report, context.publicSearch.warning) };
}

function asRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item : renderInlineValue(item))).filter(Boolean);
}

function analysisStatusText(status?: string) {
  const labels: Record<string, string> = {
    QUEUED: "排队中",
    RUNNING: "分析中",
    SUCCEEDED: "分析完成",
    FAILED: "分析失败"
  };
  return labels[status ?? ""] ?? "未分析";
}

function contactEvidenceTypeLabel(type: string) {
  const labels: Record<string, string> = {
    email: "公开邮箱",
    phone: "公开电话",
    social: "社交媒体",
    address: "地址",
    form: "表单"
  };
  return labels[type] ?? "联系方式";
}

function safeJson(input: string) {
  try {
    return JSON.parse(input);
  } catch {
    const match = input.match(/\{[\s\S]*\}/);
    if (!match) return undefined;
    try {
      return JSON.parse(match[0]);
    } catch {
      return undefined;
    }
  }
}

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}
