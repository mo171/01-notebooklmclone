import type { AppDispatch, RootState } from "@/store";
import {
  addExtraWidth,
  reduceExtraWidth,
  toggleLeftPanel,
} from "@/store/chatSlice";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "../ui/button";
import {
  FileText,
  NotepadText,
  PanelLeft,
  Plus,
  Search,
  Youtube,
} from "lucide-react";
import { toggleAddSourceNoteModal } from "@/store/addSourceSlice";
import type { NoteType } from "@/types/note-types";
import { Checkbox } from "../ui/checkbox";
import { toggleDiscoveryModal } from "@/store/discoveryModalSlice";
import { useEffect } from "react";
import { addDocIds, setDocIds } from "@/store/rightPanelSlice";
import PdfIcon from '@/assets/pdf.png'
import { debugLog } from "@/helper/debugLog";

type LeftPanelProps = {
  note: NoteType;
  loading: boolean
};

const LeftPanel = ({ note, loading }: LeftPanelProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const { leftPanelOpen } = useSelector((state: RootState) => state.chat);
  const { docIds } = useSelector((state: RootState) => state.rightPanel);

  const allDocs = note?.docs ?? [];
  const inputDocs = allDocs.filter(
    (doc) => !["mindmap", "faq", "summary", "studyguide", "briefing-doc", "audio"].includes(
      (doc.source_type ?? "").toLowerCase()
    )
  );

  const selectionStorageKey = note?._id ? `notebooklm:selected-docs:${note._id}` : "";

  // Auto-select all sources when switching notebooks (not when user manually clears)
  useEffect(() => {
    if (!note?._id) return;

    try {
      const saved = window.localStorage.getItem(selectionStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        const validIds = parsed.filter((id) => inputDocs.some((doc) => doc._id === id));
        if (validIds.length > 0) {
          debugLog("LeftPanel", "restoring saved sources", { noteId: note._id, validIds });
          dispatch(setDocIds(validIds));
          return;
        }
      }
    } catch (error) {
      debugLog("LeftPanel", "failed to restore saved sources", error);
    }

    if (inputDocs.length > 0) {
      const ids = inputDocs.map((d) => d._id);
      debugLog("LeftPanel", "auto-selecting sources for notebook", { noteId: note?._id, ids });
      dispatch(setDocIds(ids));
    }
  }, [note?._id, inputDocs.length, dispatch, selectionStorageKey]);

  useEffect(() => {
    if (!selectionStorageKey) return;
    try {
      window.localStorage.setItem(selectionStorageKey, JSON.stringify(docIds));
    } catch (error) {
      debugLog("LeftPanel", "failed to persist selected sources", error);
    }
  }, [docIds, selectionStorageKey]);

  function togglePanel() {
    if (leftPanelOpen) {
      dispatch(addExtraWidth());
      dispatch(toggleLeftPanel());
    } else {
      dispatch(reduceExtraWidth());
      dispatch(toggleLeftPanel());
    }
  }

  function handleDocSelect(docId: string) {
    debugLog("LeftPanel", "toggle source", { docId });
    dispatch(addDocIds(docId));
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      const ids = inputDocs.map((d) => d._id);
      debugLog("LeftPanel", "select all", ids);
      dispatch(setDocIds(ids));
    } else {
      debugLog("LeftPanel", "clear selection");
      dispatch(setDocIds([]));
    }
  }

  const allSelected =
    inputDocs.length > 0 && inputDocs.every((d) => docIds.includes(d._id));

  return (
    <div
      className={`bg-white shadow-sm h-full transition-all duration-300 flex flex-col ${leftPanelOpen
        ? "w-[25%] p-4 rounded-md"
        : "w-16 p-2 rounded-r-2xl rounded-l-2xl"
        }`}
    >
      <div className="flex justify-between items-center mb-2 flex-shrink-0">
        {leftPanelOpen && <p className="text-base text-gray-800">Sources</p>}
        <Button
          variant="link"
          size="icon"
          className="size-8 hover:bg-slate-100 cursor-pointer"
          onClick={() => togglePanel()}
        >
          <PanelLeft size={35} />
        </Button>
      </div>

      {leftPanelOpen && <hr className="mb-2" />}

      <div className="flex-shrink-0">
        {leftPanelOpen ? (
          <div className="flex mt-3 justify-between">
            <Button
              onClick={() => dispatch(toggleAddSourceNoteModal())}
              variant="outline"
              className="rounded-3xl px-5 py-4 w-35"
            >
              <Plus size={18} /> Add
            </Button>
            <Button
              onClick={() => dispatch(toggleDiscoveryModal())}
              variant="outline"
              className="rounded-3xl px-5 py-3 w-35"
            >
              <Search size={18} /> Discover
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center mt-6 gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => dispatch(toggleAddSourceNoteModal())}
            >
              <Plus size={18} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => dispatch(toggleDiscoveryModal())}
            >
              <Search size={18} />
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto mt-4 pr-2">
        {leftPanelOpen ? (
          loading ? <DocRowSkeleton count={12} /> :
            allDocs.length ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => handleSelectAll(checked === true)}
                  />
                  <span className="text-sm font-medium">Select all sources</span>
                </div>
                {allDocs.map((doc) => (
                  <div
                    key={doc._id}
                    className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded-md"
                  >
                    <SourceIcon type={doc?.source_type} />
                    <span className="flex-1 text-base text-gray-600 truncate">
                      {doc?.title ?? doc?.fileName ?? "Untitled"}
                    </span>
                    <Checkbox
                      className="cursor-pointer"
                      checked={docIds.includes(doc._id)}
                      onCheckedChange={() => handleDocSelect(doc._id)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <NotepadText className="text-gray-500 mx-auto" size={60} />
                <p className="text-sm text-gray-400 font-semibold mt-4 px-3">
                  Saved sources will appear here. Click Add source above to add
                  PDFs, websites, text, videos, or audio files. Or import a file
                  directly from Google Drive.
                </p>
              </div>
            )
        ) : (
          <div className="flex flex-col items-center mt-6 pl-3 gap-4">
            {allDocs.map((doc) => (
              <Button key={doc._id} variant="outline" size="icon">
                <FileText className="text-blue-500" size={20} />
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

type DocRowSkeletonProps = {
  count?: number;
};

const DocRowSkeleton: React.FC<DocRowSkeletonProps> = ({ count = 5 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center gap-2 p-2 rounded-md animate-pulse bg-gray-100"
        >
          <div className="w-5 h-5 bg-gray-300 rounded" />
          <div className="flex-1 h-4 bg-gray-300 rounded" />
          <div className="w-5 h-5 bg-gray-300 rounded" />
        </div>
      ))}
    </div>
  );
};

interface SourceIconProps {
  type?: string;
}

function SourceIcon({ type = "" }: SourceIconProps) {
  const normalized = type.toLowerCase();

  if (normalized.includes("youtube")) {
    return <Youtube className="text-red-500" />;
  }

  if (normalized.includes("pdf")) {
    return (
      <img
        src={PdfIcon}
        alt="PDF Icon"
        width={24}
        height={24}
        className="rounded"
      />
    );
  }

  return <FileText className="text-blue-500" size={20} />
}

export default LeftPanel;
