/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import * as React from "react";
import type { QueryClient } from "@tanstack/react-query";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import appCss from "../styles.css?url";
import appCssMobile from "../styles-mobile.css?url";

import { MobileLayout } from "~/components/mobile/MobileLayout";
import { DesktopLayout } from "~/components/desktop/DesktopLayout";

interface RootContext {
  queryClient: QueryClient;
  isMobile?: boolean;
}

export const Route = createRootRouteWithContext<RootContext>()({
  beforeLoad: async () => {
    // Detect device type - for SSR this would use request headers
    // For now, we use client-side detection as a starting point
    const isMobile = true;//typeof window !== "undefined" ? window.innerWidth < 768 : true;

    return {
      isMobile,
    };
  },
  head: (ctx) => {
    const isMobile = ctx.match.context.isMobile;
    return ({
      meta: [
        {
          charSet: "utf-8",
        },
        {
          name: "viewport",
          content:
            "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
        },
        {
          title: "Baby Dreams: Baby Activity Tracker",
        },
        {
          name: "description",
          content:
            "Track your baby's sleep and feeding schedule with Google Sheets integration",
        },
        {
          name: "theme-color",
          content: "#FF8C42",
          media: "(prefers-color-scheme: light)",
        },
        {
          name: "theme-color",
          content: "#141414",
          media: "(prefers-color-scheme: dark)",
        },
        {
          name: "apple-mobile-web-app-capable",
          content: "yes",
        },
        {
          name: "apple-mobile-web-app-status-bar-style",
          content: "default",
        },
        {
          name: "mobile-web-app-capable",
          content: "yes",
        },
      ],
      links: [
        { rel: "stylesheet", href: isMobile ? appCssMobile : appCss },
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: "/apple-touch-icon.png",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "32x32",
          href: "/favicon-32x32.png",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "16x16",
          href: "/favicon-16x16.png",
        },
        { rel: "manifest", href: "/site.webmanifest" },
        { rel: "icon", href: "/favicon.ico" },
      ],
      scripts: [
        {
          src: "https://accounts.google.com/gsi/client",
          async: true,
        },
      ],
    });
  },
  errorComponent: (props) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    );
  },
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode; }) {
  const [isDark, setIsDark] = React.useState(false);
  const context = Route.useRouteContext();
  const isMobile = context.isMobile ?? true;

  React.useEffect(() => {
    // Check system preference for dark mode
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const LayoutComponent = isMobile ? MobileLayout : DesktopLayout;

  return (
    <html className={isDark ? "dark" : ""}>
      <head>
        <HeadContent />
      </head>
      <body>
        <LayoutComponent>{children}</LayoutComponent>

        <TanStackRouterDevtools position="bottom-right" />
        <ReactQueryDevtools buttonPosition="bottom-left" />

        <Scripts />
      </body>
    </html>
  );
}
