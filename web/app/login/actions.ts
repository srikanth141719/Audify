'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    console.error("Login Error:", error.message)
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { data: signUpData, error } = await supabase.auth.signUp(data)

  if (error) {
    console.error("Signup Error:", error.message)
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  if (signUpData.user && !signUpData.session) {
    redirect(`/login?message=${encodeURIComponent('Sign up successful! Please check your email to confirm your account.')}`)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}
