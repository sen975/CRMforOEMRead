import { RequestUser } from "../auth/current-user.decorator";

export function buildCustomerDataScopeWhere(user: RequestUser) {
  if (user.dataScope === "ALL") {
    return { organizationId: user.organizationId };
  }

  if (user.dataScope === "TEAM" && user.teamId) {
    return {
      organizationId: user.organizationId,
      OR: [{ ownerId: user.id }, { owner: { teamId: user.teamId } }]
    };
  }

  return {
    organizationId: user.organizationId,
    ownerId: user.id
  };
}

