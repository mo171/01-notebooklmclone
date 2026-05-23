import { getUserData } from "@/helper/getUserData";
import { getErrorMessage, makeHttpReq } from "@/helper/makeHttpReq";
import { debugLog } from "@/helper/debugLog";
import type { NoteServerData, NoteType } from "@/types/note-types";
import { showError, showSuccess } from "@/util/toast-notification";

function handleApiError(scope: string, error: unknown) {
  const message = getErrorMessage(error);
  debugLog(scope, "failed", error);
  showError(message);
  throw error;
}

export async function getNotes(page = 1, search: string = ''): Promise<NoteServerData> {
    debugLog("getNotes", "called", { page, search });
    const data = await makeHttpReq('GET', `notes?page=${page}&search=${search}`) as NoteServerData
    return data
}

export async function getSingleNote(id: string): Promise<{ note: NoteType }> {
    debugLog("getSingleNote", "called", { id });
    const data = await makeHttpReq('GET', `notes/${id}`) as { note: NoteType }
    return data
}

const downloadFileInDrive = async (fileId: string, noteId?: string) => {
    debugLog("downloadFileInDrive", "called", { fileId, noteId });
    const userData = getUserData()
    const userId = userData?._id
    return makeHttpReq('POST', `notes/drive-files`, { fileId, userId, noteId })
};

export const uploadPickedFiles = async (docs: { id: string }[], noteId?: string) => {
    debugLog("uploadPickedFiles", "called", { count: docs?.length, noteId });
    if (!noteId || !Array.isArray(docs) || docs.length === 0) {
        return
    }
    for (const doc of docs) {
        await downloadFileInDrive(doc.id, noteId)
    }
};

export const sendWeblink = async (webLink: string, noteId?: string) => {
    debugLog("sendWeblink", "called", { webLink, noteId });
    const userData = getUserData()
    const userId = userData?._id
    return makeHttpReq('POST', `notes/weblinkdata`, { webLink, userId, noteId })
};

export const sendTextData = async (text: string, noteId?: string) => {
    debugLog("sendTextData", "called", { noteId, textLength: text.length });
    const userData = getUserData()
    const userId = userData?._id
    return makeHttpReq('POST', `notes/text-data`, { text, userId, noteId })
};

export const sendYoutubeLink = async (youtubeLink: string, noteId?: string) => {
    debugLog("sendYoutubeLink", "called", { youtubeLink, noteId });
    const userData = getUserData()
    const userId = userData?._id
    return makeHttpReq('POST', `notes/youtube-link`, { youtubeLink, userId, noteId })
};

export const searchWeb = async (query: string, userId: string) => {
    debugLog("searchWeb", "called", { query, userId });
    try {
        return await makeHttpReq('GET', `notes/search/web?query=${encodeURIComponent(query)}&userId=${userId}`)
    } catch (error) {
        handleApiError("searchWeb", error);
    }
};

export const updateNote = async (noteId: string, title: string) => {
    debugLog("updateNote", "called", { noteId, title });
    try {
        const data = await makeHttpReq('PUT', `notes`, { title, id: noteId })
        showSuccess(data?.message as string)
    } catch (error) {
        handleApiError("updateNote", error);
    }
};

export const createSummary = async (noteId: string, docIds: string[]) => {
    debugLog("createSummary", "called", { noteId, docIds });
    try {
        const userData = getUserData()
        const userId = userData?._id
        const data = await makeHttpReq('POST', `notes/summary`, { userId, noteId, docIds })
        if (data.status === 'ready_to_generate_source') {
            await generateSummarySource(userId, noteId, docIds)
        }
        return data
    } catch (error) {
        handleApiError("createSummary", error);
    }
};

export const generateSummarySource = async (userId: string, noteId: string, docIds: string[]) => {
    debugLog("generateSummarySource", "called", { noteId, docIds });
    try {
        const data = await makeHttpReq('POST', `notes/add/sources`, { userId, noteId, docIds })
        showSuccess(data?.message)
        return data
    } catch (error) {
        handleApiError("generateSummarySource", error);
    }
}

export const createFAQ = async (noteId: string, docIds: string[]) => {
    debugLog("createFAQ", "called", { noteId, docIds });
    try {
        const userData = getUserData()
        const userId = userData?._id
        const data = await makeHttpReq('POST', `notes/faq`, { userId, noteId, docIds })
        if (data.status === 'ready_to_generate_source') {
            await generateFAQSource(userId, noteId, docIds)
        }
        return data
    } catch (error) {
        handleApiError("createFAQ", error);
    }
};

export const generateFAQSource = async (userId: string, noteId: string, docIds: string[]) => {
    debugLog("generateFAQSource", "called", { noteId, docIds });
    try {
        const data = await makeHttpReq('POST', `notes/add/faq/sources`, { userId, noteId, docIds })
        showSuccess(data?.message)
        return data
    } catch (error) {
        handleApiError("generateFAQSource", error);
    }
}

