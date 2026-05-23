import { getNoteChats, getQuestionsAndDocOverview, getSingleNote, type chatHistoryType, type questionAndDocOverviewType } from '@/api/notes';
import type { NoteType } from '@/types/note-types';
import { createSlice, configureStore, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'


export const fetchSingleNote = createAsyncThunk(
  "notes/singleNote",
  async (id: string) => getSingleNote(id)
);



export const fetchDocOverviewAndQuestions = createAsyncThunk(
  "doc/overview",
  async (noteId: string) => getQuestionsAndDocOverview(noteId)
);




const singleNoteState = {
  note: {} as NoteType,
  noteLoading: false,
  loading: false,
  error: null as string | null,
};


const  docOverviewAndQuestionsState= {
  aiResult: {} as questionAndDocOverviewType,
  
};


const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    leftPanelOpen: true,
    rightPanelOpen: true,
    middlePanelDefaultWidth: 50,
    ...singleNoteState,
    ...docOverviewAndQuestionsState,

    payment:{
      modal:false
    }
  },
  reducers: {

      attribNoteVal: (state ,action)=> {

            state.note=action.payload
        },
    
    togglePaymentModal: state => {

      state.payment.modal = !state.payment.modal
    },

    addExtraWidth: state => {

      state.middlePanelDefaultWidth += 21
    },
    reduceExtraWidth: state => {

      state.middlePanelDefaultWidth -= 21
    },

    toggleLeftPanel: state => {

      state.leftPanelOpen = !state.leftPanelOpen
    },


    toggleRightPanel: state => {

      state.rightPanelOpen = !state.rightPanelOpen
    },

  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSingleNote.pending, (state) => {
        state.noteLoading = true;
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSingleNote.fulfilled, (state, action: PayloadAction<{ note: NoteType }>) => {
        state.note = action.payload.note;
        state.noteLoading = false;
        state.loading = false;
      })
      .addCase(fetchSingleNote.rejected, (state, action) => {
        state.noteLoading = false;
        state.loading = false;
        state.note = {} as NoteType;
        state.error = action.error.message || "Failed to fetch note";
      })



      // doc overview and questions

      .addCase(fetchDocOverviewAndQuestions.pending, () => {})
      .addCase(fetchDocOverviewAndQuestions.fulfilled, (state, action) => {
        state.aiResult = action.payload ?? {
          aiResult: { questions: [], doc_overview: "" },
        };
      })
      .addCase(fetchDocOverviewAndQuestions.rejected, (state, action) => {
        state.aiResult = { aiResult: { questions: [], doc_overview: "" } };
        state.error = action.error.message || "Failed to fetch overview";
      })


  },
})

export const { addExtraWidth,attribNoteVal, toggleLeftPanel, toggleRightPanel, reduceExtraWidth,togglePaymentModal } = chatSlice.actions



export default chatSlice.reducer