import { ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { App, KonstaProvider, Navbar, Page, Tabbar, TabbarLink, ToolbarPane } from "konsta/react";
import { Moon, Settings } from "lucide-react";
import { Route as IndexRoute } from "~/routes/index";
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
            <Navbar title="Baby Dreams" />
            {children}

            <Tabbar labels icons className="left-0 bottom-0 fixed">
              <ToolbarPane>
                <TabbarLink
                  active={router.location.pathname === IndexRoute.to}
                  icon={<Moon className="w-6 h-6" />}
                  label="Sleep"
                  onClick={() => {
                    navigate({
                      to: IndexRoute.to,
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
