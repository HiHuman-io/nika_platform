import { redirect } from "next/navigation";

export default function Home() {
  // The proxy redirects unauthenticated users to /login before this renders.
  redirect("/catalog");
}
