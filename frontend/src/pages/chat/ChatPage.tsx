import LeftPanel from '@/components/chat/LeftPanel'
import MiddlePanel from '@/components/chat/MiddlePanel'
import RightPanel from '@/components/chat/RightPanel'
import { useEffect } from 'react'
import CreateNoteModal from '@/components/note/createNoteModal/CreateNoteModal'
import { useParams } from 'react-router'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '@/store'
import { fetchDocOverviewAndQuestions, fetchSingleNote } from '@/store/chatSlice'
import UserAvatar from '@/components/base/UserAvatar'
import DiscoveryModal from '@/components/note/DiscoveryModal'
import { EditNote } from '@/components/note/EditNote'
import { clearStudioState, fetchNoteSourceResult } from '@/store/rightPanelSlice'
import { CreditMenu } from '@/components/base/CreditMenu'
import { clearChatHistory, fetchChats } from '@/store/chatHistorySlice'
import { getUserData } from '@/helper/getUserData'
import BuyCreditModal from '@/components/payment/BuyCreditModal'
import { fetchUserCreditAndPayment } from '@/store/creditMenuSlice'

function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { note, noteLoading, aiResult } = useSelector((state: RootState) => state.chat);
  const { chatHistory } = useSelector((state: RootState) => state.chatHistory);
  const { result } = useSelector((state: RootState) => state.creditMenu);
  const userData = getUserData();

  useEffect(() => {
    if (!id || !userData?._id) return;

    dispatch(clearStudioState());
    dispatch(clearChatHistory());
    dispatch(fetchSingleNote(id));
    dispatch(fetchNoteSourceResult(id));
    dispatch(fetchChats({ userId: userData._id, noteId: id }));
    dispatch(fetchDocOverviewAndQuestions(id));
    dispatch(fetchUserCreditAndPayment(userData._id));
  }, [dispatch, id, userData?._id]);

  return (
    <>
      <div className="flex items-center justify-between ">
        <EditNote note={note} />
        <div className='flex gap-4 mr-4'>
          <CreditMenu result={result} />
          <UserAvatar />
          <BuyCreditModal />
        </div>
      </div>

      <div className="flex h-screen gap-2">
        <LeftPanel loading={noteLoading} note={note} />
        <MiddlePanel
          aiResult={aiResult}
          chatHistory={chatHistory ?? { chatHistory: [] }}
          note={note}
          noteId={id}
          userId={userData?._id ?? ""}
        />
        <RightPanel noteId={id} />
        <CreateNoteModal noteId={id} />
        <DiscoveryModal noteId={id} />
      </div>
    </>
  )
}

export default ChatPage
