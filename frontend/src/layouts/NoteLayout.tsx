import UserAvatar from "@/components/base/UserAvatar";
import { useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router";
import { ToastContainer } from "react-toastify";

export default function NoteLayout() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem("accessToken")) {
      navigate("/auth/login");
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-6 py-3 border-b bg-white shadow-sm">
        {/* Left: Logo + Title */}
        <Link to="/" className="flex items-center space-x-2">
          <span className="font-semibold text-lg text-gray-800">
            NotebookLM
          </span>
        </Link>

        {/* Right: Avatar & Menu */}
        <UserAvatar />
      </header>

      {/* Page Content */}
      <main className="flex-1 p-6 ">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
}
