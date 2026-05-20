import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Boxes, BriefcaseBusiness, Factory, FileText, Plus } from "lucide-react";
import { NavLink, useParams } from "react-router-dom";
import { apiGet, apiPatch, apiPost } from "../api/http";

type CompanyProfile = {
  id: string;
  legalName: string;
  displayName: string;
  websiteUrl?: string;
  summary?: string;
  markets: string[];
};

type KnowledgeRecord = Record<string, unknown> & { id: string; name?: string; title?: string; category?: string; updatedAt?: string };

type Field = { key: string; label: string; type?: "textarea" | "number"; required?: boolean; placeholder?: string };

const sections = [
  { to: "company", label: "公司信息", icon: BriefcaseBusiness },
  { to: "brands", label: "品牌资料", icon: BriefcaseBusiness },
  { to: "products", label: "产品资料", icon: Boxes },
  { to: "oem-capabilities", label: "OEM能力", icon: Factory },
  { to: "certificates", label: "资质证书", icon: Award },
  { to: "cases", label: "成功案例", icon: FileText },
  { to: "email-materials", label: "邮件素材", icon: FileText }
];

const sectionApi: Record<string, string> = {
  brands: "brands",
  products: "products",
  "oem-capabilities": "oem-capabilities",
  certificates: "certificates",
  cases: "case-studies",
  "email-materials": "email-materials"
};

const fieldMap: Record<string, Field[]> = {
  brands: [
    { key: "name", label: "品牌名称", required: true },
    { key: "positioning", label: "品牌定位" },
    { key: "targetMarkets", label: "目标市场", placeholder: "用逗号分隔，如 US,EU" }
  ],
  products: [
    { key: "name", label: "产品名称", required: true },
    { key: "sku", label: "SKU" },
    { key: "category", label: "品类", required: true },
    { key: "description", label: "描述", type: "textarea" },
    { key: "priceMin", label: "最低价", type: "number" },
    { key: "priceMax", label: "最高价", type: "number" },
    { key: "currency", label: "币种", placeholder: "USD" },
    { key: "tags", label: "标签", placeholder: "用逗号分隔" }
  ],
  "oem-capabilities": [
    { key: "name", label: "能力名称", required: true },
    { key: "category", label: "品类", required: true },
    { key: "description", label: "能力说明", type: "textarea" },
    { key: "moq", label: "MOQ" },
    { key: "leadTime", label: "交期" },
    { key: "certifications", label: "关联认证", placeholder: "用逗号分隔" },
    { key: "supportedMarkets", label: "适配市场", placeholder: "用逗号分隔" }
  ],
  certificates: [
    { key: "name", label: "证书名称", required: true },
    { key: "issuer", label: "签发机构" },
    { key: "validUntil", label: "有效期" },
    { key: "fileAssetId", label: "文件ID" }
  ],
  cases: [
    { key: "title", label: "案例标题", required: true },
    { key: "market", label: "市场" },
    { key: "category", label: "品类" },
    { key: "summary", label: "案例摘要", type: "textarea", required: true },
    { key: "result", label: "结果" }
  ],
  "email-materials": [
    { key: "name", label: "素材名称", required: true },
    { key: "materialType", label: "素材类型", required: true, placeholder: "company_intro/signature/template" },
    { key: "content", label: "内容", type: "textarea", required: true },
    { key: "tags", label: "标签", placeholder: "用逗号分隔" }
  ]
};

