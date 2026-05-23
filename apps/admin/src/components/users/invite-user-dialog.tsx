import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, useField, useForm } from "@formisch/react";

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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { inviteUserFn } from "@/server/users";
import { queryKeys, toast } from "@/lib";
import { InviteUserSchema, type InviteUserFields } from "@/schemas/forms";

export function InviteUserDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const form = useForm({
    schema: InviteUserSchema,
    initialInput: { email: "", name: "", role: "ADMIN" as const },
  });

  const emailField = useField(form, { path: ["email"] as const });
  const nameField = useField(form, { path: ["name"] as const });
  const roleField = useField(form, { path: ["role"] as const });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: InviteUserFields) =>
      inviteUserFn({
        data: {
          email: data.email,
          role: data.role,
          name: data.name?.trim() || undefined,
        },
      }),

    onSuccess: (result) => {
      toast.persistent(`Undangan dikirim ke ${result.email}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers.all });
      setOpen(false);
    },

    onError: (err: unknown) => {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Gagal mengirim undangan";
      toast.error(message);
    },
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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

        <Form
          of={form}
          onSubmit={(data) => mutate(data)}
          className="space-y-4 py-2"
        >
          <FieldGroup>
            <Field data-invalid={!!emailField.errors}>
              <FieldLabel htmlFor="invite-email">Email address</FieldLabel>
              <Input
                {...emailField.props}
                id="invite-email"
                type="email"
                placeholder="name@example.com"
                autoComplete="off"
              />
              {emailField.errors && (
                <FieldError
                  errors={emailField.errors.map((m) => ({ message: m }))}
                />
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="invite-name">
                Display name{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </FieldLabel>
              <Input
                {...nameField.props}
                id="invite-name"
                type="text"
                placeholder="Derived from email if blank"
              />
            </Field>

            <Field data-invalid={!!roleField.errors}>
              <FieldLabel htmlFor="invite-role">Role</FieldLabel>
              <Select
                value={roleField.input ?? "ADMIN"}
                onValueChange={(v) =>
                  roleField.props.onChange({
                    target: { value: v },
                  } as React.ChangeEvent<HTMLInputElement>)
                }
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
              {roleField.errors && (
                <FieldError
                  errors={roleField.errors.map((m) => ({ message: m }))}
                />
              )}
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
