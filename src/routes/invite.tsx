import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAtom } from "jotai";
import { sheetUrlAtom } from "~/lib/atoms";
import { Page, Navbar, Block, BlockTitle, Button } from "konsta/react";
import { useToast } from "~/hooks/useToast";

export const Route = createFileRoute("/invite")({
  component: InvitePage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      sheet: (search.sheet as string) || "",
    };
  },
});

function InvitePage() {
  const navigate = useNavigate();
  const { sheet } = Route.useSearch();
  const { success, error } = useToast();

  const [, setSheetUrl] = useAtom(sheetUrlAtom);

  useEffect(() => {
    if (!sheet) {
      error("Invalid setup link", {
        description: "No sheet URL found in the link",
      });
      navigate({ to: "/settings" });
      return;
    }

    // Decode and save the sheet URL
    try {
      const decodedSheet = decodeURIComponent(sheet);
      setSheetUrl(decodedSheet);

      success("Sheet configured!", {
        description: "Your sheet URL has been restored. Configure baby profile in Settings.",
      });
    } catch {
      error("Invalid setup link", {
        description: "Failed to decode sheet URL",
      });
      navigate({ to: "/settings" });
    }
  }, [sheet, setSheetUrl, navigate, success, error]);

  return (
    <Page>
      <Navbar title="Setup Complete" />
      <Block strong inset className="text-center">
        <BlockTitle>Sheet Configured</BlockTitle>
        <p className="mb-4">Your Google Sheet has been configured successfully.</p>
        <Button large rounded onClick={() => navigate({ to: "/settings" })}>
          Go to Settings
        </Button>
      </Block>
    </Page>
  );
}
