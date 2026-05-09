import { getQuery } from "h3"

import {
  getAdminDashboardData,
} from "../../../utils/activityPubAdmin"
import { unauthorizedError, verifyActivityPubAdminRequestSignature } from "../../../utils/activityPubAdminAuth"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const includeDeleted = query.includeDeleted === "1" || query.includeDeleted === "true"

  if (!(await verifyActivityPubAdminRequestSignature(event))) {
    unauthorizedError()
  }

  return await getAdminDashboardData(includeDeleted)
})
