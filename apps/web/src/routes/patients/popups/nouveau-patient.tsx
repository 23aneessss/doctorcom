import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/patients/popups/nouveau-patient')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/patients/popups/nouveau-patient"!</div>
}
