import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { updateCustomerRoleFn } from "@/server/customers";
import { toast } from "@/lib";

// OWNER role cannot be assigned here — it is set at the infrastructure level.
type AssignableRole = "ADMIN" | "FINANCE";

interface EditUserRoleDialogProps {
  userId: string;
  userName: string;
  currentRole: string;
  onSuccess?: () => void;
}

export function EditUserRoleDialog({
  userId,
  userName,
  currentRole,
  onSuccess,
}: EditUserRoleDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AssignableRole>(
    currentRole === "ADMIN" || currentRole === "FINANCE"
      ? (currentRole as AssignableRole)
      : "ADMIN"
  );

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      updateCustomerRoleFn({ data: { id: userId, role: selectedRole } }),

    onSuccess: () => {
      toast.success(`Role ${userName} changed to ${selectedRole}`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setOpen(false);
      onSuccess?.();
    },

    onError: (err) => {
      toast.error("Failed to change role", err);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start"
          />
        }
      >
        Change Role
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Role</DialogTitle>
          <DialogDescription>
            Update the role for{" "}
            <span className="font-semibold">{userName}</span>. The OWNER role
            cannot be assigned here.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="role-select">New role</Label>
          <Select
            value={selectedRole}
            onValueChange={(v) => setSelectedRole(v as AssignableRole)}
          >
            <SelectTrigger id="role-select" className="w-full">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ADMIN">ADMIN</SelectItem>
              <SelectItem value="FINANCE">FINANCE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutate()}
            disabled={isPending || selectedRole === currentRole}
          >
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
