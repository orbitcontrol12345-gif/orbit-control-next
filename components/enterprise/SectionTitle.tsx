type Props = {
  eyebrow: string;
  title: string;
  description?: string;
  center?: boolean;
};

export default function SectionTitle({
  eyebrow,
  title,
  description,
  center = false,
}: Props) {
  return (
    <div className={center ? "text-center" : ""}>
      <p className="mb-4 text-xs font-black uppercase tracking-[0.35em] text-cyan-300">
        {eyebrow}
      </p>

      <h2 className="text-4xl font-black text-white md:text-6xl">
        {title}
      </h2>

      {description && (
        <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-400">
          {description}
        </p>
      )}
    </div>
  );
}
