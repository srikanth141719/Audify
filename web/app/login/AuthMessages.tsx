'use client'

import { useSearchParams } from 'next/navigation'

export function AuthMessages() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const message = searchParams.get('message')

  return (
    <>
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/30 rounded-lg text-sm text-center">
          {error}
        </div>
      )}
      
      {message && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/30 rounded-lg text-sm text-center">
          {message}
        </div>
      )}
    </>
  )
}
