'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var React = require('react');
var ResizeObserver = _interopDefault(require('resize-observer-polyfill'));
var reactGestureResponder = require('react-gesture-responder');
var reactSpring = require('react-spring');

/**
 * Get the active drag position given its initial
 * coordinates and grid meta
 * @param index
 * @param grid
 * @param dx
 * @param dy
 */
function getDragPosition(index, grid, dx, dy, center) {
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
function getPositionForIndex(i, { boxesPerRow, rowHeight, columnWidth }, traverseIndex) {
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
function getIndexFromCoordinates(x, y, { rowHeight, boxesPerRow, columnWidth }, count) {
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
function getTargetIndex(startIndex, grid, count, dx, dy) {
    const { xy: [cx, cy] } = getDragPosition(startIndex, grid, dx, dy, true);
    return getIndexFromCoordinates(cx, cy, grid, count);
}

const noop = () => {
    throw new Error("Make sure that you have wrapped your drop zones with GridContext");
};
const GridContext = React.createContext({
    register: noop,
    remove: noop,
    getActiveDropId: noop,
    startTraverse: noop,
    measureAll: noop,
    traverse: null,
    endTraverse: noop,
    onChange: noop
});
function GridContextProvider({ children, onChange }) {
    const [traverse, setTraverse] = React.useState(null);
    const dropRefs = React.useRef(new Map());
    /**
     * Register a drop zone with relevant information
     * @param id
     * @param options
     */
    function register(id, options) {
        dropRefs.current.set(id, options);
    }
    /**
     * Remove a drop zone (typically on unmount)
     * @param id
     */
    function remove(id) {
        dropRefs.current.delete(id);
    }
    /**
     * Determine the fixed position (pageX) of an item
     * @param sourceId
     * @param rx relative x
     * @param ry relative y
     */
    function getFixedPosition(sourceId, rx, ry) {
        const item = dropRefs.current.get(sourceId);
        // When items are removed from the DOM, the left and top values could be undefined.
        if (!item) {
            return {
                x: rx,
                y: ry
            };
        }
        const { left, top } = item;
        return {
            x: left + rx,
            y: top + ry
        };
    }
    /**
     * Get a relative position for a target dropzone given
     * a fixed position
     * @param targetId
     * @param fx fixed x
     * @param fy fixed y
     */
    function getRelativePosition(targetId, fx, fy) {
        const { left, top } = dropRefs.current.get(targetId);
        return {
            x: fx - left,
            y: fy - top
        };
    }
    /**
     * Determine the difference in coordinates between
     * two dropzones
     * @param sourceId
     * @param targetId
     */
    function diffDropzones(sourceId, targetId) {
        const sBounds = dropRefs.current.get(sourceId);
        const tBounds = dropRefs.current.get(targetId);
        return {
            x: tBounds.left - sBounds.left,
            y: tBounds.top - sBounds.top
        };
    }
    /**
     * Determine which dropzone we are actively dragging over
     * @param sourceId
     * @param x
     * @param y
     */
    function getActiveDropId(sourceId, x, y) {
        const { x: fx, y: fy } = getFixedPosition(sourceId, x, y);
        // probably faster just using an array for dropRefs
        for (const [key, bounds] of dropRefs.current.entries()) {
            if (!bounds.disableDrop &&
                fx > bounds.left &&
                fx < bounds.right &&
                fy > bounds.top &&
                fy < bounds.bottom) {
                return key;
            }
        }
        return null;
    }
    /**
     * Trigger a traversal (when one item is being dropped
     * on a different dropzone)
     * @param sourceId
     * @param targetId
     * @param x
     * @param y
     * @param sourceIndex
     */
    function startTraverse(sourceId, targetId, x, y, sourceIndex) {
        const { x: fx, y: fy } = getFixedPosition(sourceId, x, y);
        const { x: rx, y: ry } = getRelativePosition(targetId, fx, fy);
        const { grid: targetGrid, count } = dropRefs.current.get(targetId);
        const targetIndex = getIndexFromCoordinates(rx + targetGrid.columnWidth / 2, ry + targetGrid.rowHeight / 2, targetGrid, count);
        const { xy: [px, py] } = getPositionForIndex(targetIndex, targetGrid);
        const { x: dx, y: dy } = diffDropzones(sourceId, targetId);
        // only update traverse if targetId or targetIndex have changed
        if (!traverse ||
            !(traverse &&
                traverse.targetIndex !== targetIndex &&
                traverse.targetId !== targetId)) {
            setTraverse({
                rx: px + dx,
                ry: py + dy,
                tx: rx,
                ty: ry,
                sourceId,
                targetId,
                sourceIndex,
                targetIndex
            });
        }
    }
    /**
     * End any active traversals
     */
    function endTraverse() {
        setTraverse(null);
    }
    /**
     * Perform a change to list item arrays.
     * If it doesn't include targetId, it's a switch
     * of order within the one array itself.
     */
    function onSwitch(sourceId, sourceIndex, targetIndex, targetId) {
        // this is a bit hacky, but seems to work for now. The idea
        // is that we want our newly mounted traversed grid item
        // to start its animation from the last target location.
        // Execute informs our GridDropZone to remove the placeholder
        // but to pass the initial location to the newly mounted
        // grid item at the specified index.
        // The problem here is that it's async, so potentially something
        // could mount in its place in between setTraversal and onChange
        // executing. Or maybe onChange won't do anything, in which case
        // our state is kinda messed up.
        // So it's sorta a controlled component, but not really, because
        // if you don't do what we suggest, then it gets messed up.
        // One solution is to bring the state in-component and force
        // the state to be updated by us, since it's basically required
        // anyway.
        // We could possibly also use a unique identifier for the grid (besides
        // the index). This could still result in weirdness, but would
        // be more unlikely.
        // Ultimately it's kinda messed because we are trying to do something
        // imperative in a declarative interface.
        setTraverse({
            ...traverse,
            execute: true
        });
        onChange(sourceId, sourceIndex, targetIndex, targetId);
    }
    function measureAll() {
        dropRefs.current.forEach(ref => {
            ref.remeasure();
        });
    }
    return (React.createElement(GridContext.Provider, { value: {
            register,
            remove,
            getActiveDropId,
            startTraverse,
            traverse,
            measureAll,
            endTraverse,
            onChange: onSwitch
        } }, children));
}

function useMeasure(ref) {
    const [bounds, setBounds] = React.useState({
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        right: 0,
        bottom: 0
    });
    const [observer] = React.useState(() => new ResizeObserver(([entry]) => {
        setBounds(entry.target.getBoundingClientRect());
    }));
    React.useLayoutEffect(() => {
        if (ref.current) {
            observer.observe(ref.current);
        }
        return () => observer.disconnect();
    }, [ref, observer]);
    function remeasure() {
        setBounds(ref.current.getBoundingClientRect());
    }
    return { bounds, remeasure };
}

function swap(array, moveIndex, toIndex) {
    /* #move - Moves an array item from one position in an array to another.
       Note: This is a pure function so a new array will be returned, instead
       of altering the array argument.
      Arguments:
      1. array     (String) : Array in which to move an item.         (required)
      2. moveIndex (Object) : The index of the item to move.          (required)
      3. toIndex   (Object) : The index to move item at moveIndex to. (required)
    */
    const item = array[moveIndex];
    const length = array.length;
    const diff = moveIndex - toIndex;
    if (diff > 0) {
        // move left
        return [
            ...array.slice(0, toIndex),
            item,
            ...array.slice(toIndex, moveIndex),
            ...array.slice(moveIndex + 1, length)
        ];
    }
    else if (diff < 0) {
        // move right
        const targetIndex = toIndex + 1;
        return [
            ...array.slice(0, moveIndex),
            ...array.slice(moveIndex + 1, targetIndex),
            item,
            ...array.slice(targetIndex, length)
        ];
    }
    return array;
}

const GridItemContext = React.createContext(null);

function GridDropZone({ id, boxesPerRow, children, style, disableDrag = false, disableDrop = false, rowHeight, ...other }) {
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

function move(source, destination, droppableSource, droppableDestination) {
    const sourceClone = Array.from(source);
    const destClone = Array.from(destination);
    const [removed] = sourceClone.splice(droppableSource, 1);
    destClone.splice(droppableDestination, 0, removed);
    return [sourceClone, destClone];
}

function GridItem({ children, style, className, ...other }) {
    const context = React.useContext(GridItemContext);
    if (!context) {
        throw Error("Unable to find GridItem context. Please ensure that GridItem is used as a child of GridDropZone");
    }
    const { top, disableDrag, endTraverse, onStart, mountWithTraverseTarget, left, i, onMove, onEnd, grid, dragging: isDragging, } = context;
    const { columnWidth, rowHeight } = grid;
    const dragging = React.useRef(false);
    const startCoords = React.useRef([left, top]);
    const [styles, set] = reactSpring.useSpring(() => {
        if (mountWithTraverseTarget) {
            // this feels really brittle. unsure of a better
            // solution for now.
            const mountXY = mountWithTraverseTarget;
            endTraverse();
            return {
                xy: mountXY,
                immediate: true,
                zIndex: "1",
                scale: 1.1,
                opacity: 0.8,
            };
        }
        return {
            xy: [left, top],
            immediate: true,
            zIndex: "0",
            scale: 1,
            opacity: 1,
        };
    });
    // handle move updates imperatively
    function handleMove(state, e) {
        const x = startCoords.current[0] + state.delta[0];
        const y = startCoords.current[1] + state.delta[1];
        set({
            xy: [x, y],
            zIndex: "1",
            immediate: true,
            opacity: 0.8,
            scale: 1.1,
        });
        onMove(state, x, y);
    }
    // handle end of drag
    function handleEnd(state) {
        const x = startCoords.current[0] + state.delta[0];
        const y = startCoords.current[1] + state.delta[1];
        dragging.current = false;
        onEnd(state, x, y);
    }
    const { bind } = reactGestureResponder.useGestureResponder({
        onMoveShouldSet: (state) => {
            if (disableDrag) {
                return false;
            }
            onStart();
            startCoords.current = [left, top];
            dragging.current = true;
            return true;
        },
        onMove: handleMove,
        onTerminationRequest: () => {
            if (dragging.current) {
                return false;
            }
            return true;
        },
        onTerminate: handleEnd,
        onRelease: handleEnd,
    }, {
        enableMouse: true,
    });
    /**
     * Update our position when left or top
     * values change
     */
    React.useEffect(() => {
        if (!dragging.current) {
            set({
                xy: [left, top],
                zIndex: "0",
                opacity: 1,
                scale: 1,
                immediate: false,
            });
        }
    }, [dragging.current, left, top]);
    const props = {
        className: "GridItem" +
            (isDragging ? " dragging" : "") +
            (!!disableDrag ? " disabled" : "") +
            className
            ? ` ${className}`
            : "",
        ...bind,
        style: {
            cursor: !!disableDrag ? "grab" : undefined,
            zIndex: styles.zIndex,
            position: "absolute",
            width: columnWidth + "px",
            opacity: styles.opacity,
            height: rowHeight + "px",
            boxSizing: "border-box",
            transform: reactSpring.interpolate([styles.xy, styles.scale], (xy, s) => `translate3d(${xy[0]}px, ${xy[1]}px, 0) scale(${s})`),
            ...style,
        },
        ...other,
    };
    return typeof children === "function" ? (children(reactSpring.animated.div, props, {
        dragging: isDragging,
        disabled: !!disableDrag,
        i,
        grid,
    })) : (React.createElement(reactSpring.animated.div, Object.assign({}, props), children));
}

exports.GridContext = GridContext;
exports.GridContextProvider = GridContextProvider;
exports.GridDropZone = GridDropZone;
exports.GridItem = GridItem;
exports.move = move;
exports.swap = swap;
