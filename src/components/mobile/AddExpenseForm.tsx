import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Block, List, ListInput, Button } from "konsta/react";
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
    <Block strong inset>
      <form onSubmit={(e) => handleSubmit(e, false)}>
        <List strongIos insetIos>
          <ListInput
            label="Amount"
            placeholder="0"
            value={formData.amount}
            onChange={(e) =>
              setFormData({ ...formData, amount: e.target.value })
            }
            required
          />

          <ListInput
            label="Date"
            type="date"
            value={formData.date}
            onChange={(e) =>
              setFormData({ ...formData, date: e.target.value })
            }
            required
          />

          <ListInput
            label="Category"
            type="select"
            dropdown
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
          </ListInput>

          <ListInput
            label="Description"
            type="textarea"
            placeholder="Add details about this expense..."
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            inputClassName="!h-20 resize-none"
          />
        </List>

        <div className="p-4">
          <Button
            type="submit"
            rounded
            className="w-full"
            disabled={isSubmitting}
            large
          >
            {isSubmitting ? "Saving..." : "Save Expense"}
          </Button>
        </div>
      </form>
    </Block>
  );
}
