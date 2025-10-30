import { createFileRoute } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { sheetUrlAtom, userNameAtom } from "~/lib/atoms";
import { AddExpenseForm as MobileAddExpenseForm } from "~/components/mobile/AddExpenseForm";
import { AddExpenseForm as DesktopAddExpenseForm } from "~/components/desktop/AddExpenseForm";
import { Route as RootRoute } from "./__root";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const sheetUrl = useAtomValue(sheetUrlAtom);
  const userName = useAtomValue(userNameAtom);
  const { isMobile } = RootRoute.useRouteContext();

  const FormComponent = isMobile
    ? MobileAddExpenseForm
    : DesktopAddExpenseForm;

  return <FormComponent sheetUrl={sheetUrl} userName={userName} />;
}
