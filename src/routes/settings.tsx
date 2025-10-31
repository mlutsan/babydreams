import { createFileRoute } from "@tanstack/react-router";
import { useAtom } from "jotai";
import { sheetUrlAtom, babyNameAtom, babyBirthdateAtom } from "~/lib/atoms";
import { SettingsForm as MobileSettingsForm } from "~/components/mobile/SettingsForm";
import { SettingsForm as DesktopSettingsForm } from "~/components/desktop/SettingsForm";
import { Route as RootRoute } from "./__root";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [sheetUrl, setSheetUrl] = useAtom(sheetUrlAtom);
  const [babyName, setBabyName] = useAtom(babyNameAtom);
  const [babyBirthdate, setBabyBirthdate] = useAtom(babyBirthdateAtom);
  const { isMobile } = RootRoute.useRouteContext();

  const FormComponent = isMobile
    ? MobileSettingsForm
    : DesktopSettingsForm;

  return (
    <FormComponent
      sheetUrl={sheetUrl}
      babyName={babyName}
      babyBirthdate={babyBirthdate}
      setSheetUrl={setSheetUrl}
      setBabyName={setBabyName}
      setBabyBirthdate={setBabyBirthdate}
    />
  );
}
