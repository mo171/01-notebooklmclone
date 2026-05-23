import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import { ToastContainer } from 'react-toastify';

export default function ChatLayout() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem("accessToken")) {
      navigate("/auth/login");
    }
  }, [navigate]);

  return (
    <div className="bg-gradient-to-br p-3 from-blue-50 to-indigo-100">
      {/* <main className="flex-1 h-full p-3 bg-gradient-to-br from-blue-50 to-indigo-100"> */}
        <Outlet />
        <ToastContainer />
    {/* //   </main> */}

    </div>
  );
}