import { ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { App, KonstaProvider, Navbar, Page, Tabbar, TabbarLink, ToolbarPane } from "konsta/react";
import { Plus, Clock, Settings } from "lucide-react";
import { Route as IndexRoute } from "~/routes/index";
import { Route as HistoryRoute } from "~/routes/history";
import { Route as SettingsRoute } from "~/routes/settings";

interface MobileLayoutProps {
  children: ReactNode;
}

export function MobileLayout({ children }: MobileLayoutProps) {
  const router = useRouterState();
  const navigate = useNavigate();

  return (
    <div data-ui-mode="mobile">
      <KonstaProvider theme="ios">
        <App theme="ios" safeAreas>
          <Page>
            <Navbar title="Family Finance" />
            {children}

            <Tabbar labels icons className="left-0 bottom-0 fixed">
              <ToolbarPane>

                <TabbarLink
                  active={router.location.pathname === IndexRoute.to}
                  icon={<Plus className="w-6 h-6" />}
                  label="Add"
                  onClick={() => {
                    navigate({
                      to: IndexRoute.to,
                    });
                  }}
                />
                <TabbarLink
                  active={router.location.pathname === HistoryRoute.to}
                  icon={<Clock className="w-6 h-6" />}
                  label="History"
                  onClick={() => {
                    navigate({
                      to: HistoryRoute.to,
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
          </Page>
        </App>
      </KonstaProvider>
    </div>
  );
}
