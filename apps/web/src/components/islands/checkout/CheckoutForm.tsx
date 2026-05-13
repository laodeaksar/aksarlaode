import { useForm }           from "react-hook-form"
import { zodResolver }       from "@hookform/resolvers/zod"
import { useState }          from "react"
import { Effect, pipe }      from "effect"
import { AppRuntime }        from "@/lib/effect/runtime"
import { ordersApi }         from "@/lib/api/orders"
import { productsApi }       from "@/lib/api/products"
import { useCart }           from "@/lib/store/cart"
import { HttpError, NetworkError } from "@/lib/effect/errors"
import { checkoutSchema, type CheckoutInput } from "@/lib/schemas/forms"

type Props = {
  userId: string
}

type CheckoutStep = "address" | "review" | "payment"

export function CheckoutForm({ userId }: Props) {
  const { items, totalAmount, clearCart } = useCart()
  const [step,        setStep]        = useState<CheckoutStep>("address")
  const [serverError, setServerError] = useState<string | null>(null)
  const [orderId,     setOrderId]     = useState<string | null>(null)
  const [snapToken,   setSnapToken]   = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    mode:     "onChange",
  })

  const watchedValues = watch()

  // Step 1 → Step 2: validate address fields only
  const proceedToReview = async () => {
    const addressFields: (keyof CheckoutInput)[] = [
      "recipientName", "phone", "street", "city", "province", "postalCode"
    ]
    const valid = await trigger(addressFields)
    if (valid) setStep("review")
  }

  // Step 2 → Step 3: create order + initiate payment
  const proceedToPayment = async (values: CheckoutInput) => {
    setServerError(null)

    const program = Effect.gen(function* () {
      // 1. Create order
      const order = yield* ordersApi.create({
        items: items.map(i => ({
          productId:   i.productId,
          productName: i.name,
          sku:         i.sku,
          price:       i.price,
          quantity:    i.quantity,
        })),
        shippingAddress: {
          recipientName: values.recipientName,
          phone:         values.phone,
          street:        values.street,
          city:          values.city,
          province:      values.province,
          postalCode:    values.postalCode,
          country:       "ID",
        },
        notes:       values.notes,
        shippingFee: 15_000,
      }, document.cookie)

      // 2. Initiate payment
      const payment = yield* pipe(
        Effect.tryPromise({
          try: () => fetch("/api/payment/initiate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId:       order.orderId,
              amount:        order.grandTotal,
              customerEmail: (document.querySelector("[data-user-email]") as HTMLElement)?.dataset.userEmail,
              customerName:  values.recipientName,
              items:         items.map(i => ({
                id:       i.productId,
                name:     i.name,
                price:    i.price,
                quantity: i.quantity,
              })),
            }),
          }).then(r => r.json() as Promise<{ snapToken: string }>),
          catch: (e) => new NetworkError({ message: String(e) }),
        })
      )

      return { orderId: order.orderId, snapToken: payment.snapToken }
    })

    const exit = await AppRuntime.runPromiseExit(program)

    if (exit._tag === "Failure") {
      const err = exit.cause.error
      if (err instanceof HttpError && err.status === 409) {
        setServerError("Some items are out of stock. Please update your cart.")
        return
      }
      setServerError("Failed to create order. Please try again.")
      return
    }

    setOrderId(exit.value.orderId)
    setSnapToken(exit.value.snapToken)
    setStep("payment")
  }

  // Step 3: open Midtrans Snap
  const openSnap = () => {
    if (!snapToken) return

    // @ts-ignore — Midtrans Snap global
    window.snap.pay(snapToken, {
      onSuccess: () => {
        clearCart()
        window.location.href = `/orders/${orderId}?status=success`
      },
      onPending: () => {
        window.location.href = `/orders/${orderId}?status=pending`
      },
      onError: () => {
        setServerError("Payment failed. Please try again.")
        setStep("review")
      },
      onClose: () => {
        setServerError("Payment cancelled.")
      },
    })
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <StepIndicator current={step} />

      {serverError && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{serverError}</div>
      )}

      {/* ── Step 1: Address ───────────────────────────── */}
      {step === "address" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Shipping Address</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Recipient Name" error={errors.recipientName?.message} className="sm:col-span-2">
              <input {...register("recipientName")} className={inputCls(!!errors.recipientName)} placeholder="Full name" />
            </Field>

            <Field label="Phone" error={errors.phone?.message}>
              <input {...register("phone")} type="tel" className={inputCls(!!errors.phone)} placeholder="08123456789" />
            </Field>

            <Field label="Postal Code" error={errors.postalCode?.message}>
              <input {...register("postalCode")} className={inputCls(!!errors.postalCode)} placeholder="12345" maxLength={5} />
            </Field>

            <Field label="Street Address" error={errors.street?.message} className="sm:col-span-2">
              <input {...register("street")} className={inputCls(!!errors.street)} placeholder="Jl. Sudirman No. 1" />
            </Field>

            <Field label="City" error={errors.city?.message}>
              <input {...register("city")} className={inputCls(!!errors.city)} placeholder="Jakarta" />
            </Field>

            <Field label="Province" error={errors.province?.message}>
              <input {...register("province")} className={inputCls(!!errors.province)} placeholder="DKI Jakarta" />
            </Field>

            <Field label="Order Notes (optional)" error={errors.notes?.message} className="sm:col-span-2">
              <textarea {...register("notes")} rows={2} className={inputCls(false)} placeholder="Leave at door, etc." />
            </Field>
          </div>

          <button onClick={proceedToReview} className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700">
            Continue to Review →
          </button>
        </div>
      )}

      {/* ── Step 2: Review ────────────────────────────── */}
      {step === "review" && (
        <form onSubmit={handleSubmit(proceedToPayment)} className="space-y-6" noValidate>
          <h2 className="text-lg font-semibold">Review Order</h2>

          {/* Address summary */}
          <div className="rounded-lg border p-4 text-sm space-y-1">
            <p className="font-medium">{watchedValues.recipientName} · {watchedValues.phone}</p>
            <p className="text-gray-600">{watchedValues.street}</p>
            <p className="text-gray-600">{watchedValues.city}, {watchedValues.province} {watchedValues.postalCode}</p>
            <button type="button" onClick={() => setStep("address")} className="text-blue-600 text-xs hover:underline">
              Edit address
            </button>
          </div>

          {/* Cart items */}
          <div className="divide-y rounded-lg border">
            {items.map(item => (
              <div key={item.productId} className="flex items-center gap-3 p-4">
                <img src={item.imageUrl} className="h-14 w-14 rounded object-cover" alt={item.name} />
                <div className="flex-1 text-sm">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-gray-500">x{item.quantity}</p>
                </div>
                <p className="font-semibold text-sm">Rp {(item.price * item.quantity).toLocaleString("id-ID")}</p>
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
            disabled={isSubmitting}
            className="w-full rounded-lg bg-green-600 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            {isSubmitting ? "Creating order..." : "Place Order →"}
          </button>
        </form>
      )}

      {/* ── Step 3: Payment ───────────────────────────── */}
      {step === "payment" && snapToken && (
        <div className="space-y-4 text-center">
          <div className="rounded-lg bg-green-50 p-4">
            <p className="font-medium text-green-800">Order <strong>{orderId}</strong> created!</p>
            <p className="text-sm text-green-600">Complete payment to confirm your order.</p>
          </div>

          <button
            onClick={openSnap}
            className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700"
          >
            Pay Now
          </button>

          <p className="text-xs text-gray-500">
            Secure payment powered by Midtrans.
            Payment link expires in 60 minutes.
          </p>
        </div>
      )}
    </div>
  )
}

function StepIndicator({ current }: { current: CheckoutStep }) {
  const steps: { key: CheckoutStep; label: string }[] = [
    { key: "address", label: "Address"  },
    { key: "review",  label: "Review"   },
    { key: "payment", label: "Payment"  },
  ]
  const idx = steps.findIndex(s => s.key === current)

  return (
    <ol className="flex items-center gap-2 text-sm">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full font-medium text-xs
            ${i <= idx ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}>
            {i + 1}
          </span>
          <span className={i <= idx ? "text-blue-600 font-medium" : "text-gray-400"}>
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-gray-300">→</span>}
        </li>
      ))}
    </ol>
  )
}
