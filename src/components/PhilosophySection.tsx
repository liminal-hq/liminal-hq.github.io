export default function PhilosophySection() {
  return (
    <section id="philosophy" className="py-28 section pt-8">
      <div className="flex justify-between items-baseline mb-8">
        <h2 className="text-[2rem] font-semibold text-white mb-8">Our Approach</h2>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-8 mt-4">
        <div className="bg-[rgba(20,20,25,0.4)] border border-[rgba(255,255,255,0.1)] p-10 rounded-2xl transition-all duration-300 backdrop-blur-[10px] hover:border-[#a78bfa] hover:-translate-y-[5px] hover:bg-[rgba(255,255,255,0.05)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          <h3 className="text-xl mb-4 text-white flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-[10px] text-[1.2rem] text-[#ffaa40] bg-[rgba(255,170,64,0.1)]">
              💾
            </div>
            Local First
          </h3>
          <p className="text-[#9ca3af] text-base leading-[1.7]">
            The cloud is a convenience, not a landlord. Our software works offline, forever. Your data resides on your device.
          </p>
        </div>
        <div className="bg-[rgba(20,20,25,0.4)] border border-[rgba(255,255,255,0.1)] p-10 rounded-2xl transition-all duration-300 backdrop-blur-[10px] hover:border-[#a78bfa] hover:-translate-y-[5px] hover:bg-[rgba(255,255,255,0.05)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          <h3 className="text-xl mb-4 text-white flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-[10px] text-[1.2rem] text-[#f43f5e] bg-[rgba(244,63,94,0.1)]">
              🛡️
            </div>
            Sovereignty
          </h3>
          <p className="text-[#9ca3af] text-base leading-[1.7]">
            You own your thoughts. We use open formats (Markdown, JSON, SQL) to ensure you are never locked in.
          </p>
        </div>
        <div className="bg-[rgba(20,20,25,0.4)] border border-[rgba(255,255,255,0.1)] p-10 rounded-2xl transition-all duration-300 backdrop-blur-[10px] hover:border-[#a78bfa] hover:-translate-y-[5px] hover:bg-[rgba(255,255,255,0.05)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          <h3 className="text-xl mb-4 text-white flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-[10px] text-[1.2rem] text-[#22d3ee] bg-[rgba(34,211,238,0.1)]">
              🧶
            </div>
            Craftsmanship
          </h3>
          <p className="text-[#9ca3af] text-base leading-[1.7]">
            We reject "move fast and break things." We build robust, calm tools designed to last for decades.
          </p>
        </div>
      </div>
    </section>
  );
}
