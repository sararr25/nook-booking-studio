import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { handleOAuthReturn } from "./components/nook/oauth-return";

let oauthReturnHandled = false;

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  if (typeof window !== "undefined" && !oauthReturnHandled) {
    oauthReturnHandled = true;
    handleOAuthReturn((to) => {
      const go = () =>
        void router.navigate(
          to === "/auth" ? { to, search: { notice: undefined }, replace: true } : { to, replace: true },
        );
      // Wait until the initial client load settles so navigation doesn't race hydration.
      if (router.state.status === "idle" && router.state.matches.length > 0) {
        go();
        return;
      }
      const unsubscribe = router.subscribe("onResolved", () => {
        unsubscribe();
        go();
      });
    });
  }

  return router;
};
