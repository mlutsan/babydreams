import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { sheetUrlAtom, babyNameAtom } from "~/lib/atoms";
import { Route as RootRoute } from "./__root";
import { Page, Navbar, Block, BlockTitle } from "konsta/react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const sheetUrl = useAtomValue(sheetUrlAtom);
  const babyName = useAtomValue(babyNameAtom);
  const { isMobile } = RootRoute.useRouteContext();

  if (!sheetUrl) {
    return (
      <Page>
        <Navbar title="Baby Dreams" />
        <Block strong inset className="text-center">
          <BlockTitle>Welcome to Baby Dreams</BlockTitle>
          <p>Please configure your Google Sheet in Settings first.</p>
        </Block>
      </Page>
    );
  }

  return (
    <Page>
      <Navbar title="Sleep Tracker" />
      <Block strong inset className="text-center">
        <BlockTitle>Sleep Tracking</BlockTitle>
        <p>Sleep tracking will be implemented in Phase 2.</p>
        <p className="text-sm text-gray-500 mt-4">
          {babyName && `Tracking for: ${babyName}`}
        </p>
      </Block>
    </Page>
  );
}
