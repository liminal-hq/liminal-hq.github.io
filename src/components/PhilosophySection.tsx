export default function PhilosophySection() {
  return (
    <section id="philosophy" className="py-16 md:py-20">
      <div className="mb-8">
        <h2 className="mb-3 text-[1.75rem] font-semibold text-white md:text-[2rem]">Our Approach</h2>
        <p className="max-w-3xl text-[var(--text-muted)]">
          We build software that feels more human without becoming less powerful. That means every product decision is
          evaluated against clarity, agency, and long-term ownership.
        </p>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))] md:gap-8">
        <div className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(20,20,25,0.4)] p-8 backdrop-blur-[10px] transition-all duration-300 hover:-translate-y-[5px] hover:border-[#a78bfa] hover:bg-[rgba(255,255,255,0.05)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] md:p-10">
          <h3 className="text-xl mb-4 text-white flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-[10px] text-[1.2rem] text-[#ffaa40] bg-[rgba(255,170,64,0.1)]">
              💾
            </div>
            Local First
          </h3>
          <p className="text-[var(--text-muted)] text-base leading-[1.7]">
            The cloud is optional, not foundational. Our tools work offline and keep your data on your device by
            default.
          </p>
        </div>
        <div className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(20,20,25,0.4)] p-8 backdrop-blur-[10px] transition-all duration-300 hover:-translate-y-[5px] hover:border-[#a78bfa] hover:bg-[rgba(255,255,255,0.05)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] md:p-10">
          <h3 className="text-xl mb-4 text-white flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-[10px] text-[1.2rem] text-[#f43f5e] bg-[rgba(244,63,94,0.1)]">
              🛡️
            </div>
            Sovereignty
          </h3>
          <p className="text-[var(--text-muted)] text-base leading-[1.7]">
            You should be able to leave any tool without losing your work. We prefer open formats and portable data.
          </p>
        </div>
        <div className="rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[rgba(20,20,25,0.4)] p-8 backdrop-blur-[10px] transition-all duration-300 hover:-translate-y-[5px] hover:border-[#a78bfa] hover:bg-[rgba(255,255,255,0.05)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] md:p-10">
          <h3 className="text-xl mb-4 text-white flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-[10px] text-[1.2rem] text-[#22d3ee] bg-[rgba(34,211,238,0.1)]">
              🧶
            </div>
            Craftsmanship
          </h3>
          <p className="text-[var(--text-muted)] text-base leading-[1.7]">
            Durability matters. We design for calm, maintainability, and practical depth instead of novelty churn.
          </p>
        </div>
      </div>
    </section>
  );
}
