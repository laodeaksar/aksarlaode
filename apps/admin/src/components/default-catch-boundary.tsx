import {
  ErrorComponent,
  Link,
  rootRouteId,
  useMatch,
  useRouter,
} from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter()
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  })

  console.error(error)
return (
  <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center max-w-md w-full">
          <p className="text-base font-semibold text-red-700 mb-2">
      <ErrorComponent error={error} />
          </p>
      <div className="flex gap-2 items-center flex-wrap">
        <button
          onClick={() => {
            router.invalidate()
          }}
          className={`px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded-sm text-white uppercase font-extrabold`}
        >
          Try Again
        </button>
        {isRoot ? (
          <Link
            to="/dashboard"
            className={`px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded-sm text-white uppercase font-extrabold`}
          >
            Go to Dashboard
          </Link>
        ) : (
          <Link
            to="/"
            className={`px-2 py-1 bg-gray-600 dark:bg-gray-700 rounded-sm text-white uppercase font-extrabold`}
            onClick={(e) => {
              e.preventDefault()
              window.history.back()
            }}
            >
            Go Back
          </Link>
        )}
      </div>
      </div>
    </div>
  )
}
