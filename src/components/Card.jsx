import PropTypes from 'prop-types'

export default function Card({ titleText, contentsText, classes = '' }) {
  return (
    <article className={`card-surface rounded-2xl p-6 shadow-lg ${classes}`}>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-lg text-emerald-300">
          ✦
        </span>
        <h3 className="text-xl font-semibold text-white">{titleText}</h3>
      </div>
      <p className="text-sm leading-7 text-slate-300">{contentsText}</p>
    </article>
  )
}

Card.propTypes = {
  titleText: PropTypes.string.isRequired,
  contentsText: PropTypes.string.isRequired,
  classes: PropTypes.string,
}

