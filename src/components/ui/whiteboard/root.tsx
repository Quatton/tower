import { useEffect, useState } from "react";
import { Stage } from "react-konva";

export function WhiteBoardRoot({
  children,
  containerRef,
}: {
  children?: React.ReactNode;
  containerRef?: React.RefObject<HTMLDivElement | null | undefined>;
}) {
  const [dimensions, setDimensions] = useState({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(() => {
      setDimensions({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    });

    resizeObserver.observe(container);
    return () => {
      resizeObserver.unobserve(container);
    };
  }, [containerRef]);

  return (
    <Stage width={dimensions.width} height={dimensions.height}>
      {children}
    </Stage>
  );
}