export function KnowledgeBasePage() {
  const { section = "company" } = useParams();
  const queryClient = useQueryClient();
  const currentSection = sectionApi[section] ? section : "company";
  const [form, setForm] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState("");
  const [message, setMessage] = useState("");

  const companyQuery = useQuery({
    queryKey: ["knowledge", "company-profile"],
    queryFn: () => apiGet<CompanyProfile | null>("/knowledge/company-profile"),
    enabled: Boolean(localStorage.getItem("accessToken"))
  });

  const listQuery = useQuery({
    queryKey: ["knowledge", currentSection],
    queryFn: () => apiGet<KnowledgeRecord[]>(`/knowledge/${sectionApi[currentSection]}`),
    enabled: Boolean(localStorage.getItem("accessToken")) && currentSection !== "company" && Boolean(companyQuery.data)
  });

  const companyMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiPatch<CompanyProfile>("/knowledge/company-profile", payload),
    onSuccess: () => {
      setMessage("公司资料已保存。");
      setForm({});
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "保存失败")
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiPost<KnowledgeRecord>(`/knowledge/${sectionApi[currentSection]}`, payload),
    onSuccess: () => {
      setMessage("资料已新增。");
      setForm({});
      queryClient.invalidateQueries({ queryKey: ["knowledge", currentSection] });
      queryClient.invalidateQueries({ queryKey: ["knowledge", "company-profile"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "保存失败")
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => apiPatch<KnowledgeRecord>(`/knowledge/${sectionApi[currentSection]}/${editingId}`, payload),
    onSuccess: () => {
      setMessage("资料已更新。");
      setForm({});
      setEditingId("");
      queryClient.invalidateQueries({ queryKey: ["knowledge", currentSection] });
      queryClient.invalidateQueries({ queryKey: ["knowledge", "company-profile"] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "保存失败")
  });

  const fields = useMemo(() => currentSection === "company" ? companyFields : fieldMap[currentSection] ?? [], [currentSection]);
  const rows = listQuery.data ?? [];
  const company = companyQuery.data;

  function submit() {
    setMessage("");
    const payload = normalizePayload(form, fields);
    if (currentSection === "company") {
      companyMutation.mutate(payload);
    } else if (editingId) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  function startEdit(row: KnowledgeRecord) {
    setEditingId(row.id);
    setForm(recordToForm(row, fields));
    setMessage("");
  }

  function cancelEdit() {
    setEditingId("");
    setForm({});
    setMessage("");
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Knowledge Base</p>
          <h1>企业资料库</h1>
        </div>
        {currentSection !== "company" ? (
          editingId ? <button className="secondary-button" onClick={cancelEdit}>退出编辑</button> : <button className="primary-button" onClick={submit}><Plus size={16} />新增资料</button>
        ) : null}
      </header>

      <nav className="tab-bar">
        {sections.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={`/knowledge/${item.to}`} className={({ isActive }) => `tab-link ${isActive ? "active" : ""}`}>
              <Icon size={15} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {message ? <section className="panel loading-state">{message}</section> : null}

      <section className="panel">
        <div className="panel-title">
          <h2>{sectionLabel(currentSection)}</h2>
          <span>供背调、评分和开发邮件引用</span>
        </div>
        {currentSection !== "company" && !company ? (
          <div className="empty-state">请先维护公司信息，再新增产品、OEM能力、证书、案例和邮件素材。</div>
        ) : (
          <KnowledgeForm
            fields={fields}
            values={currentSection === "company" && company && !Object.keys(form).length ? companyToForm(company) : form}
            submitLabel={currentSection === "company" ? "保存公司资料" : editingId ? "保存修改" : "新增资料"}
            onChange={setForm}
            onSubmit={submit}
            onCancel={editingId ? cancelEdit : undefined}
            busy={companyMutation.isPending || createMutation.isPending || updateMutation.isPending}
          />
        )}
      </section>

      {currentSection !== "company" && company ? (
        <section className="table-panel">
          <div className="panel-title">
            <h2>已维护资料</h2>
            <span>{rows.length} 条</span>
          </div>
          {listQuery.isLoading ? <div className="empty-state">正在加载资料...</div> : <KnowledgeTable rows={rows} fields={fields} onEdit={startEdit} />}
        </section>
      ) : null}
    </section>
  );
}

const companyFields: Field[] = [
  { key: "legalName", label: "公司全称", required: true },
  { key: "displayName", label: "展示名称", required: true },
  { key: "websiteUrl", label: "官网", placeholder: "https://example.com" },
  { key: "markets", label: "出口市场", placeholder: "用逗号分隔，如 US,EU,UK" },
  { key: "summary", label: "公司简介", type: "textarea" }
];

function KnowledgeForm(props: {
  fields: Field[];
  values: Record<string, string>;
  submitLabel: string;
  busy: boolean;
  onChange: (values: Record<string, string>) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="form-grid">
      {props.fields.map((field) => (
        <label className={field.type === "textarea" ? "wide-field" : ""} key={field.key}>
          <span>{field.label}{field.required ? " *" : ""}</span>
          {field.type === "textarea" ? (
            <textarea value={props.values[field.key] ?? ""} placeholder={field.placeholder} onChange={(event) => props.onChange({ ...props.values, [field.key]: event.target.value })} />
          ) : (
            <input type={field.type ?? "text"} value={props.values[field.key] ?? ""} placeholder={field.placeholder} onChange={(event) => props.onChange({ ...props.values, [field.key]: event.target.value })} />
          )}
        </label>
      ))}
      <div className="wide-field">
        <button className="primary-button" disabled={props.busy} onClick={props.onSubmit}>{props.busy ? "保存中..." : props.submitLabel}</button>
        {props.onCancel ? <button className="secondary-button" onClick={props.onCancel}>取消编辑</button> : null}
      </div>
    </div>
  );
}

function KnowledgeTable({ rows, fields, onEdit }: { rows: KnowledgeRecord[]; fields: Field[]; onEdit: (row: KnowledgeRecord) => void }) {
  if (!rows.length) return <div className="empty-state">暂无资料。</div>;
  const visibleFields = fields.slice(0, 4);
  return (
    <table>
      <thead>
        <tr>
          {visibleFields.map((field) => <th key={field.key}>{field.label}</th>)}
          <th>更新时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {visibleFields.map((field) => <td key={field.key}>{formatValue(row[field.key])}</td>)}
            <td>{row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "-"}</td>
            <td><button className="secondary-button" onClick={() => onEdit(row)}>编辑</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function normalizePayload(values: Record<string, string>, fields: Field[]) {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.key]?.trim();
    if (!value) continue;
    if (["markets", "tags", "targetMarkets", "certifications", "supportedMarkets"].includes(field.key)) {
      payload[field.key] = splitList(value);
    } else if (field.type === "number") {
      payload[field.key] = Number(value);
    } else {
      payload[field.key] = value;
    }
  }
  return payload;
}

function companyToForm(company: CompanyProfile) {
  return {
    legalName: company.legalName,
    displayName: company.displayName,
    websiteUrl: company.websiteUrl ?? "",
    summary: company.summary ?? "",
    markets: company.markets.join(", ")
  };
}

function recordToForm(row: KnowledgeRecord, fields: Field[]) {
  const values: Record<string, string> = {};
  for (const field of fields) {
    const value = row[field.key];
    values[field.key] = Array.isArray(value) ? value.join(", ") : value === null || value === undefined ? "" : String(value);
  }
  return values;
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function formatValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function sectionLabel(section: string) {
  return sections.find((item) => item.to === section)?.label ?? "企业资料库";
}
