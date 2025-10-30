import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAtom } from "jotai";
import { toast } from "sonner";
import { sheetUrlAtom, userNameAtom } from "~/lib/atoms";
import { InviteForm as MobileInviteForm } from "~/components/mobile/InviteForm";
import { InviteForm as DesktopInviteForm } from "~/components/desktop/InviteForm";
import { Route as RootRoute } from "./__root";

export const Route = createFileRoute("/invite")({
  component: InvitePage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      sheet: (search.sheet as string) || "",
      name: (search.name as string) || "",
    };
  },
});

function InvitePage() {
  const navigate = useNavigate();
  const { sheet, name } = Route.useSearch();
  const { isMobile } = RootRoute.useRouteContext();

  const [sheetUrl, setSheetUrl] = useAtom(sheetUrlAtom);
  const [userName, setUserName] = useAtom(userNameAtom);

  useEffect(() => {
    if (!sheet) {
      toast.error("Invalid invite link", {
        description: "No sheet URL found in the invite link",
      });
      navigate({ to: "/settings" });
      return;
    }

    // Decode and save the sheet URL
    try {
      const decodedSheet = decodeURIComponent(sheet);
      setSheetUrl(decodedSheet);

      // If name parameter is present, this is a personal migration link
      if (name) {
        toast.success("Settings ready to migrate!", {
          description: "Click 'Complete Setup' to finish migration",
        });
      } else {
        toast.success("Sheet configured!", {
          description: "Now enter your name to complete setup",
        });
      }
    } catch {
      toast.error("Invalid invite link", {
        description: "Failed to decode sheet URL",
      });
      navigate({ to: "/settings" });
    }
  }, [sheet, name, setSheetUrl, navigate]);

  const FormComponent = isMobile ? MobileInviteForm : DesktopInviteForm;

  return (
    <FormComponent
      sheetUrl={sheetUrl}
      userName={userName}
      setSheetUrl={setSheetUrl}
      setUserName={setUserName}
    />
  );
}
