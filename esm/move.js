export function move(source, destination, droppableSource, droppableDestination) {
    const sourceClone = Array.from(source);
    const destClone = Array.from(destination);
    const [removed] = sourceClone.splice(droppableSource, 1);
    destClone.splice(droppableDestination, 0, removed);
    return [sourceClone, destClone];
}
