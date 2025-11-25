import { ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { App, KonstaProvider, Navbar, NavbarBackLink, Page, Tabbar, TabbarLink, ToolbarPane, Toast, Button } from "konsta/react";
import { Milk, Moon, Settings } from "lucide-react";
import { Route as IndexRoute } from "~/routes/index";
import { Route as SettingsRoute } from "~/routes/settings";
import { Route as HistoryRoute } from "~/routes/history";
import { Route as EatRoute } from "~/routes/eat";
import { PullToRefresh } from "~/components/PullToRefresh";
import { useToast } from "~/hooks/useToast";

interface MobileLayoutProps {
  children: ReactNode;
}

export function MobileLayout({ children }: MobileLayoutProps) {
  const router = useRouterState();
  const navigate = useNavigate();
  const { toast: toastState, isOpen: toastOpen, close: closeToast } = useToast();

  // Determine navbar configuration based on current route
  const isHistoryPage = router.location.pathname === HistoryRoute.to;
  const isEatPage = router.location.pathname === EatRoute.to;
  const isIndexPage = router.location.pathname === IndexRoute.to;

  let navbarTitle = "Baby Dreams";
  if (isHistoryPage) {
    navbarTitle = "Sleep History";
  } else if (isEatPage) {
    navbarTitle = "Feeding";
  }

  const showBackButton = isHistoryPage;

  // Determine which queries to invalidate on pull-to-refresh
  const queryKeys: string[][] = [];
  if (isIndexPage || isHistoryPage) {
    queryKeys.push(["history"]);
  }
  if (isEatPage) {
    queryKeys.push(["history"], ["eatHistory"]);
  }

  return (
    <KonstaProvider theme="ios">
      <App theme="ios" safeAreas>
        <Page className="pb-10">
          <Navbar
            title={navbarTitle}
            left={showBackButton ? (
              <NavbarBackLink onClick={() => window.history.back()} ></NavbarBackLink>
            ) : undefined}
          />
          <PullToRefresh queryKeys={queryKeys}>
            {children}
            <div className="h-[120px]"></div>

          </PullToRefresh>


          <Tabbar labels icons className="left-0 bottom-0 fixed">
            <ToolbarPane>
              <TabbarLink
                active={router.location.pathname === IndexRoute.to || router.location.pathname == HistoryRoute.to}
                icon={<Moon className="w-6 h-6" />}
                label="Sleep"
                onClick={() => {
                  navigate({
                    to: IndexRoute.to,
                  });
                }}
              />
              <TabbarLink
                active={router.location.pathname === EatRoute.to}
                icon={<Milk className="w-6 h-6" />}
                label="Eat"
                onClick={() => {
                  navigate({
                    to: EatRoute.to,
                  });
                }}
              />
              <TabbarLink
                active={router.location.pathname === SettingsRoute.to}
                icon={<Settings className="w-6 h-6" />}
                label="Settings"
                onClick={() => {
                  navigate({
                    to: SettingsRoute.to,
                  });
                }}
              />
            </ToolbarPane>

          </Tabbar>

          {/* Global Toast for all routes */}
          <Toast
            position="center"
            opened={toastOpen}
            button={
              <Button
                rounded
                clear
                small
                inline
                onClick={closeToast}
              >
                Close
              </Button>
            }
          >
            <div className="shrink">
              <div className="font-semibold">{toastState?.message}</div>
              {toastState?.description && (
                <div className="text-sm opacity-75 mt-1">{toastState.description}</div>
              )}
            </div>
          </Toast>
        </Page>


      </App>
    </KonstaProvider>
  );
}
