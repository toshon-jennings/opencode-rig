import { Link, Meta } from "@solidjs/meta"

export const Favicon = () => {
  return (
    <>
      <Link rel="icon" type="image/png" href="/favicon-96x96-v3.png?v=workbench-1" sizes="96x96" />
      <Link rel="icon" type="image/svg+xml" href="/favicon-v3.svg?v=workbench-1" />
      <Link rel="shortcut icon" href="/favicon-v3.ico?v=workbench-1" />
      <Link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-v3.png?v=workbench-1" />
      <Link rel="manifest" href="/site.webmanifest?v=workbench-1" />
      <Meta name="apple-mobile-web-app-title" content="OpenCode" />
    </>
  )
}
