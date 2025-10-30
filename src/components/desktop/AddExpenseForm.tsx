import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { createExpense } from "~/server/expenses";

const CATEGORIES = [
  "Groceries",
  "Shopping",
  "Dining",
  "Transport",
  "Health",
  "Entertainment",
  "Bills",
  "Other",
];

interface AddExpenseFormProps {
  sheetUrl: string;
  userName: string;
}

export function AddExpenseForm({ sheetUrl, userName }: AddExpenseFormProps) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    category: "",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (
    e: React.FormEvent,
    continueAdding: boolean = false
  ) => {
    e.preventDefault();

    if (!sheetUrl) {
      toast.error("Google Sheet URL not configured", {
        description: "Please configure your Google Sheet in Settings",
        duration: 5000,
      });
      navigate({ to: "/settings" });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createExpense({
        data: {
          sheetUrl,
          amount: Number.parseFloat(formData.amount),
          date: formData.date,
          category: formData.category,
          description: formData.description,
          authorName: userName,
        },
      });

      if (!result.success) {
        toast.error("Failed to save expense", {
          description: result.message || "Unknown error occurred",
          duration: 5000,
        });
        return;
      }

      toast.success("Expense added!", {
        description: `₹${formData.amount} for ${formData.category}`,
        duration: 3000,
      });

      if (continueAdding) {
        setFormData({
          amount: "",
          date: new Date().toISOString().split("T")[0],
          category: formData.category,
          description: "",
        });
      } else {
        navigate({ to: "/history" });
      }
    } catch (error) {
      console.error("Error submitting expense:", error);
      toast.error("Error saving expense", {
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        duration: 5000,
      });
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
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
