import { safeInternalRedirect } from '~/utils/navigation';

export default defineNuxtRouteMiddleware(async (to) => {
  const { user, restore } = useSession();
  await restore();

  if (user.value) {
    return navigateTo(safeInternalRedirect(to.query.redirect), { replace: true });
  }
});
