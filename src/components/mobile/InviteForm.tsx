import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Block, BlockTitle, List, ListInput, Button } from "konsta/react";
import { UserPlus } from "lucide-react";

interface InviteFormProps {
  sheetUrl: string;
  userName: string;
  setSheetUrl: (url: string) => void;
  setUserName: (name: string) => void;
}

export function InviteForm({
  sheetUrl,
  userName,
  setSheetUrl,
  setUserName
}: InviteFormProps) {
  const navigate = useNavigate();
  const [localName, setLocalName] = useState(userName);
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  // Check if this is a migration (has name param) or new invite
  const urlParams = new URLSearchParams(window.location.search);
  const nameParam = urlParams.get("name");
  const isMigration = Boolean(nameParam);

  useEffect(() => {
    if (nameParam) {
      setLocalName(nameParam);
    }
  }, [nameParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!localName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setUserName(localName.trim());
    setIsSetupComplete(true);

    const message = isMigration
      ? "Migration complete! Your settings are now active in the PWA."
      : "Setup complete! You're ready to start tracking expenses.";

    toast.success(message, {
      duration: 3000,
    });

    setTimeout(() => {
      navigate({ to: "/" });
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <UserPlus className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">
            {isMigration ? "Migrate Your Settings" : "Welcome to Family Finance!"}
          </h1>
          <p className="opacity-70 mt-2">
            {isMigration
              ? "Complete the migration to use your settings in the PWA"
              : "You've been invited to join a shared expense tracker"}
          </p>
        </div>

        <Block strong inset>
          <BlockTitle>
            {isMigration ? "Confirm Your Settings" : "Complete Your Setup"}
          </BlockTitle>
          <form onSubmit={handleSubmit}>
            <List strongIos insetIos>
              <ListInput
                label="Your Name"
                type="text"
                placeholder="Enter your name"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                disabled={isSetupComplete}
                input
                floatingLabel
                info="This name will be used to identify your expenses"
              />
            </List>
            <div className="p-4">
              <Button
                type="submit"
                className="w-full"
                disabled={isSetupComplete || !localName.trim()}
                large
              >
                {isSetupComplete ? "Redirecting..." : isMigration ? "Complete Migration" : "Complete Setup"}
              </Button>
            </div>
          </form>
        </Block>

        <div className="text-center mt-4">
          <p className="text-sm opacity-70">
            {isMigration
              ? "Your Google Sheet and name will be saved in the PWA"
              : "The Google Sheet has been configured automatically"}
          </p>
        </div>
      </div>
    </div>
  );
}