export const createStudyGuide = async (noteId: string, docIds: string[]) => {
    debugLog("createStudyGuide", "called", { noteId, docIds });
    try {
        const userData = getUserData()
        const userId = userData?._id
        const data = await makeHttpReq('POST', `notes/studyguide`, { userId, noteId, docIds })
        if (data.status === 'ready_to_generate_source') {
            await generateStudyguide(userId, noteId, docIds)
        }
        return data
    } catch (error) {
        handleApiError("createStudyGuide", error);
    }
};

export const generateStudyguide = async (userId: string, noteId: string, docIds: string[]) => {
    debugLog("generateStudyguide", "called", { noteId, docIds });
    try {
        const data = await makeHttpReq('POST', `notes/add/studyguide/sources`, { userId, noteId, docIds })
        showSuccess(data?.message)
        return data
    } catch (error) {
        handleApiError("generateStudyguide", error);
    }
}

export const createBriefingDoc = async (noteId: string, docIds: string[], type: 'audio' | 'briefing-doc') => {
    debugLog("createBriefingDoc", "called", { noteId, docIds, type });
    try {
        const userData = getUserData()
        const userId = userData?._id
        const data = await makeHttpReq('POST', `notes/briefingdoc`, { userId, noteId, docIds, type })
        if (data.status === 'ready_to_generate_source') {
            await generateBriefingDoc(userId, noteId, docIds, type)
        }
        return data
    } catch (error) {
        handleApiError("createBriefingDoc", error);
    }
};

export const generateBriefingDoc = async (userId: string, noteId: string, docIds: string[], type: 'audio' | 'briefing-doc') => {
    debugLog("generateBriefingDoc", "called", { noteId, docIds, type });
    try {
        const data = await makeHttpReq('POST', `notes/add/briefingdoc/sources`, { userId, noteId, docIds, type })
        showSuccess(data?.message)
        return data
    } catch (error) {
        handleApiError("generateBriefingDoc", error);
    }
}

export async function getSourceResults(noteId: string) {
    debugLog("getSourceResults", "called", { noteId });
    const userData = getUserData()
    const userId = userData?._id
    return makeHttpReq('GET', `notes/source/results?noteId=${noteId}&userId=${userId}`)
}

export const createMindMap = async (noteId: string | undefined, docIds: string[]) => {
    debugLog("createMindMap", "called", { noteId, docIds });
    try {
        const userData = getUserData()
        const userId = userData?._id
        const data = await makeHttpReq('POST', `notes/mindmap`, { userId, noteId, docIds })
        if (data.status === 'ready_to_generate_source') {
            await generateMindMap(userId, noteId, docIds)
        }
        return data
    } catch (error) {
        handleApiError("createMindMap", error);
    }
};

export const generateMindMap = async (userId: string, noteId: string | undefined, docIds: string[]) => {
    debugLog("generateMindMap", "called", { noteId, docIds });
    try {
        const data = await makeHttpReq('POST', `notes/add/mindmap/sources`, { userId, noteId, docIds })
        showSuccess(data?.message)
        return data
    } catch (error) {
        handleApiError("generateMindMap", error);
    }
}

export type messageType = { role: 'ai' | 'user', noteId: string, userId: string, content: string }
export type chatHistoryType = { chatHistory: Array<messageType> }

export const getNoteChats = async (userId: string, noteId: string) => {
    debugLog("getNoteChats", "called", { userId, noteId });
    try {
        return await makeHttpReq('GET', `chats/history?userId=${userId}&noteId=${noteId}`) as chatHistoryType
    } catch (error) {
        handleApiError("getNoteChats", error);
    }
}

export const sendChatMessage = async ({ userId, noteId, query }: { userId: string, noteId: string, query: string }) => {
    debugLog("sendChatMessage", "called", { userId, noteId, query });
    const data = await makeHttpReq('POST', `chats`, { userId, noteId, query }) as { message: messageType }
    return data
}

export type questionAndDocOverviewType = { aiResult: { questions: string[], doc_overview: string } }

export const getQuestionsAndDocOverview = async (noteId: string) => {
    debugLog("getQuestionsAndDocOverview", "called", { noteId });
    const data = await makeHttpReq('GET', `notes/docs/overview?noteId=${noteId}`) as questionAndDocOverviewType
    return data ?? { aiResult: { questions: [], doc_overview: "" } }
}

export const createBlankNote = async () => {
    debugLog("createBlankNote", "called");
    const userData = getUserData()
    const userId = userData?._id
    return makeHttpReq('POST', `blank/notes`, { userId }) as Promise<{
        newNote: { _id: string; title: string }
    }>
};
