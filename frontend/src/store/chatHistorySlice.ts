import { getNoteChats, type chatHistoryType, type messageType } from '@/api/notes';
import { createSlice, configureStore, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'



export const fetchChats = createAsyncThunk(
  "chats/history",
  async ({userId,noteId}:{userId:string,noteId:string}) => getNoteChats(userId,noteId)
);

type ChatState = {
  chatHistory: chatHistoryType | null|undefined;
  loading: boolean;
  error: string | null;
};


const chatState :ChatState= {
  chatHistory: null,
  loading: false,
  error: null,
};


const chatHistorySlice = createSlice({
  name: 'chatHistory',
  initialState: {
 
    ...chatState
  },
  reducers: {
   


    addMessageInChatHistory: (state, action: PayloadAction<messageType>) => {
      if (!state.chatHistory) {
        state.chatHistory = { chatHistory: [] };
      }
      if (!state.chatHistory.chatHistory) {
        state.chatHistory.chatHistory = [];
      }
      state.chatHistory.chatHistory.push(action.payload);
    },
    removeLastChatMessage: (state) => {
      state.chatHistory?.chatHistory?.pop();
    },
    clearChatHistory: (state) => {
      state.chatHistory = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder .addCase(fetchChats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchChats.fulfilled, (state, action: PayloadAction<chatHistoryType | undefined>) => {
        state.chatHistory = action.payload ?? { chatHistory: [] };
        state.loading = false;
      })
      .addCase(fetchChats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch notes";
      });
      
  },
})

export const { addMessageInChatHistory, removeLastChatMessage, clearChatHistory } = chatHistorySlice.actions



export default chatHistorySlice.reducer