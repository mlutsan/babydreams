import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAtomValue } from "jotai";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { createExpense } from "~/server/expenses";
import { sheetUrlAtom, userNameAtom } from "~/lib/atoms";

export const Route = createFileRoute("/")({
  component: Home,
});

// Hardcoded categories for Phase 1
const CATEGORIES = [
  "Groceries",
  "Transportation",
  "Dining",
  "Entertainment",
  "Utilities",
  "Healthcare",
  "Shopping",
  "Other",
];

function Home() {
  const navigate = useNavigate();

  // Get configuration data from Jotai atoms
  const sheetUrl = useAtomValue(sheetUrlAtom);
  const userName = useAtomValue(userNameAtom);

  const [formData, setFormData] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0], // Today's date
    category: "",
    description: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent, addMore: boolean = false) => {
    e.preventDefault();

    // Validation: Check if sheet URL is configured
    if (!sheetUrl) {
      toast.error("Please configure your Google Sheet in Settings", {
        action: {
          label: "Go to Settings",
          onClick: () => navigate({ to: "/settings" }),
        },
      });
      return;
    }

    // Validation: Check if user name is set
    if (!userName) {
      toast.error("Please set your name in Settings", {
        action: {
          label: "Go to Settings",
          onClick: () => navigate({ to: "/settings" }),
        },
      });
      return;
    }

    // Validation: Check form data
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!formData.category) {
      toast.error("Please select a category");
      return;
    }

    setIsSubmitting(true);

    try {
      await createExpense({
        data: {
          amount: parseFloat(formData.amount),
          date: formData.date,
          category: formData.category,
          description: formData.description,
          authorName: userName,
          sheetUrl,
        },
      });

      // Show success message
      toast.success("Expense saved successfully!", {
        description: `${formData.category}: $${formData.amount}`,
      });

      // Reset form after successful save
      if (addMore) {
        // Keep category and date for quick entry
        setFormData({
          amount: "",
          date: formData.date,
          category: formData.category,
          description: "",
        });
      } else {
        // Reset entire form
        setFormData({
          amount: "",
          date: new Date().toISOString().split("T")[0],
          category: "",
          description: "",
        });
      }
    } catch (error) {
      console.error("Failed to save expense:", error);

      const errorMessage = error instanceof Error ? error.message : "Failed to save expense";

      // Check for specific error cases
      if (errorMessage.includes("Expenses sheet not found")) {
        toast.error("Expenses sheet not found", {
          description: "Please create an 'Expenses' sheet in your Google Spreadsheet",
          action: {
            label: "View Help",
            onClick: () => {
              toast.info("Sheet Setup Required", {
                description: "Create a sheet named 'Expenses' with columns: Date | Category | Amount | Description | Author",
                duration: 10000,
              });
            },
          },
        });
      } else if (errorMessage.includes("Invalid authentication")) {
        toast.error("Session expired", {
          description: "Please sign in again to continue",
        });
      } else if (errorMessage.includes("Invalid Google Sheets URL")) {
        toast.error("Invalid sheet configuration", {
          description: "Please check your sheet URL in Settings",
          action: {
            label: "Go to Settings",
            onClick: () => navigate({ to: "/settings" }),
          },
        });
      } else {
        toast.error("Failed to save expense", {
          description: errorMessage,
          action: {
            label: "Retry",
            onClick: () => handleSubmit(e, addMore),
          },
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Add Expense</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
            {/* Amount Field */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="1"
                placeholder="0"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                required
              />
            </div>

            {/* Date Field */}
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                required
              />
            </div>

            {/* Category Field */}
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                id="category"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                required
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            </div>

            {/* Description Field */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add details about this expense..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                className="flex-1"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
              {/* <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={(e) => handleSubmit(e, true)}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save & Add Another"}
              </Button> */}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
