import { Injectable } from "@nestjs/common";
import { WebsiteAnalysisResult } from "@oem-crm/shared";
import { chromium, type Page } from "playwright";

type PageType = WebsiteAnalysisResult["pages"][number]["pageType"];
type PageLink = { href: string; text: string };
type ImageEvidence = { src: string; alt?: string };
type ContactEvidence = WebsiteAnalysisResult["contacts"][number];
type PageSnapshot = WebsiteAnalysisResult["pages"][number];
type QueueItem = { url: string; depth: number; score: number };

const MAX_TEXT_LENGTH = 9000;
const DEFAULT_MAX_PAGES = 40;
const MAX_DEPTH = 3;
const CONCURRENCY = 3;

@Injectable()
export class WebsiteCrawlerService {
  async analyze(websiteUrl: string, maxPages = DEFAULT_MAX_PAGES): Promise<WebsiteAnalysisResult> {
    const normalizedUrl = normalizeUrl(websiteUrl);
    const root = new URL(normalizedUrl);
    const browser = await chromium.launch({ headless: true });

    try {
      const seededUrls = await discoverSeedUrls(normalizedUrl, root);
      const queue: QueueItem[] = [{ url: normalizedUrl, depth: 0, score: 1_000 }, ...seededUrls];
      const seen = new Set<string>();
      const snapshots: PageSnapshot[] = [];

      async function crawlOne(item: QueueItem) {
        const cleanUrl = normalizeUrl(item.url, root);
        if (seen.has(cleanUrl) || snapshots.length >= maxPages) return;
        seen.add(cleanUrl);

        const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
        try {
          const snapshot = await readPage(page, cleanUrl, root, item.depth);
          snapshots.push(snapshot);
          if (item.depth < MAX_DEPTH) {
            const discovered = snapshot.links
              .filter((link) => isInternalLink(link.href, root))
              .map((link) => ({ url: link.href, depth: item.depth + 1, score: linkScore(link.href, link.text) }))
              .filter((link) => link.score > 0)
              .sort((left, right) => right.score - left.score)
              .slice(0, 12);
            queue.push(...discovered);
          }
        } catch (error) {
          snapshots.push({
            url: cleanUrl,
            pageType: classifyPage(cleanUrl, ""),
            title: undefined,
            language: undefined,
            textSummary: undefined,
            headings: [],
            links: [],
            images: [],
            contacts: [],
            priceSignals: [],
            depth: item.depth,
            errorMessage: error instanceof Error ? error.message : "Failed to crawl page"
          });
        } finally {
          await page.close().catch(() => undefined);
        }
      }

      while (queue.length && snapshots.length < maxPages) {
        const batch = takeNextBatch(queue, seen, root, CONCURRENCY, maxPages - snapshots.length);
        if (!batch.length) break;
        await Promise.all(batch.map((item) => crawlOne(item)));
      }

      const uniqueSnapshots = dedupePages(snapshots);
      const successfulPages = uniqueSnapshots.filter((page) => !page.errorMessage);
      const crawledUrls = successfulPages.map((page) => page.url);
      const contacts = dedupeContacts(successfulPages.flatMap((page) => page.contacts));
      const products = inferProducts(successfulPages);
      const productCategories = inferProductCategories(successfulPages, products);
      const allText = successfulPages.map((page) => `${page.title ?? ""}\n${page.textSummary ?? ""}\n${page.headings.join("\n")}`).join("\n");
      const priceSignals = unique(successfulPages.flatMap((page) => page.priceSignals));

      return {
        crawledUrls,
        pages: uniqueSnapshots,
        detectedLanguage: successfulPages.find((page) => page.language)?.language,
        contacts,
        productCategories,
        products,
        productCount: products.length || productCategories.reduce((sum, category) => sum + (category.productCount ?? 0), 0),
        priceRange: inferPriceRange(priceSignals),
        imageStyle: inferImageStyle(successfulPages),
        websiteCompleteness: inferWebsiteCompleteness(successfulPages, productCategories, contacts),
        pricePositioning: inferPricePositioning(priceSignals, allText),
        missingCategories: inferMissingCategories(allText, productCategories, priceSignals),
        cooperationOpportunities: inferOpportunities(productCategories, products, contacts, successfulPages),
        risks: inferRisks(productCategories, contacts, uniqueSnapshots)
      };
    } finally {
      await browser.close().catch(() => undefined);
    }
  }
}

