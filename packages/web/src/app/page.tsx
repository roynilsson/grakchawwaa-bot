import { signIn } from "@/lib/auth"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-2xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Grakchawwaa
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            SWGOH Guild Management
          </p>
        </div>

        <form
          action={async () => {
            "use server"
            await signIn("discord", { redirectTo: "/guild-members" })
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Sign in with Discord
          </button>
        </form>

        <p className="text-center text-xs text-gray-500">
          Sign in to view your guild's data and track performance
        </p>
      </div>
    </div>
  )
}
