import { requireUser } from '#server/utils/auth';

export default defineEventHandler(async (event) => ({ user: await requireUser(event) }));
