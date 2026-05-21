# OEM Customer Development CRM

独立部署的外贸 OEM/ODM 客户开发 CRM 系统，用于客户录入、官网背调、OEM 适配评分、AI 邮件草稿、人工审核发送、客户跟进、邮件归档和管理看板。

## Tech Stack

- Frontend: React + Vite + TypeScript
- Backend: NestJS + TypeScript
- Database: PostgreSQL + Prisma
- Cache / Queue: Redis + BullMQ
- Website Analysis: Playwright
- Email: SMTP + IMAP
- Deployment: Docker Compose, private deployment friendly

## Project Structure

```text
apps/
  api/       NestJS backend
  web/       React frontend
packages/
  shared/    shared enums and DTO-friendly types
docs/
  design.md  architecture, ER, API, routes, milestones
```

## Quick Start

```bash
cp .env.example .env
docker compose up -d postgres redis minio
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

数据库表结构由 Prisma migration 创建，不需要手动导入单独的 SQL 配置文件。建表 SQL 位于：

```text
apps/api/prisma/migrations/*/migration.sql
```

更完整的本地搭建说明见 [docs/setup.md](docs/setup.md)。

Default seed login:

- Email: `admin@oem-crm.local`
- Password: `Admin@123456`

The first implementation milestone focuses on the foundation: database schema, RBAC, customer lifecycle, AI audit trail, website analysis jobs, email review workflow, and dashboard query boundaries.
