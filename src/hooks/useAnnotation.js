import { useContext } from 'react'
import { AnnotationContext } from '../contexts/AnnotationContext'

export function useAnnotations() {
  const ctx = useContext(AnnotationContext)
  if (!ctx) throw new Error('useAnnotations must be used within AnnotationProvider')
  return ctx
}

export function useAnnotation(key) {
  const { items } = useAnnotations()
  return key ? items[key] : undefined
}
