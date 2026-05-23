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
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const mindInstanceRef = React.useRef<any>(null);
  const dispatch = useDispatch<AppDispatch>();
  const { mindMapModal } = useSelector((state: RootState) => state.rightPanel);

  useEffect(() => {
    debugLog("MindMapSourceModal", "state snapshot", {
      open: mindMapModal.modal,
      title: mindMapModal.title,
      contentLength: mindMapModal.content?.length ?? 0,
    });

    if (!mindMapModal.modal || !containerRef.current || !canvasRef.current || !mindMapModal.content) {
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

    const options = {
      el: canvasRef.current,
      direction: MindElixir.SIDE,
      draggable: true,
      editable: true,
      overflowHidden: false,
    };

    let destroyed = false;
    let mounted = false;
    let resizeObserver: ResizeObserver | null = null;

    const mountMindMap = () => {
      if (destroyed || !containerRef.current) {
        return false;
      }

      const { clientWidth, clientHeight } = canvasRef.current ?? { clientWidth: 0, clientHeight: 0 };
      if (clientWidth === 0 || clientHeight === 0) {
        debugLog("MindMapSourceModal", "waiting for canvas size", {
          clientWidth,
          clientHeight,
        });
        return false;
      }

      mindInstanceRef.current?.destroy?.();
      canvasRef.current.innerHTML = "";

      const mind = new MindElixir(options);
      mind.init(mindMapData);
      requestAnimationFrame(() => {
        mind.toCenter();
        debugLog("MindMapSourceModal", "mind map mounted", {
          nodeCount: canvasRef.current?.querySelectorAll("me-tpc").length ?? 0,
          childCount: canvasRef.current?.children.length ?? 0,
          innerHTMLLength: canvasRef.current?.innerHTML.length ?? 0,
          scrollWidth: containerRef.current?.scrollWidth ?? 0,
          scrollHeight: containerRef.current?.scrollHeight ?? 0,
        });
      });

      mindInstanceRef.current = mind;
      mounted = true;
      return true;
    };

    if (!mountMindMap()) {
      resizeObserver = new ResizeObserver(() => {
        if (mountMindMap()) {
          resizeObserver?.disconnect();
          resizeObserver = null;
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      destroyed = true;
      resizeObserver?.disconnect();
      resizeObserver = null;
      mindInstanceRef.current?.destroy?.();
      mindInstanceRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
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
          height: "600px",
          width: "100%",
          position: "relative",
          overflow: "auto",
          background: "#1f1f1f",
        }}
      >
        <div
          ref={canvasRef}
          style={{
            width: "5000px",
            height: "5000px",
            minWidth: "5000px",
            minHeight: "5000px",
            position: "relative",
          }}
        />
      </div>
    </BaseModal>
  );
};

export default MindMapModel;
