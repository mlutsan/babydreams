import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/history')({
  component: HistoryPage,
})

function HistoryPage() {
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-foreground mb-6">Expense History</h2>
      <p className="text-muted-foreground">History list will go here (Phase 4)</p>
    </div>
  )
}