async function readPage(page: Page, url: string, root: URL, depth: number): Promise<PageSnapshot> {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.waitForTimeout(1_200).catch(() => undefined);

  const pageUrl = stripTracking(page.url());
  const title = await page.title().catch(() => "");
  const language = (await page.locator("html").getAttribute("lang").catch(() => undefined)) ?? undefined;
  const text = (await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "")).replace(/\s+/g, " ").trim();
  const headings = await page
    .locator("h1,h2,h3")
    .evaluateAll((nodes) => nodes.map((node) => (node.textContent ?? "").trim().replace(/\s+/g, " ")).filter(Boolean).slice(0, 40))
    .catch(() => []);
  const links = await page
    .locator("a")
    .evaluateAll((nodes) =>
      nodes
        .map((node) => ({
          href: (node as HTMLAnchorElement).href,
          text: (node.textContent ?? "").trim().replace(/\s+/g, " ")
        }))
        .filter((link) => link.href)
        .slice(0, 300)
    )
    .catch(() => []);
  const images = await page
    .locator("img")
    .evaluateAll((nodes) =>
      nodes
        .map((node) => ({
          src: (node as HTMLImageElement).currentSrc || (node as HTMLImageElement).src,
          alt: ((node as HTMLImageElement).alt ?? "").trim()
        }))
        .filter((image) => image.src)
        .slice(0, 80)
    )
    .catch(() => []);
  const contacts = [
    ...extractContacts(text, pageUrl),
    ...extractSocialLinks(links, pageUrl),
    ...links.filter((link) => /mailto:/i.test(link.href)).map((link) => ({
      type: "email" as const,
      value: link.href.replace(/^mailto:/i, "").split("?")[0],
      sourceUrl: pageUrl
    }))
  ];
  const httpStatus = response?.status();
  const notFoundSignal = Boolean(httpStatus && httpStatus >= 400) || /\b404\b|page not found|not found/i.test(`${title} ${text.slice(0, 500)}`);

  return {
    url: pageUrl,
    pageType: notFoundSignal ? "OTHER" : classifyPage(pageUrl, `${title} ${headings.join(" ")} ${text}`, root),
    title,
    language,
    textSummary: summarizeText(text),
    headings,
    links: normalizeLinks(links, root),
    images: normalizeImages(images),
    contacts: dedupeContacts(contacts),
    priceSignals: extractPriceSignals(text),
    depth,
    httpStatus,
    errorMessage: notFoundSignal ? `页面不可用或返回 ${httpStatus ?? "404"} 信号` : undefined
  };
}

async function discoverSeedUrls(normalizedUrl: string, root: URL): Promise<QueueItem[]> {
  const seeds: QueueItem[] = [];
  const robotsUrls = await fetchRobotsSitemaps(root);
  const sitemapUrls = unique([`${root.origin}/sitemap.xml`, ...robotsUrls]);
  for (const sitemapUrl of sitemapUrls.slice(0, 5)) {
    const urls = await fetchSitemapUrls(sitemapUrl, root);
    seeds.push(...urls.map((url) => ({ url, depth: 1, score: linkScore(url, "") })));
  }
  const commonPaths = ["/products", "/product", "/collections", "/catalog", "/shop", "/brands", "/about", "/contact", "/support"];
  seeds.push(...commonPaths.map((path) => ({ url: `${root.origin}${path}`, depth: 1, score: linkScore(`${root.origin}${path}`, path) })));
  return seeds
    .filter((seed) => seed.score > 0 && stripTracking(seed.url) !== stripTracking(normalizedUrl))
    .sort((left, right) => right.score - left.score)
    .slice(0, 80);
}

