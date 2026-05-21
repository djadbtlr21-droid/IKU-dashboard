import { useAnnotations } from '../contexts/AnnotationContext'

export function useAnnotation(key) {
  const { items } = useAnnotations()
  return key ? items[key] : undefined
}

export { useAnnotations }
