type Skill = {
  skillName: string;
  level: number;
};

type SkillBarsProps = {
  skills: Skill[];
};

export default function SkillBars({ skills }: SkillBarsProps) {
  return (
    <div className="space-y-5">
      {skills.map((skill) => (
        <SkillBar
          key={skill.skillName}
          titleText={skill.skillName}
          contentsText={`${skill.level}%`}
          width={skill.level}
        />
      ))}
    </div>
  );
}

function SkillBar({ width, titleText, contentsText }) {
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
        <span>{titleText}</span>
        <span>{contentsText}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-800 shadow-inner">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500"
          style={{ width: `${width}%` }}
          aria-label={`${titleText} ${contentsText}`}
        />
      </div>
    </div>
  );
}

