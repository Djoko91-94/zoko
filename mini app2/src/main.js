import './style.css'

document.querySelector('#app').innerHTML = `
<div class="min-h-screen bg-gradient-to-r from-blue-900 to-black flex items-center justify-center">

  <div class="bg-white/10 backdrop-blur-lg border border-white/20 p-10 rounded-3xl shadow-2xl w-[400px]">

    <h1 class="text-4xl font-bold text-center text-white mb-6">
      Mini App 🚀
    </h1>

    <p class="text-gray-300 text-center mb-6">
      Bienvenue sur ton application moderne
    </p>

    <input
      type="text"
      placeholder="Nom utilisateur"
      class="w-full p-3 rounded-xl mb-4 bg-white/20 text-white placeholder-gray-300 outline-none"
    >

    <input
      type="password"
      placeholder="Mot de passe"
      class="w-full p-3 rounded-xl mb-4 bg-white/20 text-white placeholder-gray-300 outline-none"
    >

    <button
      class="w-full bg-blue-600 hover:bg-blue-700 transition text-white p-3 rounded-xl font-bold"
    >
      Connexion
    </button>

  </div>

</div>
`