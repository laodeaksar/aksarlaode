import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { UserPlusIcon } from "lucide-react";

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
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { inviteUserFn } from "@/server/users";
import { toast } from "@/lib";

type AssignableRole = "ADMIN" | "FINANCE";

export function InviteUserDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AssignableRole>("ADMIN");

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      inviteUserFn({
        data: { email: email.trim(), role, name: name.trim() || undefined },
      }),

    onSuccess: (result) => {
      toast.success(`Undangan dikirim ke ${result.email}`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setOpen(false);
      setEmail("");
      setName("");
      setRole("ADMIN");
    },

    onError: (err: unknown) => {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Gagal mengirim undangan";
      toast.error(message);
    },
  });

  const isValid = email.trim().includes("@");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <UserPlusIcon className="mr-2 h-4 w-4" />
        Invite User
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite Staff Member</DialogTitle>
          <DialogDescription>
            A 24-hour invitation link will be emailed. They'll set their own
            password when they accept.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-name">
              Display name{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="invite-name"
              type="text"
              placeholder="Derived from email if blank"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as AssignableRole)}
            >
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">
                  ADMIN — Full product &amp; order management
                </SelectItem>
                <SelectItem value="FINANCE">
                  FINANCE — Read-only orders &amp; revenue
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutate()} disabled={isPending || !isValid}>
            {isPending ? "Sending..." : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
