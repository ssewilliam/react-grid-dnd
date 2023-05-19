import * as React from "react";
import { useMeasure } from "./use-measure";
import { GridContext } from "./GridContext";
import { swap } from "./swap";
import { getPositionForIndex, getTargetIndex } from "./helpers";
import { GridItemContext } from "./GridItemContext";
export function GridDropZone({ id, boxesPerRow, children, style, disableDrag = false, disableDrop = false, rowHeight, ...other }) {
    const { traverse, startTraverse, endTraverse, register, measureAll, onChange, remove, getActiveDropId } = React.useContext(GridContext);
    const ref = React.useRef(null);
    const { bounds, remeasure } = useMeasure(ref);
    const [draggingIndex, setDraggingIndex] = React.useState(null);
    const [placeholder, setPlaceholder] = React.useState(null);
    const traverseIndex = traverse && !traverse.execute && traverse.targetId === id
        ? traverse.targetIndex
        : null;
    const grid = {
        columnWidth: bounds.width / boxesPerRow,
        boxesPerRow,
        rowHeight
    };
    const childCount = React.Children.count(children);
    /**
     * Register our dropzone with our grid context
     */
    React.useEffect(() => {
        register(id, {
            top: bounds.top,
            bottom: bounds.bottom,
            left: bounds.left,
            right: bounds.right,
            width: bounds.width,
            height: bounds.height,
            count: childCount,
            grid,
            disableDrop,
            remeasure
        });
    }, [childCount, disableDrop, bounds, id, grid]);
    /**
     * Unregister when unmounting
     */
    React.useEffect(() => {
        return () => remove(id);
    }, [id]);
    // keep an initial list of our item indexes. We use this
    // when animating swap positions on drag events
    const itemsIndexes = React.Children.map(children, (_, i) => i) || [];
    return (React.createElement("div", Object.assign({ ref: ref, style: {
            position: "relative",
            ...style
        } }, other), grid.columnWidth === 0
        ? null
        : React.Children.map(children, (child, i) => {
            const isTraverseTarget = traverse &&
                traverse.targetId === id &&
                traverse.targetIndex === i;
            const order = placeholder
                ? swap(itemsIndexes, placeholder.startIndex, placeholder.targetIndex)
                : itemsIndexes;
            const pos = getPositionForIndex(order.indexOf(i), grid, traverseIndex);
            /**
             * Handle a child being dragged
             * @param state
             * @param x
             * @param y
             */
            function onMove(state, x, y) {
                if (!ref.current)
                    return;
                if (draggingIndex !== i) {
                    setDraggingIndex(i);
                }
                const targetDropId = getActiveDropId(id, x + grid.columnWidth / 2, y + grid.rowHeight / 2);
                if (targetDropId && targetDropId !== id) {
                    startTraverse(id, targetDropId, x, y, i);
                }
                else {
                    endTraverse();
                }
                const targetIndex = targetDropId !== id
                    ? childCount
                    : getTargetIndex(i, grid, childCount, state.delta[0], state.delta[1]);
                if (targetIndex !== i) {
                    if ((placeholder && placeholder.targetIndex !== targetIndex) ||
                        !placeholder) {
                        setPlaceholder({
                            targetIndex,
                            startIndex: i
                        });
                    }
                }
                else if (placeholder) {
                    setPlaceholder(null);
                }
            }
            /**
             * Handle drag end events
             */
            function onEnd(state, x, y) {
                const targetDropId = getActiveDropId(id, x + grid.columnWidth / 2, y + grid.rowHeight / 2);
                const targetIndex = targetDropId !== id
                    ? childCount
                    : getTargetIndex(i, grid, childCount, state.delta[0], state.delta[1]);
                // traverse?
                if (traverse) {
                    onChange(traverse.sourceId, traverse.sourceIndex, traverse.targetIndex, traverse.targetId);
                }
                else {
                    onChange(id, i, targetIndex);
                }
                setPlaceholder(null);
                setDraggingIndex(null);
            }
            function onStart() {
                measureAll();
            }
            return (React.createElement(GridItemContext.Provider, { value: {
                    top: pos.xy[1],
                    disableDrag,
                    endTraverse,
                    mountWithTraverseTarget: isTraverseTarget
                        ? [traverse.tx, traverse.ty]
                        : undefined,
                    left: pos.xy[0],
                    i,
                    onMove,
                    onEnd,
                    onStart,
                    grid,
                    dragging: i === draggingIndex
                } }, child));
        })));
}
