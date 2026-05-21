import { useState } from "react";
import { getErrors, useField, useForm, validate, Form } from "@formisch/react";

import { Effect, pipe } from "effect";

import { ordersApi } from "@/lib/api/orders";
import { HttpError, NetworkError } from "@/lib/effect/errors";
import { AppRuntime } from "@/lib/effect/runtime";
import { checkoutSchema, type CheckoutInput } from "@/lib/schemas/forms";
import { useCart } from "@/lib/store/cart";

type Props = {
  userId: string;
  userEmail: string;
};

type CheckoutStep = "address" | "review" | "payment";

// FIX WEB-07b: Distinguish between server errors (order/payment initiation)
// and Snap errors (user interaction with Midtrans modal).  The payment step
// now shows a dedicated retry card so the user is never left with a blank
// screen or a silent failure.
type PaymentStatus = "idle" | "failed" | "cancelled";

export function CheckoutForm({ userId, userEmail }: Props) {
  const { items, totalAmount, clearCart } = useCart();
  const [step, setStep] = useState<CheckoutStep>("address");
  const [serverError, setServerError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [snapToken, setSnapToken] = useState<string | null>(null);

  // validate: "change" preserves original mode: "onChange" UX
  const form = useForm({
    schema: checkoutSchema,
    validate: "change",
    revalidate: "change",
  });

  // useField hooks give reactive access to each field's value and errors.
  // These replace both register() for binding and watch() for reading values.
  const recipientNameField = useField(form, {
    path: ["recipientName"] as const,
  });
  const phoneField = useField(form, { path: ["phone"] as const });
  const streetField = useField(form, { path: ["street"] as const });
  const cityField = useField(form, { path: ["city"] as const });
  const provinceField = useField(form, { path: ["province"] as const });
  const postalCodeField = useField(form, { path: ["postalCode"] as const });
  const notesField = useField(form, { path: ["notes"] as const });

  // Step 1 → Step 2: validate address fields only.
  // validate(form) runs the full schema and writes errors into the store;
  // we then inspect only the address-specific paths to decide whether to advance.
  const proceedToReview = async () => {
    const result = await validate(form);

    if (result.success) {
      setStep("review");
      return;
    }

    // If all failures are outside the address fields (e.g. only notes), still advance.
    const addressKeys = new Set([
      "recipientName",
      "phone",
      "street",
      "city",
      "province",
      "postalCode",
    ]);
    const hasAddressError = result.issues.some((issue) => {
      const key = issue.path?.[0]?.key;
      return typeof key === "string" && addressKeys.has(key);
    });

    if (!hasAddressError) setStep("review");
  };

  // Step 2 → Step 3: create order + initiate payment
  const proceedToPayment = async (values: CheckoutInput) => {
    setServerError(null);

    const program = Effect.gen(function* () {
      // 1. Create order
      const order = yield* ordersApi.create(
        {
          items: items.map((i) => ({
            productId: i.id,
            productName: i.name,
            price: i.price,
            quantity: i.quantity,
          })),
          shippingAddress: {
            recipientName: values.recipientName,
            phone: values.phone,
            street: values.street,
            city: values.city,
            province: values.province,
            postalCode: values.postalCode,
            country: "ID",
          },
          notes: values.notes,
          shippingFee: 15_000,
        },
        document.cookie
      );

      // 2. Initiate payment
      const payment = yield* pipe(
        Effect.tryPromise({
          try: () =>
            fetch("/api/payment/initiate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: order.orderId,
                amount: order.grandTotal,
                customerEmail: userEmail,
                customerName: values.recipientName,
                items: items.map((i) => ({
                  id: i.id,
                  name: i.name,
                  price: i.price,
                  quantity: i.quantity,
                })),
              }),
            }).then((r) => r.json() as Promise<{ snapToken: string }>),
          catch: (e) => new NetworkError({ message: String(e) }),
        })
      );

      return { orderId: order.orderId, snapToken: payment.snapToken };
    });

    const exit = await AppRuntime.runPromiseExit(program);

    if (exit._tag === "Failure") {
      const err = exit.cause.error;
      if (err instanceof HttpError && err.status === 409) {
        setServerError("Some items are out of stock. Please update your cart.");
        return;
      }
      // FIX WEB-07b: surface a clear, retry-able error message.
      setServerError("We couldn't complete your order. Please try again.");
      return;
    }

    setOrderId(exit.value.orderId);
    setSnapToken(exit.value.snapToken);
    setPaymentStatus("idle");
    setStep("payment");
  };

  // Step 3: open Midtrans Snap
  const openSnap = () => {
    if (!snapToken) return;
    setPaymentStatus("idle");

    // @ts-ignore — Midtrans Snap global
    window.snap.pay(snapToken, {
      onSuccess: () => {
        clearCart();
        window.location.href = `/orders/${orderId}?status=success`;
      },
      onPending: () => {
        window.location.href = `/orders/${orderId}?status=pending`;
      },
      // FIX WEB-07b: set paymentStatus so the payment step renders a retry card
      // instead of silently going back to the review step.
      onError: () => {
        setPaymentStatus("failed");
      },
      onClose: () => {
        setPaymentStatus("cancelled");
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator current={step} />

      {serverError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

      {/* ── Step 1: Address ───────────────────────────── */}
      {step === "address" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Shipping Address</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Recipient Name"
              error={recipientNameField.errors?.[0]}
              className="sm:col-span-2"
            >
              <input
                {...recipientNameField.props}
                className={inputCls(!!recipientNameField.errors)}
                placeholder="Full name"
              />
            </Field>

            <Field label="Phone" error={phoneField.errors?.[0]}>
              <input
                {...phoneField.props}
                type="tel"
                className={inputCls(!!phoneField.errors)}
                placeholder="08123456789"
              />
            </Field>

            <Field label="Postal Code" error={postalCodeField.errors?.[0]}>
              <input
                {...postalCodeField.props}
                className={inputCls(!!postalCodeField.errors)}
                placeholder="12345"
                maxLength={5}
              />
            </Field>

            <Field
              label="Street Address"
              error={streetField.errors?.[0]}
              className="sm:col-span-2"
            >
              <input
                {...streetField.props}
                className={inputCls(!!streetField.errors)}
                placeholder="Jl. Sudirman No. 1"
              />
            </Field>

            <Field label="City" error={cityField.errors?.[0]}>
              <input
                {...cityField.props}
                className={inputCls(!!cityField.errors)}
                placeholder="Jakarta"
              />
            </Field>

            <Field label="Province" error={provinceField.errors?.[0]}>
              <input
                {...provinceField.props}
                className={inputCls(!!provinceField.errors)}
                placeholder="DKI Jakarta"
              />
            </Field>

            <Field
              label="Order Notes (optional)"
              error={notesField.errors?.[0]}
              className="sm:col-span-2"
            >
              <textarea
                {...notesField.props}
                rows={2}
                className={inputCls(false)}
                placeholder="Leave at door, etc."
              />
            </Field>
          </div>

          <button
            onClick={proceedToReview}
            className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700"
          >
            Continue to Review →
          </button>
        </div>
      )}

      {/* ── Step 2: Review ────────────────────────────── */}
      {step === "review" && (
        <Form of={form} onSubmit={proceedToPayment} className="space-y-6">
          <h2 className="text-lg font-semibold">Review Order</h2>

          {/* Address summary — reads from reactive useField.input values */}
          <div className="space-y-1 rounded-lg border p-4 text-sm">
            <p className="font-medium">
              {recipientNameField.input} · {phoneField.input}
            </p>
            <p className="text-gray-600">{streetField.input}</p>
            <p className="text-gray-600">
              {cityField.input}, {provinceField.input}{" "}
              {postalCodeField.input}
            </p>
            <button
              type="button"
              onClick={() => setStep("address")}
              className="text-xs text-blue-600 hover:underline"
            >
              Edit address
            </button>
          </div>

          {/* Cart items */}
          <div className="divide-y rounded-lg border">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-4">
                <img
                  src={item.imageUrl}
                  className="h-14 w-14 rounded object-cover"
                  alt={item.name}
                  loading="lazy"
                  decoding="async"
                />
                <div className="flex-1 text-sm">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-gray-500">x{item.quantity}</p>
                </div>
                <p className="text-sm font-semibold">
                  Rp {(item.price * item.quantity).toLocaleString("id-ID")}
                </p>
              </div>
            ))}
            <div className="flex justify-between p-4 text-sm">
              <span className="text-gray-500">Shipping</span>
              <span>Rp 15.000</span>
            </div>
            <div className="flex justify-between p-4 font-bold">
              <span>Total</span>
              <span>Rp {(totalAmount + 15_000).toLocaleString("id-ID")}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={form.isSubmitting}
            className="w-full rounded-lg bg-green-600 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {form.isSubmitting ? "Creating order..." : "Place Order →"}
          </button>
        </Form>
      )}

      {/* ── Step 3: Payment ───────────────────────────── */}
      {step === "payment" && snapToken && (
        <div className="space-y-4">
          {/* FIX WEB-07b: dedicated error/cancel states with explicit retry UI */}
          {paymentStatus === "failed" && (
            <div
              role="alert"
              className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-5 text-center"
            >
              <p className="font-semibold text-red-700">Payment unsuccessful</p>
              <p className="text-sm text-red-600">
                Your order has been saved. You can retry payment now or come
                back later.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={openSnap}
                  className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                >
                  Retry Payment
                </button>
                <a
                  href={`/orders/${orderId}`}
                  className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  View Order
                </a>
              </div>
            </div>
          )}

          {paymentStatus === "cancelled" && (
            <div
              role="alert"
              className="space-y-3 rounded-lg border border-yellow-200 bg-yellow-50 p-5 text-center"
            >
              <p className="font-semibold text-yellow-800">
                Payment window closed
              </p>
              <p className="text-sm text-yellow-700">
                Your order is reserved. Complete payment within 60 minutes to
                confirm it.
              </p>
              <button
                onClick={openSnap}
                className="rounded-lg bg-yellow-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-yellow-700"
              >
                Continue Payment
              </button>
            </div>
          )}

          {paymentStatus === "idle" && (
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="font-medium text-green-800">
                Order <strong>{orderId}</strong> created!
              </p>
              <p className="text-sm text-green-600">
                Complete payment to confirm your order.
              </p>
            </div>
          )}

          {paymentStatus === "idle" && (
            <button
              onClick={openSnap}
              className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700"
            >
              Pay Now
            </button>
          )}

          <p className="text-center text-xs text-gray-500">
            Secure payment powered by Midtrans. Payment link expires in 60
            minutes.
          </p>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ current }: { current: CheckoutStep }) {
  const steps: { key: CheckoutStep; label: string }[] = [
    { key: "address", label: "Address" },
    { key: "review", label: "Review" },
    { key: "payment", label: "Payment" },
  ];
  const idx = steps.findIndex((s) => s.key === current);

  return (
    <ol className="flex items-center gap-2 text-sm">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${i <= idx ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}
          >
            {i + 1}
          </span>
          <span
            className={i <= idx ? "font-medium text-blue-600" : "text-gray-400"}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-gray-300">→</span>}
        </li>
      ))}
    </ol>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function inputCls(hasError: boolean) {
  return `w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors
    ${
      hasError
        ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
        : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
    }`;
}

function Field({
  label,
  error,
  children,
  className = "",
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
