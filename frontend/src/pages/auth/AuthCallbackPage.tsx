import { getAuthUserData } from "@/api/auth"
import { useEffect } from "react"

function AuthCallbackPage() {
    const getUserData = async () => {
        try {
            const params = new URLSearchParams(window.location.search);
            const accessToken = params.get("accessToken");
            const refreshToken = params.get("refreshToken");

            if (accessToken) {
                localStorage.setItem("accessToken", accessToken);
            }
            if (refreshToken) {
                localStorage.setItem("refreshToken", refreshToken);
            }

            if (params.get("auth") === "failed") {
                window.location.href = "/auth/login";
                return;
            }

            const data = await getAuthUserData()
            if (data) {
                const { _id, name, email, image, googleAccessToken } = data
                const user = { _id, name, email, image, googleAccessToken }
                localStorage.setItem("userData", JSON.stringify(user))

                if (data.token?.accessToken) {
                    localStorage.setItem("accessToken", data.token.accessToken)
                }
                if (data.token?.refreshToken) {
                    localStorage.setItem("refreshToken", data.token.refreshToken)
                }

                window.location.href = "/notes"
            }
        } catch (error) {
            console.error("Auth callback failed:", error)
            window.location.href = "/auth/login"
        }
    }

    useEffect(() => {
        getUserData()
    }, [])

    return (
        <div className="min-h-screen flex items-center justify-center">
            <p className="text-gray-600">Authenticating...</p>
        </div>
    )
}

export default AuthCallbackPage
