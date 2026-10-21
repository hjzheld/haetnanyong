export default defineNuxtRouteMiddleware(async (to) => {
  const { user, restore } = useSession();
  await restore();

  if (!user.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } });
  }
});
