import type { ReactNode } from "react";

import {
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

const BaseLayout=({children}:{children: ReactNode})=>(

  <html>
        <head>
          <HeadContent />
        </head>
        <body>
        {children}
        <Scripts />
        </body>
      </html>
)
