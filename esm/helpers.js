/**
 * Get the active drag position given its initial
 * coordinates and grid meta
 * @param index
 * @param grid
 * @param dx
 * @param dy
 */
export function getDragPosition(index, grid, dx, dy, center) {
    const { xy: [left, top] } = getPositionForIndex(index, grid);
    return {
        xy: [
            left + dx + (center ? grid.columnWidth / 2 : 0),
            top + dy + (center ? grid.rowHeight / 2 : 0)
        ]
    };
}
/**
 * Get the relative top, left position for a particular
 * index in a grid
 * @param i
 * @param grid
 * @param traverseIndex (destination for traverse)
 */
export function getPositionForIndex(i, { boxesPerRow, rowHeight, columnWidth }, traverseIndex) {
    const index = typeof traverseIndex == "number" ? (i >= traverseIndex ? i + 1 : i) : i;
    const x = (index % boxesPerRow) * columnWidth;
    const y = Math.floor(index / boxesPerRow) * rowHeight;
    return {
        xy: [x, y]
    };
}
/**
 * Given relative coordinates, determine which index
 * we are currently in
 * @param x
 * @param y
 * @param param2
 */
export function getIndexFromCoordinates(x, y, { rowHeight, boxesPerRow, columnWidth }, count) {
    const index = Math.floor(y / rowHeight) * boxesPerRow + Math.floor(x / columnWidth);
    return index >= count ? count : index;
}
/**
 * Get the target index during a drag
 * @param startIndex
 * @param grid
 * @param count
 * @param dx
 * @param dy
 */
export function getTargetIndex(startIndex, grid, count, dx, dy) {
    const { xy: [cx, cy] } = getDragPosition(startIndex, grid, dx, dy, true);
    return getIndexFromCoordinates(cx, cy, grid, count);
}
