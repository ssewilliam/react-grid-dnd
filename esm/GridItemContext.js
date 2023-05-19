import * as React from "react";
const noop = () => {
    throw Error("GridItem must be used as a child of GridDropZone");
};
export const GridItemContext = React.createContext(null);
