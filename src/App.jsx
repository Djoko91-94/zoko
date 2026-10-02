import './App.css'
import myimage from './assets/myimage.jpg'
import Card from './components/Card'
import SkillBars from './components/SkillBars'

const featureCards = [
  {
    title: 'Product design',
    description:
      'I create interfaces that are clean, useful, and comfortable to use on any screen size.',
  },
  {
    title: 'Web development',
    description:
      'Modern front-end experiences with React, Vite, and responsive UX patterns from prototype to production.',
  },
  {
    title: 'Optimization',
    description:
      'I focus on performance, accessibility, and maintainable code so the project stays easy to grow.',
  },
]

const skills = [
  { skillName: 'React', level: 92 },
  { skillName: 'JavaScript', level: 88 },
  { skillName: 'UI/UX', level: 84 },
  { skillName: 'Node.js', level: 76 },
]

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-lg font-bold text-emerald-300">
              Z
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Portfolio</p>
              <h1 className="text-lg font-semibold text-white">Zokora</h1>
            </div>
          </div>

          <nav aria-label="Main navigation" className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a href="#about" className="transition hover:text-white">À propos</a>
            <a href="#skills" className="transition hover:text-white">Compétences</a>
            <a href="#contact" className="transition hover:text-white">Contact</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
              Développeur front-end
            </p>
            <h2 className="max-w-xl text-4xl font-black tracking-tight text-white sm:text-5xl">
              Je conçois des expériences web claires et performantes.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              Je transforme des idées complexes en interfaces simples, élégantes et efficaces qui aident les utilisateurs à aller vite et sans friction.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#contact"
                className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                Travaillons ensemble
              </a>
              <a
                href="#projects"
                className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-900"
              >
                Voir mes projets
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="card-hero relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-2xl">
              <img
                src={myimage}
                alt="Portrait de Zokora"
                className="h-[420px] w-full rounded-2xl object-cover"
              />
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div>
                  <p className="text-sm text-slate-400">Statut</p>
                  <p className="font-semibold text-white">Disponible pour missions</p>
                </div>
                <span className="inline-flex h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" aria-label="Disponible" />
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="mt-20">
          <div className="mb-8 max-w-xl">
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Ce que je fais</p>
            <h3 className="mt-3 text-3xl font-bold text-white">Des solutions simples à utiliser et faciles à maintenir.</h3>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {featureCards.map((card) => (
              <Card
                key={card.title}
                titleText={card.title}
                contentsText={card.description}
                classes="h-full"
              />
            ))}
          </div>
        </section>

        <section id="skills" className="mt-20 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="card-surface rounded-3xl p-8">
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Approche</p>
            <h3 className="mt-3 text-3xl font-bold text-white">Un bon produit commence par une bonne compréhension.</h3>
            <p className="mt-4 text-base leading-7 text-slate-300">
              J’associe design, code et stratégie pour livrer des produits qui sont beaux, lisibles et alignés avec les besoins réels des utilisateurs.
            </p>
          </div>

          <div className="card-surface rounded-3xl p-8">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Compétences</h3>
              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                2026
              </span>
            </div>
            <SkillBars skills={skills} />
          </div>
        </section>

        <section id="projects" className="mt-20">
          <div className="card-surface rounded-3xl p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Projets</p>
                <h3 className="mt-3 text-3xl font-bold text-white">Des réalisations centrées sur l’expérience utilisateur.</h3>
              </div>
              <a href="#contact" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
                Demander un devis →
              </a>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <p className="text-sm text-slate-400">01</p>
                <h4 className="mt-3 text-xl font-semibold text-white">Dashboard SaaS</h4>
                <p className="mt-2 text-sm leading-6 text-slate-300">Interface de gestion claire avec suivi des KPIs et automatisations utiles.</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <p className="text-sm text-slate-400">02</p>
                <h4 className="mt-3 text-xl font-semibold text-white">Boutique e-commerce</h4>
                <p className="mt-2 text-sm leading-6 text-slate-300">Expérience d’achat optimisée, mobile-first et pensée pour la conversion.</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
                <p className="text-sm text-slate-400">03</p>
                <h4 className="mt-3 text-xl font-semibold text-white">Portfolio créatif</h4>
                <p className="mt-2 text-sm leading-6 text-slate-300">Design fort, narration claire et mise en valeur des compétences de manière élégante.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="contact" className="mt-20 pb-12">
          <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 p-8 text-center">
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Contact</p>
            <h3 className="mt-3 text-3xl font-bold text-white">Prêt à lancer votre prochain projet ?</h3>
            <p className="mx-auto mt-4 max-w-2xl text-slate-300">
              Je peux vous accompagner sur la conception, le développement ou l’optimisation d’une interface web moderne.
            </p>
            <a
              href="mailto:hello@zokora.dev"
              className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              hello@zokora.dev
            </a>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
