import {
  ErrorComponent,
  Link,
  rootRouteId,
  useMatch,
  useRouter,
} from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  });

  if (import.meta.env.DEV) console.error(error);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <ErrorComponent error={error} />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
            }}
            className={`rounded-sm bg-gray-600 px-2 py-1 font-extrabold text-white uppercase dark:bg-gray-700`}
          >
            Try Again
          </button>
          {isRoot ? (
            <Link
              to="/dashboard"
              className={`rounded-sm bg-gray-600 px-2 py-1 font-extrabold text-white uppercase dark:bg-gray-700`}
            >
              Go to Dashboard
            </Link>
          ) : (
            <Link
              to="/"
              className={`rounded-sm bg-gray-600 px-2 py-1 font-extrabold text-white uppercase dark:bg-gray-700`}
              onClick={(e) => {
                e.preventDefault();
                window.history.back();
              }}
            >
              Go Back
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
