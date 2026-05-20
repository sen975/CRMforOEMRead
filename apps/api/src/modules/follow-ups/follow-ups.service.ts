import { Injectable, NotFoundException } from "@nestjs/common";
import { FollowUpTaskStatus } from "@oem-crm/shared";
import { RequestUser } from "../../common/auth/current-user.decorator";
import { buildCustomerDataScopeWhere } from "../../common/query/data-scope";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateFollowUpTaskDto } from "./dto/create-follow-up-task.dto";
import { UpdateFollowUpTaskDto } from "./dto/update-follow-up-task.dto";

@Injectable()
export class FollowUpsService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: RequestUser, status?: string) {
    return this.prisma.followUpTask.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        customer: buildCustomerDataScopeWhere(user)
      },
      include: {
        customer: { select: { id: true, name: true, stage: true, websiteDomain: true } },
        owner: { select: { id: true, name: true } }
      },
      orderBy: [{ dueAt: "asc" }]
    });
  }

  async create(user: RequestUser, dto: CreateFollowUpTaskDto) {
    await this.ensureCustomerVisible(user, dto.customerId);
    return this.prisma.followUpTask.create({
      data: {
        customerId: dto.customerId,
        ownerId: dto.ownerId ?? user.id,
        type: dto.type as never,
        title: dto.title,
        description: dto.description,
        trigger: dto.trigger,
        dueAt: new Date(dto.dueAt)
      }
    });
  }

  async update(user: RequestUser, id: string, dto: UpdateFollowUpTaskDto) {
    await this.ensureVisibleTask(user, id);
    return this.prisma.followUpTask.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        status: dto.status as never
      }
    });
  }

  async complete(user: RequestUser, id: string) {
    await this.ensureVisibleTask(user, id);
    return this.prisma.followUpTask.update({
      where: { id },
      data: {
        status: FollowUpTaskStatus.Completed as never,
        completedAt: new Date()
      }
    });
  }

  async createByRule(input: {
    customerId: string;
    ownerId: string;
    type: string;
    title: string;
    trigger: string;
    dueAt: Date;
    description?: string;
  }) {
    return this.prisma.followUpTask.create({
      data: {
        customerId: input.customerId,
        ownerId: input.ownerId,
        type: input.type as never,
        title: input.title,
        description: input.description,
        trigger: input.trigger,
        dueAt: input.dueAt
      }
    });
  }

  private async ensureVisibleTask(user: RequestUser, id: string) {
    const task = await this.prisma.followUpTask.findFirst({
      where: { id, customer: buildCustomerDataScopeWhere(user) }
    });
    if (!task) {
      throw new NotFoundException("Follow-up task not found");
    }
    return task;
  }

  private async ensureCustomerVisible(user: RequestUser, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, ...buildCustomerDataScopeWhere(user) }
    });
    if (!customer) {
      throw new NotFoundException("Customer not found");
    }
    return customer;
  }
}
