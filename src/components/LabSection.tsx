export default function LabSection() {
  return (
    <section id="lab" className="py-28">
      <h2 className="text-[2rem] font-semibold text-white mb-8">Lab Notes</h2>
      <ul className="list-none">
        <li className="border-t border-b border-[rgba(255,255,255,0.1)] py-8 grid grid-cols-[120px_1fr] items-center gap-4 transition-all duration-300 hover:pl-4 hover:bg-[linear-gradient(90deg,rgba(255,255,255,0.03),transparent)] hover:border-l-[3px] hover:border-l-[#22d3ee]">
          <span className="font-[var(--font-space-grotesk)] text-[0.9rem] text-[#22d3ee] font-semibold">
            Jan 08
          </span>
          <a href="#" className="text-[1.25rem] font-medium text-[#e0e0e0] hover:text-white">
            Why we chose Rust for the next decade of tooling
          </a>
        </li>
        <li className="border-b border-[rgba(255,255,255,0.1)] py-8 grid grid-cols-[120px_1fr] items-center gap-4 transition-all duration-300 hover:pl-4 hover:bg-[linear-gradient(90deg,rgba(255,255,255,0.03),transparent)] hover:border-l-[3px] hover:border-l-[#22d3ee]">
          <span className="font-[var(--font-space-grotesk)] text-[0.9rem] text-[#22d3ee] font-semibold">
            Dec 12
          </span>
          <a href="#" className="text-[1.25rem] font-medium text-[#e0e0e0] hover:text-white">
            The case against mandatory cloud accounts
          </a>
        </li>
        <li className="border-b border-[rgba(255,255,255,0.1)] py-8 grid grid-cols-[120px_1fr] items-center gap-4 transition-all duration-300 hover:pl-4 hover:bg-[linear-gradient(90deg,rgba(255,255,255,0.03),transparent)] hover:border-l-[3px] hover:border-l-[#22d3ee]">
          <span className="font-[var(--font-space-grotesk)] text-[0.9rem] text-[#22d3ee] font-semibold">
            Nov 23
          </span>
          <a href="#" className="text-[1.25rem] font-medium text-[#e0e0e0] hover:text-white">
            Designing for the "Liminal" state of mind
          </a>
        </li>
      </ul>
    </section>
  );
}
