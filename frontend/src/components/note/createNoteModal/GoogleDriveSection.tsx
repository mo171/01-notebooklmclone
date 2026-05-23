import { useEffect } from "react";
import { HardDrive } from "lucide-react";
import useDrivePicker from "react-google-drive-picker";
import type { AppDispatch } from "@/store";
import { useDispatch } from "react-redux";
import { developerKey, googleClientId } from "@/config/get-env";
import { getUserData } from "@/helper/getUserData";
import { uploadPickedFiles } from "@/api/notes";
import { showError, showInfo } from "@/util/toast-notification";
import { fetchNoteSourceResult, setDocIds } from "@/store/rightPanelSlice";
import { fetchSingleNote } from "@/store/chatSlice";

declare global {
  interface Window {
    gapi?: { load: (name: string, opts?: { callback?: () => void }) => void };
  }
}

/** Only mount when Add Sources modal is open — avoids gapi.load crash on app load. */
export function GoogleDriveSection({ noteId }: { noteId?: string }) {
  const dispatch = useDispatch<AppDispatch>();
  const userData = getUserData();
  const [openPicker, data] = useDrivePicker();

  useEffect(() => {
    if (!data?.docs?.length || !noteId) return;

    (async () => {
      try {
        await uploadPickedFiles(data.docs, noteId);
        const noteResult = await dispatch(fetchSingleNote(noteId));
        const allDocs =
          (noteResult.payload as { note?: { docs?: Array<{ _id: string; source_type?: string }> } })
            ?.note?.docs ?? [];
        const selectableIds = allDocs
          .filter(
            (d) =>
              !["mindmap", "faq", "summary", "studyguide", "briefing-doc", "audio"].includes(
                (d.source_type ?? "").toLowerCase(),
              ),
          )
          .map((d) => d._id);
        if (selectableIds.length > 0) {
          dispatch(setDocIds(selectableIds));
        }
        dispatch(fetchNoteSourceResult(noteId));
        showInfo("Google Drive file(s) added");
      } catch {
        showError("Failed to import Google Drive file(s)");
      }
    })();
  }, [data, noteId, dispatch]);

  const handleOpenPicker = () => {
    if (!noteId) {
      showError("Open a notebook before importing from Drive");
      return;
    }
    if (!googleClientId) {
      showError("Google Client ID is not configured (VITE_GOOGLE_CLIENT_ID)");
      return;
    }
    if (!developerKey) {
      showError("Google API key is not configured (VITE_DEVELOPPER_KEY)");
      return;
    }
    if (!userData?.googleAccessToken) {
      showError("Sign in with Google again to access Drive");
      return;
    }
    if (!window.gapi?.load) {
      showError("Google APIs are still loading — try again in a moment");
      return;
    }

    openPicker({
      clientId: googleClientId,
      developerKey: developerKey,
      viewId: "DOCS",
      token: userData.googleAccessToken,
      showUploadView: true,
      showUploadFolders: true,
      supportDrives: true,
      multiselect: true,
    });
  };

  return (
    <div className="flex-1 cursor-pointer rounded-md border border-gray-200 p-4">
      <div className="mb-5">
        <p className="text-gray-900">Google Workspace</p>
      </div>
      <button
        type="button"
        onClick={handleOpenPicker}
        className="flex gap-2 bg-slate-100 p-2 rounded-md text-sm text-blue-600 font-semibold"
      >
        <HardDrive />
        Google Drive
      </button>
    </div>
  );
}
