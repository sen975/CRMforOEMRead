export enum CustomerStage {
  PendingResearch = "PENDING_RESEARCH",
  Researching = "RESEARCHING",
  Researched = "RESEARCHED",
  PendingEmailGeneration = "PENDING_EMAIL_GENERATION",
  PendingEmailSend = "PENDING_EMAIL_SEND",
  FirstEmailSent = "FIRST_EMAIL_SENT",
  PendingSecondFollowUp = "PENDING_SECOND_FOLLOW_UP",
  Replied = "REPLIED",
  RequirementConfirming = "REQUIREMENT_CONFIRMING",
  Quoting = "QUOTING",
  Sampling = "SAMPLING",
  Negotiating = "NEGOTIATING",
  Won = "WON",
  Paused = "PAUSED",
  Invalid = "INVALID",
  Blacklisted = "BLACKLISTED"
}

export enum AiGenerationType {
  WebsiteAnalysis = "WEBSITE_ANALYSIS",
  ResearchReport = "RESEARCH_REPORT",
  OemFitScore = "OEM_FIT_SCORE",
  EmailDraft = "EMAIL_DRAFT"
}

export enum AiContentVersionType {
  RawAi = "RAW_AI",
  HumanEdit = "HUMAN_EDIT",
  Final = "FINAL"
}

export enum EmailDraftStatus {
  Draft = "DRAFT",
  PendingReview = "PENDING_REVIEW",
  Approved = "APPROVED",
  Rejected = "REJECTED",
  Sent = "SENT"
}

export enum EmailDirection {
  Inbound = "INBOUND",
  Outbound = "OUTBOUND"
}

export enum FollowUpTaskStatus {
  Open = "OPEN",
  Completed = "COMPLETED",
  Cancelled = "CANCELLED",
  Overdue = "OVERDUE"
}

export enum RoleCode {
  Admin = "ADMIN",
  SalesManager = "SALES_MANAGER",
  SalesRep = "SALES_REP",
  Operator = "OPERATOR",
  Executive = "EXECUTIVE"
}

export type OemScoreBreakdown = {
  productLineFit: number;
  marketFit: number;
  priceBandFit: number;
  brandMaturity: number;
  websiteCompleteness: number;
  contactQuality: number;
  cooperationOpportunity: number;
  riskPenalty: number;
};

export type WebsiteAnalysisResult = {
  detectedCountry?: string;
  detectedLanguage?: string;
  detectedTimezone?: string;
  detectedCurrency?: string;
  crawledUrls: string[];
  pages: Array<{
    url: string;
    pageType: "HOME" | "PRODUCT_LIST" | "PRODUCT_DETAIL" | "BRAND" | "ABOUT" | "CONTACT" | "SUPPORT" | "OTHER";
    title?: string;
    language?: string;
    textSummary?: string;
    headings: string[];
    links: Array<{ href: string; text: string }>;
    images: Array<{ src: string; alt?: string }>;
    contacts: Array<{
      type: "email" | "phone" | "address" | "social" | "form";
      value: string;
      sourceUrl?: string;
    }>;
    priceSignals: string[];
    depth: number;
    httpStatus?: number;
    errorMessage?: string;
  }>;
  contacts: Array<{
    type: "email" | "phone" | "address" | "social" | "form";
    value: string;
    sourceUrl?: string;
  }>;
  productCategories: Array<{
    name: string;
    productCount?: number;
    evidenceUrls: string[];
    keywords: string[];
  }>;
  productCount?: number;
  products: Array<{
    name: string;
    category?: string;
    description?: string;
    keywords: string[];
    evidenceUrls: string[];
    imageUrls: string[];
    priceSignals: string[];
    confidence: number;
  }>;
  priceRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  imageStyle?: string;
  websiteCompleteness?: number;
  pricePositioning?: string;
  missingCategories: string[];
  cooperationOpportunities: string[];
  risks: string[];
};
