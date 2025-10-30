import { createFileRoute } from "@tanstack/react-router";
import { useAtom } from "jotai";
import { sheetUrlAtom, userNameAtom } from "~/lib/atoms";
import { SettingsForm as MobileSettingsForm } from "~/components/mobile/SettingsForm";
import { SettingsForm as DesktopSettingsForm } from "~/components/desktop/SettingsForm";
import { Route as RootRoute } from "./__root";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [sheetUrl, setSheetUrl] = useAtom(sheetUrlAtom);
  const [userName, setUserName] = useAtom(userNameAtom);
  const { isMobile } = RootRoute.useRouteContext();

  const FormComponent = isMobile
    ? MobileSettingsForm
    : DesktopSettingsForm;

  return (
    <FormComponent
      sheetUrl={sheetUrl}
      userName={userName}
      setSheetUrl={setSheetUrl}
      setUserName={setUserName}
    />
  );
}
