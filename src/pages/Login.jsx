async function handleLogin(e) {
  e.preventDefault()
  setLoading(true)
  setErro('')

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha
    })

    console.log('LOGIN DATA:', data)
    console.log('LOGIN ERROR:', error)

    if (error) {
      setErro(error.message)
      return
    }

    console.log('LOGIN OK')
  } catch (err) {
    console.error('ERRO GERAL:', err)
    setErro(err.message)
  } finally {
    setLoading(false)
  }
}