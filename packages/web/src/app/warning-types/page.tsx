"use client"

import { useState, useEffect } from "react"
import { AppLayout } from "@/components/AppLayout"
import { PlayerProvider, usePlayer } from "@/lib/player-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Pencil, Trash2, Plus } from "lucide-react"

interface WarningType {
  id: number
  name: string
  severity: number
  createdAt: string
  updatedAt: string
}

function WarningTypesContent() {
  const { selectedPlayer } = usePlayer()
  const [warningTypes, setWarningTypes] = useState<WarningType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingWarningType, setEditingWarningType] = useState<WarningType | null>(null)
  const [deleteWarningTypeId, setDeleteWarningTypeId] = useState<number | null>(null)
  const [formData, setFormData] = useState({ name: "", severity: "" })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!selectedPlayer) return

    async function fetchWarningTypes() {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `/api/warning-types?allyCode=${selectedPlayer.allyCode}`
        )

        if (response.status === 403) {
          const data = await response.json()
          setError(data.error || "You do not have permission to view warning types")
          return
        }

        if (!response.ok) throw new Error("Failed to fetch warning types")

        const data = await response.json()
        setWarningTypes(data.warningTypes)
      } catch (error) {
        console.error("Error fetching warning types:", error)
        setError("Failed to load warning types")
      } finally {
        setIsLoading(false)
      }
    }

    fetchWarningTypes()
  }, [selectedPlayer])

  const handleCreate = async () => {
    if (!selectedPlayer || !formData.name || !formData.severity) return

    setIsSaving(true)
    try {
      const response = await fetch("/api/warning-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allyCode: selectedPlayer.allyCode,
          name: formData.name,
          severity: parseInt(formData.severity),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create warning type")
      }

      const data = await response.json()
      setWarningTypes([...warningTypes, data.warningType])
      setIsCreateDialogOpen(false)
      setFormData({ name: "", severity: "" })
    } catch (error) {
      console.error("Error creating warning type:", error)
      alert(error instanceof Error ? error.message : "Failed to create warning type")
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!selectedPlayer || !editingWarningType || !formData.name || !formData.severity) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/warning-types/${editingWarningType.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allyCode: selectedPlayer.allyCode,
          name: formData.name,
          severity: parseInt(formData.severity),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update warning type")
      }

      const data = await response.json()
      setWarningTypes(
        warningTypes.map((wt) =>
          wt.id === editingWarningType.id ? data.warningType : wt
        )
      )
      setIsEditDialogOpen(false)
      setEditingWarningType(null)
      setFormData({ name: "", severity: "" })
    } catch (error) {
      console.error("Error updating warning type:", error)
      alert(error instanceof Error ? error.message : "Failed to update warning type")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedPlayer || deleteWarningTypeId === null) return

    setIsSaving(true)
    try {
      const response = await fetch(
        `/api/warning-types/${deleteWarningTypeId}?allyCode=${selectedPlayer.allyCode}`,
        { method: "DELETE" }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete warning type")
      }

      setWarningTypes(warningTypes.filter((wt) => wt.id !== deleteWarningTypeId))
      setDeleteWarningTypeId(null)
    } catch (error) {
      console.error("Error deleting warning type:", error)
      alert(error instanceof Error ? error.message : "Failed to delete warning type")
    } finally {
      setIsSaving(false)
    }
  }

  const openEditDialog = (warningType: WarningType) => {
    setEditingWarningType(warningType)
    setFormData({ name: warningType.name, severity: warningType.severity.toString() })
    setIsEditDialogOpen(true)
  }

  if (!selectedPlayer) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center">
        <p className="text-muted-foreground">
          No player selected. Please register a player first.
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-red-600 font-medium">{error}</p>
        <p className="mt-2 text-sm text-red-500">
          Only officers and leaders can manage warning types.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Warning Types</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage warning types for your guild
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Warning Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Warning Type</DialogTitle>
              <DialogDescription>
                Add a new warning type for your guild. Higher severity numbers indicate more serious warnings.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Name</Label>
                <Input
                  id="create-name"
                  placeholder="e.g., Ticket Violation"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-severity">Severity (1-10)</Label>
                <Input
                  id="create-severity"
                  type="number"
                  min="1"
                  max="10"
                  placeholder="e.g., 5"
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false)
                  setFormData({ name: "", severity: "" })
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isSaving || !formData.name || !formData.severity}>
                {isSaving ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading warning types...
          </div>
        ) : warningTypes.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No warning types defined yet. Create one to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warningTypes.map((warningType) => (
                <TableRow key={warningType.id}>
                  <TableCell className="font-medium">{warningType.name}</TableCell>
                  <TableCell>
                    <span
                      className={
                        warningType.severity >= 8
                          ? "font-semibold text-red-600"
                          : warningType.severity >= 5
                          ? "font-semibold text-orange-600"
                          : "text-gray-900"
                      }
                    >
                      {warningType.severity}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(warningType)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteWarningTypeId(warningType.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Warning Type</DialogTitle>
            <DialogDescription>
              Update the warning type details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                placeholder="e.g., Ticket Violation"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-severity">Severity (1-10)</Label>
              <Input
                id="edit-severity"
                type="number"
                min="1"
                max="10"
                placeholder="e.g., 5"
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false)
                setEditingWarningType(null)
                setFormData({ name: "", severity: "" })
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isSaving || !formData.name || !formData.severity}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteWarningTypeId !== null}
        onOpenChange={(open) => !open && setDeleteWarningTypeId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this warning type. All warnings of this type will also be deleted.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isSaving}>
              {isSaving ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function WarningTypesPage() {
  return (
    <PlayerProvider>
      <AppLayout>
        <WarningTypesContent />
      </AppLayout>
    </PlayerProvider>
  )
}
