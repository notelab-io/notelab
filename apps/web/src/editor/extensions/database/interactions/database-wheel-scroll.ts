type DatabaseWheelEventLike = {
  deltaX: number
  deltaY: number
  shiftKey: boolean
}

const wheelNoiseThreshold = 1
const horizontalIntentRatio = 1.25

export function getDatabaseHorizontalWheelDelta(event: DatabaseWheelEventLike) {
  const absoluteDeltaX = Math.abs(event.deltaX)
  const absoluteDeltaY = Math.abs(event.deltaY)

  if (event.shiftKey && absoluteDeltaY > wheelNoiseThreshold) {
    return event.deltaY
  }

  if (absoluteDeltaX <= wheelNoiseThreshold) {
    return 0
  }

  if (absoluteDeltaY <= wheelNoiseThreshold) {
    return event.deltaX
  }

  return absoluteDeltaX >= absoluteDeltaY * horizontalIntentRatio
    ? event.deltaX
    : 0
}
