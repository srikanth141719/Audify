import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 font-serif text-neutral-900 dark:text-neutral-100 p-8 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-12 border-b border-neutral-200 dark:border-neutral-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/70 dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center shadow-inner backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold tracking-wide text-neutral-900 dark:text-white">Audify</h1>
          </div>
          
          <form action={async () => {
             'use server'
             const supabase = createClient()
             await supabase.auth.signOut()
             redirect('/login')
          }}>
            <button className="text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors border border-neutral-200 dark:border-neutral-800 px-4 py-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900">
              Sign Out
            </button>
          </form>
        </header>

        <main>
          <div className="bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-xl rounded-2xl p-8 border border-neutral-200 dark:border-neutral-800 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-emerald-500/10 via-transparent to-green-500/10"></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-500"></div>
            
            <h2 className="relative text-2xl font-semibold mb-4 text-neutral-900 dark:text-neutral-100">Welcome to your Library</h2>
            <p className="relative text-neutral-600 dark:text-neutral-300">
              You are signed in as <span className="font-medium text-emerald-600 dark:text-emerald-400 break-all">{user.email}</span>.
            </p>
            <div className="relative mt-8 p-6 bg-white/50 dark:bg-neutral-950/50 rounded-lg border border-neutral-200 dark:border-neutral-800 flex flex-col items-center gap-6">
              <p className="text-sm italic text-neutral-600 dark:text-neutral-300 text-center">
                Your audiobook journey begins here. Use the studio dashboard to clone voices and breathe life into plain text.
              </p>
              <a href="/dashboard" className="bg-gradient-to-r from-emerald-500 to-green-600 text-white py-3 px-8 rounded-xl font-bold tracking-wide shadow-lg hover:shadow-xl hover:from-emerald-600 hover:to-green-700 transition-all">
                Launch Studio
              </a>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
