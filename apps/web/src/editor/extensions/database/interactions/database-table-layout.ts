export function getDatabaseRowDropTargetIndex(
  dropTops: number[],
  pointerTop: number
) {
  if (dropTops.length < 2) {
    return 0
  }

  let low = 0
  let high = dropTops.length - 1

  while (low < high) {
    const index = Math.floor((low + high) / 2)
    const midpoint = (dropTops[index] + dropTops[index + 1]) / 2

    if (pointerTop < midpoint) {
      high = index
    } else {
      low = index + 1
    }
  }

  return low
}
