import type { ReactNode } from "react";

import { HeadContent, Scripts } from "@tanstack/react-router";

export function BaseLayout({ children }: { children: ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