async function fetchRobotsSitemaps(root: URL) {
  try {
    const response = await fetch(`${root.origin}/robots.txt`, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return [];
    const text = await response.text();
    return Array.from(text.matchAll(/^sitemap:\s*(.+)$/gim)).map((match) => match[1].trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchSitemapUrls(sitemapUrl: string, root: URL): Promise<string[]> {
  try {
    const response = await fetch(sitemapUrl, { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return [];
    const xml = await response.text();
    const locs = Array.from(xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)).map((match) => match[1].trim());
    const nested = locs.filter((url) => /sitemap/i.test(url)).slice(0, 3);
    const nestedUrls = (await Promise.all(nested.map((url) => fetchSitemapUrls(url, root)))).flat();
    return unique([...locs, ...nestedUrls]).filter((url) => isInternalLink(url, root));
  } catch {
    return [];
  }
}

function takeNextBatch(queue: QueueItem[], seen: Set<string>, root: URL, concurrency: number, remaining: number) {
  queue.sort((left, right) => right.score - left.score || left.depth - right.depth);
  const batch: QueueItem[] = [];
  const batched = new Set<string>();
  while (queue.length && batch.length < Math.min(concurrency, remaining)) {
    const item = queue.shift()!;
    const cleanUrl = normalizeUrl(item.url, root);
    if (seen.has(cleanUrl) || batched.has(cleanUrl) || !isInternalLink(cleanUrl, root)) continue;
    batched.add(cleanUrl);
    batch.push({ ...item, url: cleanUrl });
  }
  return batch;
}

function inferProducts(pages: PageSnapshot[]): WebsiteAnalysisResult["products"] {
  const candidates = new Map<string, WebsiteAnalysisResult["products"][number]>();
  for (const page of pages.filter((item) => item.pageType === "PRODUCT_DETAIL" || item.pageType === "PRODUCT_LIST")) {
    const names = page.pageType === "PRODUCT_DETAIL" ? [bestPageName(page)] : productNamesFromLinks(page.links);
    for (const rawName of names) {
      const name = cleanProductName(rawName);
      if (!name || isGenericProductName(name)) continue;
      const current = candidates.get(name.toLowerCase()) ?? {
        name,
        category: inferCategoryFromUrl(page.url),
        description: page.textSummary,
        keywords: tokenize(`${name} ${page.title ?? ""} ${page.textSummary ?? ""}`).slice(0, 10),
        evidenceUrls: [],
        imageUrls: [],
        priceSignals: [],
        confidence: page.pageType === "PRODUCT_DETAIL" ? 85 : 60
      };
      current.evidenceUrls = unique([...current.evidenceUrls, page.url]).slice(0, 5);
      current.imageUrls = unique([...current.imageUrls, ...page.images.map((image) => image.src)]).slice(0, 6);
      current.priceSignals = unique([...current.priceSignals, ...page.priceSignals]).slice(0, 6);
      current.keywords = unique([...current.keywords, ...tokenize(name)]).slice(0, 12);
      candidates.set(name.toLowerCase(), current);
    }
  }
  return Array.from(candidates.values()).slice(0, 80);
}

function inferProductCategories(pages: PageSnapshot[], products: WebsiteAnalysisResult["products"]): WebsiteAnalysisResult["productCategories"] {
  const grouped = new Map<string, { name: string; productCount: number; evidenceUrls: Set<string>; keywords: Set<string> }>();
  for (const page of pages.filter((item) => item.pageType === "PRODUCT_LIST" || item.pageType === "PRODUCT_DETAIL" || item.pageType === "BRAND")) {
    const name = cleanCategoryName(page.pageType === "BRAND" ? "Brands" : inferCategoryFromUrl(page.url));
    const current = grouped.get(name.toLowerCase()) ?? { name, productCount: 0, evidenceUrls: new Set<string>(), keywords: new Set<string>() };
    current.evidenceUrls.add(page.url);
    tokenize(`${page.title ?? ""} ${page.headings.join(" ")}`).slice(0, 10).forEach((keyword) => current.keywords.add(keyword));
    grouped.set(name.toLowerCase(), current);
  }
  for (const product of products) {
    const name = cleanCategoryName(product.category ?? "Products");
    const current = grouped.get(name.toLowerCase()) ?? { name, productCount: 0, evidenceUrls: new Set<string>(), keywords: new Set<string>() };
    current.productCount += 1;
    product.evidenceUrls.forEach((url) => current.evidenceUrls.add(url));
    product.keywords.forEach((keyword) => current.keywords.add(keyword));
    grouped.set(name.toLowerCase(), current);
  }
  return Array.from(grouped.values())
    .map((item) => ({
      name: item.name,
      productCount: item.productCount || undefined,
      evidenceUrls: Array.from(item.evidenceUrls).slice(0, 8),
      keywords: Array.from(item.keywords).slice(0, 12)
    }))
    .slice(0, 20);
}

function inferOpportunities(
  categories: WebsiteAnalysisResult["productCategories"],
  products: WebsiteAnalysisResult["products"],
  contacts: WebsiteAnalysisResult["contacts"],
  pages: PageSnapshot[]
) {
  const text = pages.map((page) => `${page.title ?? ""} ${page.textSummary ?? ""}`).join("\n").toLowerCase();
  const opportunities: string[] = [];
  if (categories.length || products.length) opportunities.push("官网已展示产品线和产品页面，可在开发邮件中引用具体品类作为切入点。");
  if (contacts.some((contact) => contact.type === "email")) opportunities.push("官网公开了联系邮箱，可优先使用个性化首封开发邮件触达。");
  if (/brand|retail|wholesale|distributor|consumer electronics|accessor|mobile|phone|case|charger/i.test(text)) {
    opportunities.push("官网存在品牌、渠道或消费电子相关信号，适合进一步验证其配件类 OEM/ODM 采购需求。");
  }
  if (!/oem|odm|custom|private label/i.test(text)) opportunities.push("官网未明显强调自有制造能力，可从补充产品线、定制款或差异化供货角度试探合作。");
  return opportunities;
}

function inferRisks(categories: WebsiteAnalysisResult["productCategories"], contacts: WebsiteAnalysisResult["contacts"], pages: PageSnapshot[]) {
  const risks: string[] = [];
  if (!contacts.length) risks.push("官网未识别到公开联系方式，需要人工补充联系人。");
  if (!categories.length) risks.push("官网产品分类不清晰，需人工复核产品页或补充官网内容。");
  if (pages.filter((page) => !page.errorMessage).length <= 2) risks.push("成功抓取页面较少，官网可能存在动态加载、访问限制或导航较浅。");
  if (pages.some((page) => page.errorMessage)) risks.push("部分页面抓取失败，报告结论需要结合人工查看。");
  return risks;
}

function inferMissingCategories(text: string, categories: WebsiteAnalysisResult["productCategories"], priceSignals: string[]) {
  const lower = text.toLowerCase();
  const missing: string[] = [];
  if (!categories.length) missing.push("未识别到清晰产品分类");
  if (!/oem|odm|custom|private label|manufactur/i.test(lower)) missing.push("官网未明显展示 OEM/ODM 或定制能力信息");
  if (!priceSignals.length) missing.push("官网未明显展示价格区间");
  return missing;
}

function inferPriceRange(signals: string[]) {
  const values = signals
    .map((signal) => signal.match(/(?:USD|US\$|\$|€|EUR)\s*([0-9]+(?:\.[0-9]+)?)/i)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number)
    .filter(Number.isFinite);
  if (!values.length) return undefined;
  return { min: Math.min(...values), max: Math.max(...values), currency: signals.some((signal) => /€|EUR/i.test(signal)) ? "EUR" : "USD" };
}

function inferPricePositioning(signals: string[], text: string) {
  const range = inferPriceRange(signals);
  if (range?.max && range.max >= 100) return "中高端或高端";
  if (range?.max && range.max < 20) return "平价";
  if (/premium|luxury|high-end|designer/i.test(text)) return "中高端或高端";
  if (/affordable|value|discount/i.test(text)) return "平价";
  return "未知";
}

function inferImageStyle(pages: PageSnapshot[]) {
  const imageCount = pages.reduce((sum, page) => sum + page.images.length, 0);
  const home = pages.find((page) => page.pageType === "HOME");
  return `首页标题：${home?.title || "-"}；抓取图片约 ${imageCount} 张`;
}

function inferWebsiteCompleteness(pages: PageSnapshot[], categories: WebsiteAnalysisResult["productCategories"], contacts: WebsiteAnalysisResult["contacts"]) {
  let score = 20;
  if (pages.some((page) => page.pageType === "PRODUCT_LIST" || page.pageType === "PRODUCT_DETAIL")) score += 25;
  if (categories.length) score += 20;
  if (contacts.length) score += 15;
  if (pages.some((page) => page.pageType === "ABOUT")) score += 10;
  if (pages.some((page) => page.pageType === "BRAND")) score += 10;
  return Math.min(score, 100);
}

function classifyPage(url: string, content: string, root?: URL): PageType {
  const parsed = new URL(url);
  const path = parsed.pathname.toLowerCase();
  const value = `${path} ${content}`.toLowerCase();
  const isHome = root ? stripTrailingSlash(url) === stripTrailingSlash(root.origin) || path === "/" : path === "/";
  if (isHome) return "HOME";
  if (/\/(contact|get-in-touch|where-to-buy)(\/|$)/.test(path)) return "CONTACT";
  if (/\/(support|help|faq|customer-service)(\/|$)/.test(path)) return "SUPPORT";
  if (/\/(about|company|story|who-we-are)(\/|$)/.test(path)) return "ABOUT";
  if (/\/brands?(\/|$)/.test(path)) return "BRAND";
  if (/\/products?\/[^/]+|\/shop\/[^/]+|\/collections\/[^/]+\/products?\//.test(path)) return "PRODUCT_DETAIL";
  if (/\/(products?|collections?|catalog|shop|category|categories|industries-categories)(\/|$)/.test(path)) return "PRODUCT_LIST";
  if (/brand|brands/.test(value)) return "BRAND";
  if (/contact|get-in-touch|where-to-buy/.test(value)) return "CONTACT";
  if (/support|help|faq|customer-service/.test(value)) return "SUPPORT";
  if (/about|company|story|who-we-are/.test(value)) return "ABOUT";
  if (/products?|collections?|catalog|shop|category|categories|industries-categories/.test(value)) return "PRODUCT_LIST";
  return "OTHER";
}

function normalizeUrl(input: string, base?: URL) {
  const url = new URL(input.startsWith("http") ? input : input.startsWith("/") && base ? `${base.origin}${input}` : `https://${input}`);
  url.hash = "";
  return stripTracking(url.toString());
}

function normalizeLinks(links: PageLink[], root: URL) {
  const seen = new Set<string>();
  return links
    .map((link) => ({ href: normalizeMaybe(link.href, root), text: link.text }))
    .filter((link) => link.href && !seen.has(link.href) && seen.add(link.href))
    .slice(0, 120);
}

function normalizeMaybe(href: string, root: URL) {
  try {
    return normalizeUrl(href, root);
  } catch {
    return href;
  }
}

function normalizeImages(images: ImageEvidence[]) {
  const seen = new Set<string>();
  return images.filter((image) => image.src && !seen.has(image.src) && seen.add(image.src)).slice(0, 50);
}

function extractContacts(text: string, sourceUrl: string): ContactEvidence[] {
  const emails = Array.from(new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []));
  const phones = Array.from(new Set(text.match(/\+?\d[\d\s().-]{7,}\d/g) ?? []));
  return [
    ...emails.map((value) => ({ type: "email" as const, value, sourceUrl })),
    ...phones.slice(0, 10).map((value) => ({ type: "phone" as const, value, sourceUrl }))
  ];
}

function extractSocialLinks(links: PageLink[], sourceUrl: string): ContactEvidence[] {
  return links
    .filter((link) => /linkedin|facebook|instagram|youtube|tiktok|twitter|x\.com/i.test(link.href))
    .filter((link) => !/wix\.com|templateslp/i.test(link.href))
    .map((link) => ({ type: "social" as const, value: link.href, sourceUrl }))
    .slice(0, 12);
}

function extractPriceSignals(text: string) {
  return unique(text.match(/(?:USD|US\$|\$|€|EUR)\s*[0-9]+(?:\.[0-9]+)?(?:\s*[-–]\s*(?:USD|US\$|\$|€|EUR)?\s*[0-9]+(?:\.[0-9]+)?)?/gi) ?? []).slice(0, 20);
}

function summarizeText(text: string) {
  if (!text) return undefined;
  return text.slice(0, MAX_TEXT_LENGTH);
}

function productNamesFromLinks(links: PageLink[]) {
  return links
    .filter((link) => !/linkedin|facebook|instagram|youtube|tiktok|twitter|x\.com|wix\.com/i.test(`${link.href} ${link.text}`))
    .filter((link) => /product|shop|collection|case|charger|cable|audio|accessor|screen|protector|power|phone/i.test(`${link.href} ${link.text}`))
    .map((link) => link.text || inferCategoryFromUrl(link.href))
    .slice(0, 80);
}

function bestPageName(page: PageSnapshot) {
  return page.headings[0] || page.title || inferCategoryFromUrl(page.url);
}

function inferCategoryFromUrl(url: string) {
  return url
    .split("/")
    .filter(Boolean)
    .at(-1)
    ?.replace(/[-_]/g, " ")
    .replace(/\?.+$/, "")
    .trim() || "Products";
}

function cleanProductName(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function cleanCategoryName(value: string) {
  const cleaned = value
    .replace(/\b(view|all|shop|our|the|learn|more|new)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || "Products";
}

function isGenericProductName(value: string) {
  return /^(products?|shop|catalog|collections?|learn more|view all|more|home|contact|about|linkedin|facebook|instagram|youtube|tiktok|twitter|x)$/i.test(value);
}

function linkScore(href: string, text: string) {
  const value = `${href} ${text}`.toLowerCase();
  if (/sitemap|privacy|terms|login|account|cart|checkout|wp-json|feed|tag|author/.test(value)) return -1;
  if (/products?|collections?|catalog|shop|category/.test(value)) return 100;
  if (/contact|support|get-in-touch|where-to-buy/.test(value)) return 90;
  if (/brands?/.test(value)) return 80;
  if (/about|company|story|who-we-are/.test(value)) return 70;
  if (/wholesale|distributor|retail|partner/.test(value)) return 60;
  if (/case|accessor|charger|cable|audio|screen|protector|power|phone/.test(value)) return 55;
  return 0;
}

function isInternalLink(href: string, root: URL) {
  try {
    const url = new URL(href);
    return url.protocol.startsWith("http") && url.hostname.replace(/^www\./, "") === root.hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
}

function stripTracking(href: string) {
  const url = new URL(href);
  url.hash = "";
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((param) => url.searchParams.delete(param));
  return stripTrailingSlash(url.toString());
}

function stripTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function dedupeContacts(contacts: ContactEvidence[]) {
  const seen = new Set<string>();
  return contacts.filter((contact) => {
    const key = `${contact.type}:${contact.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupePages(pages: PageSnapshot[]) {
  const seen = new Set<string>();
  return pages.filter((page) => {
    const key = stripTrailingSlash(page.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function tokenize(input: string) {
  return unique(input.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((word) => word.length > 2);
}
