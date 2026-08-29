import { ReactNode } from "react";
import { PayLayoutClient } from "./layout-client";

export default function PayLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PayLayoutClient />
      {children}
    </>
  );
}
