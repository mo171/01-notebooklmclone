import { getSourceResults } from '@/api/notes';
import { createSlice, configureStore, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'



export const fetchNoteSourceResult = createAsyncThunk(
    "notes/sources/result",
    async (noteId: string) => getSourceResults(noteId)
);



const sourceNoteResultState = {
    sources: [] as Array<{ _id?: string; total_source: number; content: string; noteId: string; userId: string; title?: string; source_type?: string }>,
    loading: false,
    error: null,
    sourceModal: { modal: false, title: "", content: "", source_type: "" },
    mindMapModal: { modal: false, title: "", content: "", source_type: "" },
    audioCard: { show: false, title: "", content: "", source_type: "",sourceSectionHeight:100 }
};



export const rightPanelSlice = createSlice({
    name: 'rightPanel',
    initialState: {
        docIds: [] as string[],
        ...sourceNoteResultState


    },
    reducers: {


        closeMindMap: (state) => {
            state.mindMapModal.modal = false

        },

        closeSourceModal: (state) => {
            state.sourceModal.modal = false
            state.sourceModal.title = ''
            state.sourceModal.content = ''
        },

        closeAudioCard: (state) => {
             state.audioCard.sourceSectionHeight+=40
            state.audioCard.show = false
            state.audioCard.title = ''
            state.audioCard.content = ''
           
        },


        showSourceModalContent: (state, action: PayloadAction<{ title: string, content: string, source_type: string }>) => {

            if (action.payload.source_type.includes('mindMap')) {
                state.mindMapModal.title = action.payload?.title
                state.mindMapModal.content = action.payload?.content
                state.mindMapModal.source_type = action.payload?.source_type
                state.mindMapModal.modal = true
            }
            else if (
                action.payload.source_type.includes('audio') ||
                action.payload.source_type.includes('briefing')
            ) {
                state.sourceModal.modal = true
                state.sourceModal.title = action.payload?.title
                state.sourceModal.content = action.payload?.content
                state.sourceModal.source_type = action.payload?.source_type
            }
            else {
                state.sourceModal.modal = true
                state.sourceModal.title = action.payload?.title
                state.sourceModal.content = action.payload?.content
                state.sourceModal.source_type = action.payload?.source_type
            }


        },
        addDocIds: (state, action: PayloadAction<string>) => {
            const exist = state.docIds.includes(action.payload)
            if (exist) {
                state.docIds = state.docIds.filter((id: string) => id !== action.payload)
            } else {
                state.docIds.push(action.payload)
            }
        },
        setDocIds: (state, action: PayloadAction<string[]>) => {
            state.docIds = action.payload
        },
        clearDocIds: (state) => {
            state.docIds = []
        },
        clearStudioState: (state) => {
            state.sources = []
            state.docIds = []
            state.sourceModal = { modal: false, title: "", content: "", source_type: "" }
            state.mindMapModal = { modal: false, title: "", content: "", source_type: "" }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchNoteSourceResult.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchNoteSourceResult.fulfilled, (state, action) => {
                state.sources = Array.isArray(action.payload?.sources)
                    ? action.payload.sources
                    : [];
                state.loading = false;
            })
            .addCase(fetchNoteSourceResult.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || "Failed to fetch sources";
            });
    },
})

export const { addDocIds, setDocIds, clearDocIds, clearStudioState, showSourceModalContent, closeAudioCard, closeSourceModal, closeMindMap } = rightPanelSlice.actions


export default rightPanelSlice.reducer
