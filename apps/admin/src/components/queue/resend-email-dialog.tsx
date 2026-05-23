import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, useField, useForm } from "@formisch/react";

import { SendIcon } from "lucide-react";

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

import { resendEmailFn, type ResendEmailType } from "@/server/queue";
import { queryKeys, toast } from "@/lib";
import { ResendEmailSchema, type ResendEmailFields } from "@/schemas/forms";

const EMAIL_TYPE_OPTIONS: {
  value: ResendEmailType;
  label: string;
  description: string;
}[] = [
  {
    value: "order-created",
    label: "Order Placed",
    description: "Sent when an order is first created",
  },
  {
    value: "order-confirmation",
    label: "Payment Confirmed",
    description: "Sent after payment is successfully processed",
  },
  {
    value: "order-cancelled",
    label: "Order Cancelled",
    description: "Sent when an order is cancelled",
  },
];

export function ResendEmailDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const form = useForm({
    schema: ResendEmailSchema,
    initialInput: {
      emailType: "" as ResendEmailType,
      orderId: "",
      recipientEmail: "",
      reason: "",
    },
  });

  const emailTypeField = useField(form, { path: ["emailType"] as const });
  const orderIdField = useField(form, { path: ["orderId"] as const });
  const recipientEmailField = useField(form, {
    path: ["recipientEmail"] as const,
  });
  const reasonField = useField(form, { path: ["reason"] as const });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: ResendEmailFields) =>
      resendEmailFn({
        data: {
          orderId: data.orderId,
          emailType: data.emailType,
          recipientEmail: data.recipientEmail,
          ...(data.emailType === "order-cancelled"
            ? { reason: data.reason?.trim() || "Cancelled by admin" }
            : {}),
        },
      }),

    onSuccess: () => {
      toast.persistent("Email job queued successfully");
      void queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.queue.failedJobs,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.queue.activity,
      });
      setOpen(false);
    },

    onError: (err: unknown) => {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to queue email";
      toast.error(message);
    },
  });

  const selectedOption = EMAIL_TYPE_OPTIONS.find(
    (o) => o.value === emailTypeField.input
  );
  const showReason = emailTypeField.input === "order-cancelled";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <SendIcon className="mr-2 h-4 w-4" />
        Resend Email
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Resend Email</DialogTitle>
          <DialogDescription>
            Manually queue a one-off email for an existing order. The job will
            be processed by the email worker immediately.
          </DialogDescription>
        </DialogHeader>

        <Form
          of={form}
          onSubmit={(data) => mutate(data)}
          className="space-y-4 py-2"
        >
          <FieldGroup>
            <Field data-invalid={!!emailTypeField.errors}>
              <FieldLabel htmlFor="resend-type">Email type</FieldLabel>
              <Select
                value={emailTypeField.input ?? ""}
                onValueChange={(v) =>
                  emailTypeField.props.onChange({
                    target: { value: v },
                  } as React.ChangeEvent<HTMLInputElement>)
                }
              >
                <SelectTrigger id="resend-type" className="w-full">
                  <SelectValue placeholder="Select email type…" />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TYPE_OPTIONS.map(({ value, label, description }) => (
                    <SelectItem key={value} value={value}>
                      <span className="font-medium">{label}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        — {description}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedOption && (
                <p className="text-muted-foreground text-xs">
                  {selectedOption.description}
                </p>
              )}
              {emailTypeField.errors && (
                <FieldError
                  errors={emailTypeField.errors.map((m) => ({ message: m }))}
                />
              )}
            </Field>

            <Field data-invalid={!!orderIdField.errors}>
              <FieldLabel htmlFor="resend-order">Order ID</FieldLabel>
              <Input
                {...orderIdField.props}
                id="resend-order"
                type="text"
                placeholder="e.g. ord_abc123"
                autoComplete="off"
              />
              {orderIdField.errors && (
                <FieldError
                  errors={orderIdField.errors.map((m) => ({ message: m }))}
                />
              )}
            </Field>

            <Field data-invalid={!!recipientEmailField.errors}>
              <FieldLabel htmlFor="resend-email">Recipient email</FieldLabel>
              <Input
                {...recipientEmailField.props}
                id="resend-email"
                type="email"
                placeholder="customer@example.com"
                autoComplete="off"
              />
              {recipientEmailField.errors && (
                <FieldError
                  errors={recipientEmailField.errors.map((m) => ({
                    message: m,
                  }))}
                />
              )}
            </Field>

            {showReason && (
              <Field data-invalid={!!reasonField.errors}>
                <FieldLabel htmlFor="resend-reason">
                  Cancellation reason{" "}
                  <span className="text-muted-foreground font-normal">
                    (required)
                  </span>
                </FieldLabel>
                <Input
                  {...reasonField.props}
                  id="resend-reason"
                  type="text"
                  placeholder="e.g. Out of stock"
                />
                {reasonField.errors && (
                  <FieldError
                    errors={reasonField.errors.map((m) => ({ message: m }))}
                  />
                )}
              </Field>
            )}
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
              {isPending ? "Queueing…" : "Queue Email"}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
