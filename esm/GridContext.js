import * as React from "react";
import { getPositionForIndex, getIndexFromCoordinates } from "./helpers";
const noop = () => {
    throw new Error("Make sure that you have wrapped your drop zones with GridContext");
};
export const GridContext = React.createContext({
    register: noop,
    remove: noop,
    getActiveDropId: noop,
    startTraverse: noop,
    measureAll: noop,
    traverse: null,
    endTraverse: noop,
    onChange: noop
});
export function GridContextProvider({ children, onChange }) {
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
