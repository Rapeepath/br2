import type { CSSProperties } from 'react'
import type { ModelImage } from './types'

/**
 * Inline style that frames a robot photo wherever it is cropped: `focus` picks the point a crop keeps,
 * and `zoom` enlarges around that same point when the robot is small in a busy event photo. (An
 * object-position percentage lines up that point of the image with the same point of the frame, so it
 * is also the right transform origin.) Undefined when the photo needs neither.
 */
export function photoStyle(image: ModelImage): CSSProperties | undefined {
  if (!image.focus && !image.zoom) return undefined
  return {
    objectPosition: image.focus,
    ...(image.zoom ? { transform: `scale(${image.zoom})`, transformOrigin: image.focus ?? '50% 50%' } : {}),
  }
}
