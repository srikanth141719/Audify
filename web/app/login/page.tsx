import { Suspense } from 'react'
import { login, signup } from './actions'
import { AuthMessages } from './AuthMessages'

export default function LoginPage() {
  return (
    <div className="min-h-screen w-screen flex justify-center items-center bg-neutral-100 dark:bg-neutral-950 font-serif transition-colors duration-300 p-4">
      <div className="w-full max-w-md p-8 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl shadow-2xl rounded-2xl border border-neutral-200 dark:border-neutral-800 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-emerald-500/10 via-transparent to-green-500/10" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-500"></div>
        
        <div className="relative flex justify-center mb-8">
          <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        </div>
        
        <h1 className="relative text-3xl font-bold text-center text-neutral-900 dark:text-white mb-2 tracking-wide">
          Audify
        </h1>
        <p className="relative text-center text-neutral-600 dark:text-neutral-300 mb-8 text-sm italic">
          Breathe life into pure text with magical voices.
        </p>

        <Suspense fallback={null}>
          <AuthMessages />
        </Suspense>

        <form className="relative space-y-6">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full px-4 py-2 bg-white/60 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-neutral-900 dark:text-neutral-100 transition-all"
              placeholder="reader@example.com"
            />
          </div>
          
          <div className="space-y-1">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full px-4 py-2 bg-white/60 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-neutral-900 dark:text-neutral-100 transition-all"
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              formAction={login}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white py-2 px-4 rounded-md font-medium transition-all duration-200 shadow-md shadow-emerald-500/20"
            >
              Sign In
            </button>
            <button
              formAction={signup}
              className="flex-1 bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800 text-emerald-600 dark:text-emerald-400 border border-emerald-500 dark:border-emerald-500 py-2 px-4 rounded-md font-medium transition-colors duration-200"
            >
              Sign Up
            </button>
          </div>
        </form>
        
        <div className="relative mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-800 text-center">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            By continuing, you agree to our Terms of Service & Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}
