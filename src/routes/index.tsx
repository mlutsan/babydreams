import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";

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
  const [formData, setFormData] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0], // Today's date
    category: "",
    description: "",
  });

  const handleSubmit = (e: React.FormEvent, addMore: boolean = false) => {
    e.preventDefault();
    console.log("Expense submitted:", formData);
    // TODO: Add actual submission logic in Phase 3
    alert("Expense saved! (In Phase 3, this will save to Google Sheets)");

    if (addMore) {
      // Reset form but keep the date
      setFormData({
        amount: "",
        date: formData.date,
        category: "",
        description: "",
      });
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
                step="0.01"
                placeholder="0.00"
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
              <Button type="submit" className="flex-1">
                Save
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={(e) => handleSubmit(e, true)}
              >
                Add More
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
