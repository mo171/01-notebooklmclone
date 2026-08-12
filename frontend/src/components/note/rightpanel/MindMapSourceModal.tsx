import * as React from "react";
import MindElixir from "mind-elixir";
import "mind-elixir/style.css";
import { BaseModal } from "@/components/base/BaseModal";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";
import { useEffect } from "react";
import { closeMindMap } from "@/store/rightPanelSlice";
import { debugLog } from "@/helper/debugLog";
import { showError } from "@/util/toast-notification";

function normalizeMindMapPayload(input: unknown) {
  if (!input || typeof input !== "object") {
    return null;
  }

  if ("nodeData" in input) {
    return input as Parameters<typeof MindElixir.prototype.init>[0];
  }

  const rawNode = input as { id?: unknown; topic?: unknown; children?: unknown };
  if (typeof rawNode.id === "string" && typeof rawNode.topic === "string") {
    return {
      nodeData: {
        id: rawNode.id,
        topic: rawNode.topic,
        children: Array.isArray(rawNode.children) ? rawNode.children : [],
      },
    };
  }

  return null;
}

export const MindMapModel = () => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mindInstanceRef = React.useRef<any>(null);
  const dispatch = useDispatch<AppDispatch>();
  const { mindMapModal } = useSelector((state: RootState) => state.rightPanel);

  useEffect(() => {
    debugLog("MindMapSourceModal", "state snapshot", {
      open: mindMapModal.modal,
      title: mindMapModal.title,
      contentLength: mindMapModal.content?.length ?? 0,
    });

    if (!mindMapModal.modal || !containerRef.current || !mindMapModal.content) {
      return;
    }

    debugLog("MindMapSourceModal", "initializing mind map");

    let parsed: unknown;
    try {
      parsed = JSON.parse(mindMapModal.content);
    } catch {
      showError("Mind map data is invalid");
      debugLog("MindMapSourceModal", "JSON parse failed", mindMapModal.content?.slice(0, 200));
      return;
    }

    const normalized = normalizeMindMapPayload(parsed);
    if (!normalized) {
      showError("Mind map data is invalid");
      debugLog("MindMapSourceModal", "Unexpected mind map shape", parsed);
      return;
    }

    const mindMapData = {
      ...normalized,
      theme: MindElixir.DARK_THEME,
    };

    debugLog("MindMapSourceModal", "parsed mind map payload", mindMapData);

    const container = containerRef.current;
    let destroyed = false;
    let mind: any = null;
    let lastSize = "";

    const mountMindMap = () => {
      if (destroyed || mind) return;

      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) {
        debugLog("MindMapSourceModal", "waiting for container size", {
          clientWidth,
          clientHeight,
        });
        return;
      }

      container.innerHTML = "";

      const instance = new MindElixir({
        el: container,
        direction: MindElixir.SIDE,
        draggable: true,
        editable: true,
        overflowHidden: false,
      });

      // init() returns an Error instead of throwing when the payload is unusable.
      const initError = instance.init(mindMapData);
      if (initError instanceof Error) {
        showError("Mind map data is invalid");
        debugLog("MindMapSourceModal", "init rejected the payload", initError.message);
        return;
      }

      mind = instance;
      mindInstanceRef.current = instance;
      debugLog("MindMapSourceModal", "mind map mounted", {
        mountWidth: clientWidth,
        mountHeight: clientHeight,
        nodeCount: container.querySelectorAll("me-tpc").length,
      });
    };

    mountMindMap();

    // mind-elixir centres the canvas exactly once, using the container size it
    // sees at init time, and never re-centres afterwards. Radix mounts the
    // dialog before it settles at its final width, so the map ends up
    // translated hundreds of px to the left and is clipped away by
    // `.map-container { overflow: hidden }` — it looks like nothing rendered.
    // Keep observing for the map's whole lifetime and re-centre on every
    // resize (this also handles window resizes).
    const resizeObserver = new ResizeObserver(() => {
      if (destroyed) return;

      if (!mind) {
        mountMindMap();
        return;
      }

      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;

      const size = `${clientWidth}x${clientHeight}`;
      if (size === lastSize) return;
      lastSize = size;

      mind.toCenter();
      debugLog("MindMapSourceModal", "re-centred after resize", { size });
    });
    resizeObserver.observe(container);

    return () => {
      destroyed = true;
      resizeObserver.disconnect();
      mind?.destroy?.();
      mind = null;
      mindInstanceRef.current = null;
      container.innerHTML = "";
    };
  }, [mindMapModal.modal, mindMapModal.content]);

  return (
    <BaseModal
      background={'#252526'}
      open={mindMapModal.modal}
      onOpenChange={() => dispatch(closeMindMap())}
      title={mindMapModal.title || "Mind Map"}
      width={1450}
      height={670}
      footer={<></>}
    >
      <div
        ref={containerRef}
        style={{
          // Shrink with the viewport so the map never overflows the dialog on
          // short screens; the ResizeObserver re-centres whenever this changes.
          height: "min(600px, calc(100vh - 12rem))",
          minHeight: "300px",
          width: "100%",
          position: "relative",
          background: "#1f1f1f",
        }}
      />
    </BaseModal>
  );
};

export default MindMapModel;
