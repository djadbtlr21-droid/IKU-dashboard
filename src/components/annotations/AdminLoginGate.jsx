import { useAnnotations } from '../../hooks/useAnnotation'
import AdminLoginModal from './AdminLoginModal'

// Mounts the modal only while loginOpen===true so internal useState
// reinitializes on each open. Avoids effect-driven state resets.
export default function AdminLoginGate({ G }) {
  const { loginOpen } = useAnnotations()
  return loginOpen ? <AdminLoginModal G={G} /> : null
}
