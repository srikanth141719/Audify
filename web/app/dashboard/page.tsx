import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white dark:from-neutral-950 dark:to-neutral-900 font-sans text-neutral-900 dark:text-neutral-100 transition-colors duration-300">
      <header className="px-8 py-6 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-neutral-800 dark:text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-wide text-neutral-900 dark:text-neutral-100">Studio</h1>
        </div>
        <form action="/auth/signout" method="post">
           <button className="text-sm font-medium hover:text-neutral-600 transition-colors border border-neutral-200 dark:border-neutral-800 px-4 py-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800">
             Sign Out
           </button>
        </form>
      </header>

      <main className="p-8 max-w-7xl mx-auto">
        <DashboardClient userEmail={user.email || ''} userId={user.id} />
      </main>
    </div>
  )
}
