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
import { queryKeys, toast } from "@/lib";

type AssignableRole = "CUSTOMER" | "ADMIN" | "FINANCE";

interface EditCustomerRoleDialogProps {
  customerId: string;
  customerName: string;
  currentRole: string;
  onSuccess?: () => void;
}

export function EditCustomerRoleDialog({
  customerId,
  customerName,
  currentRole,
  onSuccess,
}: EditCustomerRoleDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AssignableRole>(
    (currentRole as AssignableRole) ?? "CUSTOMER"
  );

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      updateCustomerRoleFn({ data: { id: customerId, role: selectedRole } }),

    onSuccess: () => {
      toast.success(`Role ${customerName} diubah ke ${selectedRole}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(customerId) });
      setOpen(false);
      onSuccess?.();
    },

    onError: (err) => {
      toast.error("Gagal mengubah role", err);
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
        Ubah Role
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ubah Role Customer</DialogTitle>
          <DialogDescription>
            Ubah role untuk akun{" "}
            <span className="font-semibold">{customerName}</span>. Role OWNER
            tidak bisa diassign di sini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="role-select">Role baru</Label>
          <Select
            value={selectedRole}
            onValueChange={(v) => setSelectedRole(v as AssignableRole)}
          >
            <SelectTrigger id="role-select" className="w-full">
              <SelectValue placeholder="Pilih role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CUSTOMER">CUSTOMER</SelectItem>
              <SelectItem value="ADMIN">ADMIN</SelectItem>
              <SelectItem value="FINANCE">FINANCE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button
            onClick={() => mutate()}
            disabled={isPending || selectedRole === currentRole}
          >
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
